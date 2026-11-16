import { useQuery } from "@tanstack/react-query";
import { heightCursor } from "../../lib/usePage";
import { hasuraQuery } from "../../lib/hasura";
export interface Block {
  hash: string;
  height: number;
  miner: string;
  transfer_count: number;
  registration_count: number;
  proof_count: number;
  time: string;
}
export const blockFields =
  "hash height miner transfer_count registration_count proof_count time";
export function useBlocks(before?: string, limit = 10) {
  return useQuery({
    queryKey: ["blocks", before, limit],
    queryFn: () =>
      hasuraQuery<{ blocks: Block[] }>(
        `query Blocks($limit: Int!, $before: bigint!) { blocks(where: {canonical: {_eq: true}, height: {_lt: $before}}, order_by: {height: desc}, limit: $limit) { ${blockFields} } }`,
        { limit: limit + 1, before: heightCursor(before) },
      ),
  });
}
