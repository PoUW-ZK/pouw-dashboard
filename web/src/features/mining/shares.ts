import type { ChainNumber } from "../../lib/formatters";

export interface Miner {
  miner: string;
  blocks: ChainNumber;
  share: ChainNumber;
  last_block_height: ChainNumber | null;
  label?: string;
}

export function mergeMiners(observed: Miner[], configured: { label: string; miner: string }[]): Miner[] {
  const rows = new Map(observed.map((row) => [row.miner, row]));
  const result = configured.map(({ label, miner }) => {
    const row = rows.get(miner);
    rows.delete(miner);
    return { miner, blocks: 0, share: 0, last_block_height: null, ...row, label };
  });
  return [...result, ...rows.values()];
}
