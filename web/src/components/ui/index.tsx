import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { shorten } from "../../lib/formatters";
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {action}
    </div>
  );
}
export function StatCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <article className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </article>
  );
}
export function StatsGrid({ children }: { children: ReactNode }) {
  return <div className="stats-grid">{children}</div>;
}
export function AddressLink({ address }: { address: string }) {
  return (
    <Link
      className="mono"
      title={address}
      to={`/addresses/${encodeURIComponent(address)}`}
    >
      {shorten(address)}
    </Link>
  );
}
export function LoadingState() {
  return (
    <div className="feedback" role="status">
      <span className="spinner" /> Loading explorer data…
    </div>
  );
}
export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="feedback error" role="alert">
      <strong>Unable to load explorer data.</strong>
      <p>Check that the explorer API is running, then try again.</p>
      <button onClick={retry}>Try again ↻</button>
    </div>
  );
}
export function EmptyState({
  message = "No records found.",
}: {
  message?: string;
}) {
  return <div className="feedback">{message}</div>;
}
export function Pagination({
  page,
  hasNext,
  onChange,
}: {
  page: number;
  hasNext: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="Pagination">
      <button disabled={page === 1} onClick={() => onChange(page - 1)}>
        ← Previous
      </button>
      <span>Page {page}</span>
      <button disabled={!hasNext} onClick={() => onChange(page + 1)}>
        Next →
      </button>
    </nav>
  );
}
