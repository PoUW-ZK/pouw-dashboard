// Hasura can encode bigint as JSON numbers. Preserve integer tokens beyond 2^53
// before JSON.parse rounds them, without touching quoted IDs or other strings.
export function parseGraphQL<T = unknown>(text: string): T {
  const lossless = text.replace(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, (token) =>
    /^-?\d+$/.test(token) && !Number.isSafeInteger(Number(token)) ? JSON.stringify(token) : token,
  );
  return JSON.parse(lossless) as T;
}
