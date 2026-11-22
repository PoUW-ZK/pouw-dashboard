import { useSyncExternalStore } from "react";
import { useMocks } from "../../lib/config";
import { liveClient } from "../../lib/subscriptions";

import { useChainUpdates } from "../../lib/useChainUpdates";

export function LiveStatus() {
  const updates = useChainUpdates();
  const client = useMocks ? undefined : liveClient();
  const status = useSyncExternalStore(
    client?.listen ?? (() => () => {}),
    client?.getStatus ?? (() => "mock"),
    () => "idle",
  );
  return (
    <>
    {updates.isError && <div className="feedback error" role="alert">Live updates are unavailable. <button onClick={() => void updates.refetch()}>Try again</button></div>}
    <div className={`live-status live-${status}`} role="status" aria-live="polite">
      {status === "mock" ? "Preview data" : status === "connected" ? "Live" : status === "error" ? "Live connection unavailable" : status === "reconnecting" ? "Reconnecting… Displayed data may be out of date." : status === "connecting" ? "Connecting to live data…" : ""}
    </div>
    </>
  );
}
