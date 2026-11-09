import { useQuery } from "@tanstack/react-query";
import { hasuraQuery } from "../../lib/hasura";
interface Circuit {
  circuit_id: string;
  proof_system: string;
  constraint_count: number;
  proof_count: number;
  registrant: string;
  registered_height: number;
  sort_key: string;
}
export function useCircuits(before = "~", limit = 20) {
  return useQuery({
    queryKey: ["circuits", before, limit],
    queryFn: () =>
      hasuraQuery<{ circuits: Circuit[] }>(
        "query Circuits($before: String!, $limit: Int!) { circuits(where: {canonical: {_eq: true}, sort_key: {_lt: $before}}, order_by: {sort_key: desc}, limit: $limit) { circuit_id proof_system constraint_count proof_count registrant registered_height sort_key } }",
        { before, limit: limit + 1 },
      ),
  });
}
