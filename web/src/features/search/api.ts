import { useQuery } from "@tanstack/react-query";
import { hasuraQuery } from "../../lib/hasura";
const hitRoutes = {
  block: "blocks",
  circuit: "circuits",
  address: "addresses",
  transfer: "transactions",
  proof: "proof",
} as const;

interface Hit {
  kind: keyof typeof hitRoutes;
  id: string;
  height: number | null;
}
export function searchHitPath(hit: Hit) {
  return `/${hitRoutes[hit.kind]}/${encodeURIComponent(hit.id)}`;
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ["search", q],
    enabled: !!q,
    queryFn: () =>
      hasuraQuery<{ search: Hit[] }>(
        "query Search($q: String!) { search(args: {q: $q}) { kind id height } }",
        { q },
      ),
  });
}
