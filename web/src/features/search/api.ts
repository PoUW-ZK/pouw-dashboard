import { useQuery } from "@tanstack/react-query";
import { hasuraQuery } from "../../lib/hasura";
import operations from "../../graphql/operations.json";
import { showPouw } from "../../lib/config";
import { searchCandidates } from "./normalize";
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
    queryKey: ["explorer", "Search", { q }],
    enabled: !!q,
    queryFn: async () => {
      const results = await Promise.all(searchCandidates(q, showPouw).map((candidate) =>
        hasuraQuery<{ search: Hit[] }>(operations.queries.Search, { q: candidate }),
      ));
      const hits = results.flatMap((result) => result.search).filter((hit) => showPouw || !["circuit", "proof"].includes(hit.kind));
      return { search: [...new Map(hits.map((hit) => [searchHitPath(hit), hit])).values()] };
    },
  });
}
