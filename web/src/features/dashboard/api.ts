import { useQuery } from "@tanstack/react-query";
import { hasuraQuery } from "../../lib/hasura";
export interface Stats {
  indexed_height: number | null;
  bucket_count: number | null;
  circuit_count: number;
  proof_count: number;
  avg_block_interval_s: number | null;
}
export interface Work {
  proof_system: string;
  proof_count: number;
  useful_work: number;
}
export function useOverview() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: () =>
      hasuraQuery<{ stats: Stats[]; useful_work: Work[] }>(
        "query Overview { stats { indexed_height bucket_count circuit_count proof_count avg_block_interval_s } useful_work { proof_system proof_count useful_work } }",
      ),
  });
}
