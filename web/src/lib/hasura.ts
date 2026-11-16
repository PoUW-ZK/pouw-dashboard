import { mockQuery } from "../mocks";

type GraphQLResult<TData> = {
  data?: TData;
  errors?: Array<{ message: string }>;
};

export async function hasuraQuery<TData>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<TData> {
  if (import.meta.env.VITE_USE_MOCKS !== "false") {
    return mockQuery(query, variables) as TData;
  }

  const response = await fetch("/v1/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const result = (await response.json()) as GraphQLResult<TData>;

  if (!response.ok || result.errors?.length) {
    const message = result.errors?.map((error) => error.message).join("; ");
    throw new Error(message || `Hasura request failed (${response.status})`);
  }

  if (!result.data) {
    throw new Error("Hasura returned no data");
  }

  return result.data;
}
