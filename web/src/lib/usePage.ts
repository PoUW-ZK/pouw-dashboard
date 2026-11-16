import { useSearchParams } from "react-router-dom";

export function useCursorPage(key = "before") {
  const [params, setParams] = useSearchParams();
  const cursors = params.getAll(key).filter(Boolean);

  return {
    page: cursors.length + 1,
    before: cursors.at(-1),
    change(page: number, nextCursor?: string | number) {
      if (page > cursors.length + 1 && nextCursor == null) return;

      setParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("page");
        next.delete(key);
        const previous = current.getAll(key).filter(Boolean);
        if (page > previous.length + 1 && nextCursor != null) {
          previous.push(String(nextCursor));
        }
        for (const cursor of previous.slice(0, page - 1)) {
          next.append(key, cursor);
        }
        return next;
      });
    },
  };
}

export function heightCursor(before?: string) {
  const height = before == null ? NaN : Number(before);
  return Number.isSafeInteger(height) && height >= 0
    ? height
    : Number.MAX_SAFE_INTEGER;
}
