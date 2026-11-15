import { Link } from "react-router-dom";
import { SearchBar } from "../features/search/SearchBar";
import { useOverview } from "../features/dashboard/api";
import {
  NetworkOverview,
  MiningOverview,
} from "../features/dashboard/Overview";
import { useBlocks } from "../features/blocks/api";
import { BlocksTable } from "../features/blocks/BlocksTable";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
} from "../components/ui";
export function HomePage() {
  const overview = useOverview();
  const blocks = useBlocks(undefined, 4);
  return (
    <div className="home-page">
      <div className="home-search">
        <h1>Explore the PoUW Blockchain</h1>
        <SearchBar />
      </div>
      {overview.isPending ? (
        <LoadingState />
      ) : overview.isError ? (
        <ErrorState retry={() => void overview.refetch()} />
      ) : overview.data.stats[0] ? (
        <NetworkOverview stats={overview.data.stats[0]} />
      ) : (
        <EmptyState message="No network statistics are available." />
      )}
      <section className="latest-blocks">
        <SectionHeader
          title="Latest Blocks"
          action={
            <Link className="view-all" to="/blocks">
              View all →
            </Link>
          }
        />
        {blocks.isPending ? (
          <LoadingState />
        ) : blocks.isError ? (
          <ErrorState retry={() => void blocks.refetch()} />
        ) : (
          <BlocksTable blocks={blocks.data.blocks.slice(0, 4)} preview />
        )}
      </section>
      {overview.data?.stats[0] && (
        <MiningOverview
          stats={overview.data.stats[0]}
          work={overview.data.useful_work}
        />
      )}
    </div>
  );
}
