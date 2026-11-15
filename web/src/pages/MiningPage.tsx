import { Link } from "react-router-dom";
import { useMiners } from "../features/mining/api";
import { number } from "../lib/formatters";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  AddressLink,
} from "../components/ui";
import { useOverview } from "../features/dashboard/api";
import { MiningOverview } from "../features/dashboard/Overview";
import { PageTitle } from "./PageTitle";
export function MiningPage() {
  const overview = useOverview();
  const miners = useMiners();
  return (
    <div className="page mining-page">
      <div className="page-heading">
        <Link className="back-link" to="/" aria-label="Back to home">
          ⟵
        </Link>
        <PageTitle
          title="Mining"
          description="Follow the useful computation securing the network."
        />
      </div>
      {overview.isPending ? (
        <LoadingState />
      ) : overview.isError ? (
        <ErrorState retry={() => void overview.refetch()} />
      ) : overview.data.stats[0] ? (
        <MiningOverview
          stats={overview.data.stats[0]}
          work={overview.data.useful_work}
        />
      ) : (
        <EmptyState />
      )}
      <section className="list-section">
        <SectionHeader
          title="Miner shares"
          action={<span className="eyebrow">TOP 100 MINERS</span>}
        />
        {miners.isPending ? (
          <LoadingState />
        ) : miners.isError ? (
          <ErrorState retry={() => void miners.refetch()} />
        ) : !miners.data.miner_shares.length ? (
          <EmptyState />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Miner</th>
                  <th>Blocks mined</th>
                  <th>Share</th>
                  <th>Latest height</th>
                </tr>
              </thead>
              <tbody>
                {miners.data.miner_shares.map((row) => (
                  <tr key={row.miner}>
                    <td>
                      <AddressLink address={row.miner} />
                    </td>
                    <td>{number(row.blocks)}</td>
                    <td>{number(Number(row.share) * 100)}%</td>
                    <td>{number(row.last_block_height)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
