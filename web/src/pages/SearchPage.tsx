import { searchHitPath, useSearch } from "../features/search/api";
import { Link, Navigate } from "react-router-dom";
import { PageTitle } from "./PageTitle";
import { useSearchParams } from "react-router-dom";
import { number } from "../lib/formatters";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
} from "../components/ui";
import { SearchBar } from "../features/search/SearchBar";
export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q")?.trim() || "";
  const query = useSearch(q);
  const hits = query.data?.search ?? [];
  const results = [
    ...new Map(hits.map((hit) => [searchHitPath(hit), hit])).values(),
  ];
  const block = results[0];
  if (!query.isError && results.length === 1 && block?.kind === "block") {
    return <Navigate replace to={searchHitPath(block)} />;
  }

  return (
    <div className="page">
      <PageTitle
        title="Search the network"
        description="Enter a block height or a complete identifier (blk:, tx:, proof:, circ:, addr:)."
      />
      <SearchBar initialValue={q} />
      <section>
        <SectionHeader title={q ? `Results for “${q}”` : "Search results"} />
        {!q ? (
          <EmptyState message="Enter a query to get started." />
        ) : query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState retry={() => void query.refetch()} />
        ) : !results.length ? (
          <EmptyState message="No matching records. Try a block height or a full prefixed identifier." />
        ) : (
          results.map((hit) => (
            <Link
              className="result-row"
              key={`${hit.kind}-${hit.id}`}
              to={searchHitPath(hit)}
            >
              <span className="proof-count">{hit.kind}</span>
              <span className="mono">{hit.id}</span>
              <span>Height {number(hit.height)} ↗</span>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
