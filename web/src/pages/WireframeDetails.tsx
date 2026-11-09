import { Link, useParams } from "react-router-dom";
import { useBlockDetail } from "../features/details/api";
import {
  AddressLink,
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
  SectionHeader,
} from "../components/ui";
import { useCursorPage } from "../lib/usePage";
import { date, number, shorten } from "../lib/formatters";
export function BlockDetailsPage() {
  const { id = "" } = useParams();
  const proofs = useCursorPage("proofAfter");
  const transfers = useCursorPage("transferAfter");
  const registrations = useCursorPage("registrationAfter");
  const limit = 6;
  const query = useBlockDetail(
    id,
    transfers.before,
    registrations.before,
    proofs.before,
    limit,
  );
  const block = query.data?.blocks[0];
  const proofRows = block?.proofs.slice(0, limit) ?? [];
  const transferRows = block?.transfers.slice(0, limit) ?? [];
  const registrationRows = block?.registrations.slice(0, limit) ?? [];
  return (
    <div className="page">
      <Link className="back-link" to="/blocks" aria-label="Back to blocks">
        ⟵
      </Link>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState retry={() => void query.refetch()} />
      ) : !block ? (
        <EmptyState message="Block not found." />
      ) : (
        <>
          <h1>Block #{block.height}</h1>
          <section className="detail-section">
            <SectionHeader title="Block information" />
            <div className="block-information">
              <dl>
                <div>
                  <dt>Hash</dt>
                  <dd title={block.hash}>{shorten(block.hash)}</dd>
                </div>
                <div>
                  <dt>Previous block</dt>
                  <dd>
                    {block.height > 0 && block.prev_hash ? (
                      <Link
                        to={`/blocks/${encodeURIComponent(block.prev_hash)}`}
                      >
                        #{block.height - 1}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Miner</dt>
                  <dd>
                    <AddressLink address={block.miner} />
                  </dd>
                </div>
                <div>
                  <dt>Timestamp</dt>
                  <dd>{date(block.time)}</dd>
                </div>
                <div>
                  <dt>Difficulty</dt>
                  <dd>{number(block.difficulty)}</dd>
                </div>
                <div>
                  <dt>Bucket</dt>
                  <dd>
                    {block.bucket_id} of {block.bucket_count}
                  </dd>
                </div>
                <div>
                  <dt>Chain status</dt>
                  <dd>{block.canonical ? "Canonical" : "Orphaned"}</dd>
                </div>
                <div>
                  <dt>Transaction root</dt>
                  <dd title={block.tx_root}>
                    {block.tx_root ? shorten(block.tx_root) : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Size (bytes)</dt>
                  <dd>{number(block.size_bytes)}</dd>
                </div>
                <div>
                  <dt>Total fees</dt>
                  <dd>{number(block.fee_total)}</dd>
                </div>
              </dl>
            </div>
          </section>
          <div className="split-tables">
            <section>
              <SectionHeader
                title={`Proof transactions (${block.proof_count})`}
              />
              {block.proofs.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Tx hash</th>
                        <th>Circuit</th>
                        <th>Fee</th>
                        <th>Client</th>
                        <th>Usage counter</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proofRows.map((p) => (
                        <tr key={p.proof_hash}>
                          <td>
                            <Link
                              title={p.proof_hash}
                              to={`/proof/${encodeURIComponent(p.proof_hash)}`}
                            >
                              {shorten(p.proof_hash)}
                            </Link>
                          </td>
                          <td>
                            <Link
                              to={`/circuits/${encodeURIComponent(p.circuit_id)}`}
                            >
                              {shorten(p.circuit_id)}
                            </Link>
                          </td>
                          <td>{number(p.fee)}</td>
                          <td>
                            <AddressLink address={p.client} />
                          </td>
                          <td>{number(p.usage_counter)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No proof transactions in this block." />
              )}
              {(proofs.page > 1 || block.proofs.length > limit) && (
                <Pagination
                  page={proofs.page}
                  hasNext={block.proofs.length > limit}
                  onChange={(next) =>
                    proofs.change(next, proofRows.at(-1)?.sort_key)
                  }
                />
              )}
            </section>
            <section className="transfers-table">
              <SectionHeader
                title={`Coin transfers (${block.transfer_count})`}
              />
              {block.transfers.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Tx hash</th>
                        <th>From → To</th>
                        <th>Amount</th>
                        <th>Fee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transferRows.map((t) => (
                        <tr key={t.txid}>
                          <td>
                            <Link
                              title={t.txid}
                              to={`/transactions/${encodeURIComponent(t.txid)}`}
                            >
                              {shorten(t.txid)}
                            </Link>
                          </td>
                          <td>
                            <AddressLink address={t.sender} /> →{" "}
                            <AddressLink address={t.recipient} />
                          </td>
                          <td>{number(t.amount)}</td>
                          <td>{number(t.fee)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No coin transfers in this block." />
              )}
              {(transfers.page > 1 || block.transfers.length > limit) && (
                <Pagination
                  page={transfers.page}
                  hasNext={block.transfers.length > limit}
                  onChange={(next) =>
                    transfers.change(next, transferRows.at(-1)?.sort_key)
                  }
                />
              )}
            </section>
          </div>
          <section className="detail-section">
            <SectionHeader
              title={`Circuit registrations (${block.registration_count})`}
            />
            {block.registrations.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Circuit</th>
                      <th>Transaction</th>
                      <th>Proof system</th>
                      <th>Registrant</th>
                      <th>Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrationRows.map((registration) => (
                      <tr key={registration.circuit_id}>
                        <td>
                          <Link to={`/circuits/${registration.circuit_id}`}>
                            {shorten(registration.circuit_id)}
                          </Link>
                        </td>
                        <td>
                          <Link to={`/transactions/${registration.txid}`}>
                            {shorten(registration.txid)}
                          </Link>
                        </td>
                        <td>{registration.proof_system}</td>
                        <td>
                          <AddressLink address={registration.registrant} />
                        </td>
                        <td>{number(registration.fee)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No circuit registrations in this block." />
            )}
            {(registrations.page > 1 || block.registrations.length > limit) && (
              <Pagination
                page={registrations.page}
                hasNext={block.registrations.length > limit}
                onChange={(next) =>
                  registrations.change(next, registrationRows.at(-1)?.sort_key)
                }
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
