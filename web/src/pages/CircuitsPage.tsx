import { useCircuits } from "../features/circuits/api";
import { Link } from "react-router-dom";
import { PageTitle } from "./PageTitle";
import { number, shorten } from "../lib/formatters";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
  AddressLink,
} from "../components/ui";
import { useCursorPage } from "../lib/usePage";
export function CircuitsPage() {
  const { page, before, change } = useCursorPage();
  const limit = 20;
  const query = useCircuits(before, limit);
  const rows = query.data?.circuits.slice(0, limit) ?? [];
  return (
    <div className="page">
      <PageTitle
        title="Circuits"
        description="Discover registered circuits powering useful computation."
      />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState retry={() => void query.refetch()} />
      ) : (
        <section>
          {!rows.length ? (
            <EmptyState />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Circuit</th>
                    <th>Proof system</th>
                    <th>Constraints</th>
                    <th>Proofs</th>
                    <th>Registrant</th>
                    <th>Registered height</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.circuit_id}>
                      <td>
                        <Link
                          className="mono"
                          title={row.circuit_id}
                          to={`/circuits/${row.circuit_id}`}
                        >
                          {shorten(row.circuit_id)}
                        </Link>
                      </td>
                      <td>
                        <span className="proof-count">{row.proof_system}</span>
                      </td>
                      <td>{number(row.constraint_count)}</td>
                      <td>{number(row.proof_count)}</td>
                      <td>
                        <AddressLink address={row.registrant} />
                      </td>
                      <td>
                        <Link to={`/block/${row.registered_height}`}>
                          {number(row.registered_height)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={page}
            hasNext={query.data.circuits.length > limit}
            onChange={(next) => change(next, rows.at(-1)?.sort_key)}
          />
        </section>
      )}
    </div>
  );
}
