import { Link, useSearchParams } from "react-router-dom";
import { useBlocks } from "../features/blocks/api";
import { BlocksTable } from "../features/blocks/BlocksTable";
import {
  ErrorState,
  LoadingState,
  Pagination,
  SectionHeader,
} from "../components/ui";
import { useCursorPage } from "../lib/usePage";
export function BlocksPage() {
  const { page, before, change } = useCursorPage();
  const [params, setParams] = useSearchParams();
  const filter = params.get("filter") || "";
  const limit = 12;
  const query = useBlocks(before, limit);
  const pageRows = query.data?.blocks.slice(0, limit) ?? [];
  const rows = pageRows.filter((b) =>
    [
      b.hash,
      b.height,
      b.miner,
      Number(b.transfer_count) + Number(b.registration_count),
      b.proof_count,
    ].some((value) =>
      String(value).toLowerCase().includes(filter.toLowerCase()),
    ),
  );
  return (
    <div className="page">
      <Link className="back-link" to="/" aria-label="Back to home">
        ⟵
      </Link>
      <h1>Blocks</h1>
      <div className="search-bar">
        <input
          aria-label="Search blocks"
          placeholder="Filter this page by block ID, miner or transaction count"
          value={filter}
          onChange={(event) => {
            const next = new URLSearchParams(params);
            if (event.target.value) next.set("filter", event.target.value);
            else next.delete("filter");
            setParams(next, { replace: true });
          }}
        />
      </div>
      <section className="list-section">
        <SectionHeader title="Blocks" />
        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState retry={() => void query.refetch()} />
        ) : (
          <>
            <BlocksTable blocks={rows} />
            <Pagination
              page={page}
              hasNext={query.data.blocks.length > limit}
              onChange={(next) => change(next, pageRows.at(-1)?.height)}
            />
          </>
        )}
      </section>
    </div>
  );
}
