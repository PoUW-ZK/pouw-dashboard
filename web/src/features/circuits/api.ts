import { useExplorerQuery } from "../../lib/useExplorerQuery";
import type { ChainNumber } from "../../lib/formatters";
interface Circuit {
  circuit_id: string;
  proof_system: string;
  constraint_count: ChainNumber;
  proof_count: ChainNumber;
  registrant: string;
  registered_height: ChainNumber;
  sort_key: string;
}
export function useCircuits(before = "~", limit = 20) {
  return useExplorerQuery<{ circuits: Circuit[] }>("Circuits", { before, limit: limit + 1 });
}
