import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useExplorerQuery } from "./useExplorerQuery";
import { useMocks } from "./config";
import type { Block } from "../features/blocks/api";

export function refreshReadQueries(client: QueryClient) {
  return client.invalidateQueries({
    predicate: (query) => query.queryKey[0] === "explorer" && !["HomeStats", "LatestBlocks"].includes(String(query.queryKey[1])),
  });
}

// Use the existing contract's live tip to refresh its HTTP-only detail/history
// operations. A replacement snapshot also catches reorgs and reconnect recovery.
export function useChainUpdates() {
  const client = useQueryClient();
  const query = useExplorerQuery<{ blocks: Block[] }>("LatestBlocks", { limit: 1 }, !useMocks);
  const previous = useRef<{ time: number; data: unknown } | undefined>(undefined);
  useEffect(() => {
    if (!query.data) return;
    if (previous.current && (previous.current.time !== query.dataUpdatedAt || previous.current.data !== query.data)) void refreshReadQueries(client);
    previous.current = { time: query.dataUpdatedAt, data: query.data };
  }, [client, query.data, query.dataUpdatedAt]);
  return query;
}
