import { useQuery } from "@tanstack/react-query";
import { hasuraQuery } from "../../lib/hasura";
interface Miner {
  miner: string;
  blocks: number;
  share: number;
  last_block_height: number;
}
export function useMiners() {
  return useQuery({
    queryKey: ["miners"],
    queryFn: () =>
      hasuraQuery<{ miner_shares: Miner[] }>(
        "query Miners { miner_shares(order_by: [{blocks: desc}, {miner: asc}], limit: 100) { miner blocks share last_block_height } }",
      ),
  });
}
