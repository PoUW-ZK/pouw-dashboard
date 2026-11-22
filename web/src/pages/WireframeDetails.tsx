import { Link, useParams, useSearchParams } from "react-router-dom";
import { useBlockDetail } from "../features/details/api";
import {
  AddressLink,
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
  SectionHeader,
} from "../components/ui";
import { date, number, shorten } from "../lib/formatters";
import { showPouw } from "../lib/config";
// The shared contract returns up to 100 nested entries. Page that result locally
// instead of sending cursor variables/documents outside the upstream allow-list.
function useEntryPage(key: string, limit: number) {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key) ?? "1";
  const page = /^\d{1,5}$/.test(raw) && Number(raw) > 0 ? Number(raw) : 1;
  return {
    page, offset: (page - 1) * limit,
    change(next: number) {
      setParams((current) => {
        const result = new URLSearchParams(current);
        if (next <= 1) result.delete(key);
        else result.set(key, String(next));
        return result;
      });
    },
  };
}

export function BlockDetailsPage() {
  const { id = "" } = useParams();
  const limit = 6;
  const proofs = useEntryPage("proofPage", limit);
  const transfers = useEntryPage("transferPage", limit);
  const registrations = useEntryPage("registrationPage", limit);
  const query = useBlockDetail(id);
  const block = query.data?.blocks[0];
  const proofRows = block?.proofs.slice(proofs.offset, proofs.offset + limit) ?? [];
  const transferRows = block?.transfers.slice(transfers.offset, transfers.offset + limit) ?? [];
  const registrationRows = block?.registrations.slice(registrations.offset, registrations.offset + limit) ?? [];
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
          <h1>Block #{number(block.height)}</h1>
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
                    {BigInt(block.height) > 0n && block.prev_hash ? (
                      <Link
                        to={`/blocks/${encodeURIComponent(block.prev_hash)}`}
                      >
                        #{number(BigInt(block.height) - 1n)}
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
          {block.transfers.length >= 100 && <p>This view shows up to 100 transfers from this block.</p>}
          <div className="split-tables">
            {showPouw && <section>
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
              {(proofs.page > 1 || block.proofs.length > proofs.offset + limit) && (
                <Pagination
                  page={proofs.page}
                  hasNext={block.proofs.length > proofs.offset + limit}
                  onChange={proofs.change}
                />
              )}
            </section>}
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
              {(transfers.page > 1 || block.transfers.length > transfers.offset + limit) && (
                <Pagination
                  page={transfers.page}
                  hasNext={block.transfers.length > transfers.offset + limit}
                  onChange={transfers.change}
                />
              )}
            </section>
          </div>
          {showPouw && <section className="detail-section">
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
            {(registrations.page > 1 || block.registrations.length > registrations.offset + limit) && (
              <Pagination
                page={registrations.page}
                hasNext={block.registrations.length > registrations.offset + limit}
                onChange={registrations.change}
              />
            )}
          </section>}
        </>
      )}
    </div>
  );
}
