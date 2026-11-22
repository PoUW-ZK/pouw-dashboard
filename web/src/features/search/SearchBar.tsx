import { useNavigate } from "react-router-dom";
import { showPouw } from "../../lib/config";
export function SearchBar({
  initialValue = "",
  compact = false,
}: {
  initialValue?: string;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <form
      className={compact ? "search-bar header-search" : "search-bar"}
      onSubmit={(event) => {
        event.preventDefault();
        const q = new FormData(event.currentTarget).get("q")?.toString().trim();
        if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <input
        key={initialValue}
        name="q"
        aria-label="Search the explorer"
        placeholder={
          compact
            ? "Search explorer…"
            : showPouw ? "Search by block, transaction, address or circuit…" : "Block height, hash, transaction or address…"
        }
        defaultValue={initialValue}
        required
      />
      <button type="submit" aria-label="Submit search">Search</button>
    </form>
  );
}
