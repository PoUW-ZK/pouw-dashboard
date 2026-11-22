import { useExplorerQuery } from "../../lib/useExplorerQuery";
import type { ChainNumber } from "../../lib/formatters";
import type { Miner } from "../mining/shares";

export interface Stats {
  indexed_height: ChainNumber | null;
  latest_block_time: string | null;
  block_count: ChainNumber;
  transfer_count: ChainNumber;
  bucket_count: ChainNumber | null;
  circuit_count: ChainNumber;
  proof_count: ChainNumber;
}
export interface Work {
  proof_system: string;
  proof_count: ChainNumber;
  useful_work: ChainNumber;
}
export interface Mining {
  stats: { block_count: ChainNumber; avg_block_interval_s: ChainNumber | null }[];
  miner_shares: Miner[];
  useful_work: Work[];
}
export function useOverview() {
  return useExplorerQuery<{ stats: Stats[] }>("HomeStats");
}
export function useMining() {
  return useExplorerQuery<Mining>("Mining");
}
