import { useExplorerQuery } from "../../lib/useExplorerQuery";
import type { ChainNumber } from "../../lib/formatters";

export interface Block {
  hash: string;
  height: ChainNumber;
  miner: string;
  transfer_count: ChainNumber;
  registration_count: ChainNumber;
  proof_count: ChainNumber;
  time: string;
}

export function useBlocks(before?: string, limit = 10) {
  return useExplorerQuery<{ blocks: Block[] }>(
    before ? "Blocks" : "LatestBlocks",
    before ? { limit: limit + 1, before } : { limit: limit + 1 },
  );
}
