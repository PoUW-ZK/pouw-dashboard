import { Link, useParams } from "react-router-dom";
import { BlockDetailsPage } from "./WireframeDetails";
import { AddressDetailsPage } from "./AddressDetailsPage";
import { useCircuitProofs, useDetail } from "../features/details/api";
import type { DetailKind, RecordKind, Value } from "../features/details/api";
import { PageTitle } from "./PageTitle";
import { date, number, shorten } from "../lib/formatters";
import { useCursorPage } from "../lib/usePage";
import {
  AddressLink,
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
  SectionHeader,
} from "../components/ui";

const idRoutes: Record<string, string> = {
  blk: "blocks",
  tx: "transactions",
  proof: "proof",
  circ: "circuits",
  addr: "addresses",
};

const fieldLabels: Record<string, string> = {
  eta: "Eta",
  txid: "Transaction ID",
  request_txid: "Proof request ID",
  proof_hash: "Proof hash",
  public_input_count: "Public input count",
  canonical: "Chain status",
};

const proofExplanations: Record<string, string> = {
  eta: "Binds this proof to its block and the proofs that precede it.",
  mask: "Makes the proof input specific to the miner, circuit and usage counter.",
  usage_counter: "Counts prior proofs by this miner for this circuit.",
};

function FieldValue({ field, value }: { field: string; value: Value }) {
  if (value == null) return <>—</>;
  if (field === "canonical") return <>{value ? "Canonical" : "Orphaned"}</>;
  if (typeof value === "boolean") return <>{value ? "Yes" : "No"}</>;
  if (typeof value === "number") return <>{number(value)}</>;
  if (field === "time" || field === "registered_time")
    return <>{date(value)}</>;

  const route = idRoutes[value.split(":")[0]];
  return route ? (
    <Link className="mono" to={`/${route}/${encodeURIComponent(value)}`}>
      {value}
    </Link>
  ) : (
    <span>{value}</span>
  );
}

function CircuitProofHistory({ id }: { id: string }) {
  const { before, page, change } = useCursorPage("proofBefore");
  const limit = 20;
  const query = useCircuitProofs(id, before, limit);
  const rows = query.data?.proofs.slice(0, limit) ?? [];

  return (
    <section className="detail-section">
      <SectionHeader title="Proof history" />
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
                    <th>Proof</th>
                    <th>Block</th>
                    <th>Time</th>
                    <th>Client</th>
                    <th>Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.sort_key}>
                      <td>
                        <Link
                          title={row.proof_hash}
                          to={`/proof/${row.proof_hash}`}
                        >
                          {shorten(row.proof_hash)}
                        </Link>
                      </td>
                      <td>
                        <Link to={`/block/${row.height}`}>#{row.height}</Link>
                      </td>
                      <td>{date(row.time)}</td>
                      <td>
                        <AddressLink address={row.client} />
                      </td>
                      <td>{number(row.fee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No canonical proofs found for this circuit." />
          )}
          {(page > 1 || query.data.proofs.length > limit) && (
            <Pagination
              page={page}
              hasNext={query.data.proofs.length > limit}
              onChange={(next) => change(next, rows.at(-1)?.sort_key)}
            />
          )}
        </>
      )}
    </section>
  );
}

function GenericDetailsPage({ kind, id }: { kind: RecordKind; id: string }) {
  const query = useDetail(kind, id);
  const records = Object.entries(query.data ?? {}).flatMap(([key, rows]) =>
    rows.map((row) => ({ key, row })),
  );
  const titles: Record<string, string> = {
    transfers: "Coin transfer",
    registrations: "Circuit registration",
    circuits: "Circuit information",
    proofs: kind === "proofs" ? "Proof information" : "Answering proof",
  };

  return (
    <div className="page">
      <Link className="back-link" to={kind === "circuits" ? "/circuits" : "/"}>
        ← Back to explorer
      </Link>
      <PageTitle
        title={
          {
            circuits: "Circuit details",
            transactions: "Transaction details",
            proofs: "Proof transaction details",
          }[kind]
        }
        description={id}
      />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState retry={() => void query.refetch()} />
      ) : !records.length ? (
        <EmptyState message="This record was not found in the index." />
      ) : (
        <>
          {records.map(({ key, row }, i) => (
            <section className="detail-panel" key={`${key}-${i}`}>
              <SectionHeader title={titles[key] ?? key} />
              <dl>
                {Object.entries(row).map(([field, value]) => (
                  <div key={field}>
                    <dt>{fieldLabels[field] ?? field.replaceAll("_", " ")}</dt>
                    <dd>
                      <FieldValue field={field} value={value} />
                      {kind === "proofs" && proofExplanations[field] && (
                        <p>{proofExplanations[field]}</p>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          {kind === "circuits" && <CircuitProofHistory id={id} />}
        </>
      )}
    </div>
  );
}

export function DetailsPage({ kind }: { kind: DetailKind }) {
  const { id = "" } = useParams();
  if (kind === "blocks") return <BlockDetailsPage key={id} />;
  if (kind === "addresses") return <AddressDetailsPage />;
  const recordKind =
    kind === "transactions" && id.startsWith("proof:") ? "proofs" : kind;
  return <GenericDetailsPage kind={recordKind} id={id} />;
}
