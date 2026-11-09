import { Link, useParams } from "react-router-dom";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
  SectionHeader,
  StatCard,
  StatsGrid,
} from "../components/ui";
import { BlocksTable } from "../features/blocks/BlocksTable";
import {
  useAddress,
  useAddressHistory,
  useMinedBlocks,
} from "../features/details/api";
import { date, number, shorten } from "../lib/formatters";
import { useCursorPage } from "../lib/usePage";

const historyLimit = 20;

function AddressHistory({ id }: { id: string }) {
  const { before, page, change } = useCursorPage("historyBefore");
  const query = useAddressHistory(id, before, historyLimit);
  const rows = query.data?.address_txs.slice(0, historyLimit) ?? [];

  return (
    <section className="address-history">
      <SectionHeader title="Transaction history" />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState retry={() => void query.refetch()} />
      ) : (
        <>
          {rows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Transaction</th>
                    <th>Block</th>
                    <th>Time</th>
                    <th>Amount</th>
                    <th>Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.sort_key}>
                      <td>
                        {row.kind === "transfer"
                          ? ({
                              in: "Received",
                              out: "Sent",
                              self: "Self-transfer",
                            }[row.direction] ?? "Transfer")
                          : row.kind === "register_circuit"
                            ? "Circuit registration"
                            : "Proof request"}
                      </td>
                      <td>
                        <Link title={row.txid} to={`/transactions/${row.txid}`}>
                          {shorten(row.txid)}
                        </Link>
                      </td>
                      <td>
                        <Link to={`/block/${row.height}`}>#{row.height}</Link>
                      </td>
                      <td>{date(row.time)}</td>
                      <td>{number(row.amount)}</td>
                      <td>{number(row.fee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No transactions found for this address." />
          )}
          {(page > 1 || query.data.address_txs.length > historyLimit) && (
            <Pagination
              page={page}
              hasNext={query.data.address_txs.length > historyLimit}
              onChange={(next) => change(next, rows.at(-1)?.sort_key)}
            />
          )}
        </>
      )}
    </section>
  );
}

function MinedBlocks({ id }: { id: string }) {
  const { before, page, change } = useCursorPage("minedBefore");
  const query = useMinedBlocks(id, before, historyLimit);
  const rows = query.data?.blocks.slice(0, historyLimit) ?? [];

  return (
    <section className="address-history">
      <SectionHeader title="Mined blocks" />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState retry={() => void query.refetch()} />
      ) : (
        <>
          <BlocksTable blocks={rows} />
          {(page > 1 || query.data.blocks.length > historyLimit) && (
            <Pagination
              page={page}
              hasNext={query.data.blocks.length > historyLimit}
              onChange={(next) => change(next, rows.at(-1)?.height)}
            />
          )}
        </>
      )}
    </section>
  );
}

export function AddressDetailsPage() {
  const { id = "" } = useParams();
  const query = useAddress(id);
  const address = query.data?.addresses[0];

  return (
    <div className="page">
      <Link className="back-link" to="/" aria-label="Back to home">
        ⟵
      </Link>
      <h1 title={id}>Address details - {shorten(id)}</h1>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState retry={() => void query.refetch()} />
      ) : !address ? (
        <EmptyState message="Address not found." />
      ) : (
        <>
          <div className="address-cards">
            <StatsGrid>
              <StatCard label="Balance" value={number(address.balance)} />
              <StatCard
                label="Mining rewards"
                value={number(address.mining_rewards)}
              />
              <StatCard
                label="Blocks mined"
                value={number(address.blocks_mined)}
              />
              <StatCard
                label="Transfers and registrations sent"
                value={number(address.txs_sent)}
              />
              <StatCard
                label="Transfers received"
                value={number(address.txs_received)}
              />
              <StatCard
                label="Proof requests answered"
                value={number(address.proof_requests)}
              />
            </StatsGrid>
            {(address.balance == null || address.mining_rewards == null) && (
              <p>
                Balance and mining reward amounts are unavailable in the v0 API.
              </p>
            )}
          </div>
          <AddressHistory id={id} />
          <MinedBlocks id={id} />
        </>
      )}
    </div>
  );
}
