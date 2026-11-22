import { parseGraphQL } from "./parseGraphQL";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

interface Sink {
  next: (data: unknown) => void;
  error: (error: Error) => void;
}

interface Operation {
  query: string;
  variables: Record<string, unknown>;
  sink: Sink;
}

type ServerMessage =
  | { type: "ping" | "pong" | "connection_ack"; payload?: Record<string, unknown> }
  | { type: "next"; id: string; payload: { data?: unknown; errors?: Array<{ message: string }> } }
  | { type: "error"; id: string; payload: Array<{ message: string }> }
  | { type: "complete"; id: string };

export function websocketUrl(location: { protocol: string; host: string }) {
  return `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/v1/graphql`;
}

// A lazy, shared graphql-transport-ws connection. In particular, ping is legal
// before connection_ack; operation requests must wait for the acknowledgement.
export class HasuraSocket {
  private socket?: WebSocket;
  private operations = new Map<string, Operation>();
  private listeners = new Set<() => void>();
  private status: ConnectionStatus = "idle";
  private acknowledged = false;
  private sequence = 0;
  private attempts = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private handshakeTimer?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private pongTimer?: ReturnType<typeof setTimeout>;

  constructor(
    privateUrl: string,
    createSocket: (url: string, protocol: string) => WebSocket = (url, protocol) => new WebSocket(url, protocol),
  ) {
    this.url = privateUrl;
    this.createSocket = createSocket;
  }

  private url: string;
  private createSocket: (url: string, protocol: string) => WebSocket;
  getStatus = () => this.status;
  listen = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private setStatus(status: ConnectionStatus) {
    this.status = status;
    this.listeners.forEach((listener) => listener());
  }

  subscribe(query: string, variables: Record<string, unknown>, sink: Sink) {
    const id = String(++this.sequence);
    this.operations.set(id, { query, variables, sink });
    if (this.acknowledged) this.start(id);
    else if (!this.socket && !this.retryTimer) this.connect();
    return () => {
      if (!this.operations.delete(id)) return;
      if (this.acknowledged) this.send({ id, type: "complete" });
      if (!this.operations.size) this.stop();
    };
  }

  private send(message: unknown) {
    if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(message));
  }

  private start(id: string) {
    const operation = this.operations.get(id);
    if (operation) this.send({ id, type: "subscribe", payload: { query: operation.query, variables: operation.variables } });
  }

  private clearTimers() {
    clearTimeout(this.handshakeTimer);
    clearInterval(this.heartbeat);
    clearTimeout(this.pongTimer);
    this.pongTimer = undefined;
  }

  private connect() {
    this.setStatus(this.attempts ? "reconnecting" : "connecting");
    let socket: WebSocket;
    try {
      socket = this.createSocket(this.url, "graphql-transport-ws");
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    this.acknowledged = false;
    this.handshakeTimer = setTimeout(() => socket.close(4408, "Connection acknowledgement timeout"), 10_000);
    socket.onopen = () => {
      if (this.socket === socket) this.send({ type: "connection_init", payload: {} });
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      try {
        const message = parseGraphQL<ServerMessage>(String(event.data));
        if (message.type === "ping") {
          this.send({ type: "pong", ...(message.payload === undefined ? {} : { payload: message.payload }) });
          return;
        }
        if (message.type === "pong") {
          clearTimeout(this.pongTimer);
          this.pongTimer = undefined;
          return;
        }
        if (message.type === "connection_ack") {
          if (this.acknowledged) throw new Error("Duplicate acknowledgement");
          this.acknowledged = true;
          clearTimeout(this.handshakeTimer);
          this.setStatus("connected");
          this.operations.forEach((_, id) => this.start(id));
          this.heartbeat = setInterval(() => {
            this.send({ type: "ping" });
            this.pongTimer = setTimeout(() => socket.close(4408, "Heartbeat timeout"), 10_000);
          }, 20_000);
          return;
        }
        if (!("id" in message) || typeof message.id !== "string") throw new Error("Missing operation ID");
        const operation = this.operations.get(message.id);
        if (!operation) return; // Responses already in flight after unsubscribe.
        if (message.type === "next") {
          if (message.payload?.errors?.length || !message.payload?.data) {
            this.fail(message.id, message.payload?.errors);
          } else {
            this.attempts = 0;
            operation.sink.next(message.payload.data);
          }
        } else if (message.type === "error") {
          this.fail(message.id, message.payload);
        } else if (message.type === "complete") {
          this.fail(message.id, [{ message: "The live subscription ended. Please try again." }]);
        } else {
          socket.close(4400, "Invalid GraphQL message");
        }
      } catch {
        socket.close(4400, "Invalid GraphQL message");
      }
    };
    socket.onerror = () => { if (this.socket === socket) socket.close(); };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.acknowledged = false;
      this.clearTimers();
      if ([4400, 4401, 4403, 4406, 4409, 4429].includes(event.code)) {
        this.setStatus("error");
        const error = new Error(`Live connection rejected (${event.code}). ${event.reason}`);
        const pending = [...this.operations.values()];
        this.operations.clear();
        pending.forEach(({ sink }) => sink.error(error));
      } else if (this.operations.size) {
        this.scheduleReconnect();
      }
    };
  }

  private fail(id: string, errors?: Array<{ message: string }>) {
    const operation = this.operations.get(id);
    if (this.acknowledged) this.send({ id, type: "complete" });
    this.operations.delete(id);
    operation?.sink.error(new Error(errors?.map((error) => error.message).join("; ") || "Live query failed"));
    if (!this.operations.size) this.stop();
  }

  private scheduleReconnect() {
    if (!this.operations.size) return;
    this.setStatus("reconnecting");
    const delay = Math.min(1000 * 2 ** Math.min(this.attempts++, 4), 15_000);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.connect();
    }, delay);
  }

  private stop() {
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.clearTimers();
    const socket = this.socket;
    this.socket = undefined;
    this.acknowledged = false;
    this.attempts = 0;
    socket?.close(1000, "No active subscriptions");
    this.setStatus("idle");
  }
}

let client: HasuraSocket | undefined;
export function liveClient() {
  return client ??= new HasuraSocket(websocketUrl(window.location));
}
