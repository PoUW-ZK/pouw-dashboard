import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hasuraQuery } from "./hasura";
import { useMocks } from "./config";
import { liveClient } from "./subscriptions";
import operations from "../graphql/operations.json";

type OperationName = keyof typeof operations.queries;

export function useExplorerQuery<T>(name: OperationName, variables: Record<string, unknown> = {}, enabled = true) {
  const queryClient = useQueryClient();
  const identity = JSON.stringify([name, variables]);
  const [failure, setFailure] = useState<{ identity: string; error: Error }>();
  const [revision, setRevision] = useState(0);
  const subscription = name === "HomeStats" || name === "LatestBlocks" ? operations.subscriptions[name] : undefined;
  const isLive = !useMocks && !!subscription;
  const query = useQuery<T, Error>({
    queryKey: ["explorer", name, variables],
    queryFn: () => hasuraQuery<T>(operations.queries[name], variables),
    enabled: enabled && !isLive,
    ...(isLive ? { staleTime: Infinity } : {}),
  });

  useEffect(() => {
    if (!enabled || !isLive || !subscription) return;
    const [operation, values] = JSON.parse(identity) as [OperationName, Record<string, unknown>];
    return liveClient().subscribe(subscription, values, {
      next: (data) => {
        setFailure(undefined);
        queryClient.setQueryData(["explorer", operation, values], data);
      },
      error: (error) => setFailure({ identity, error }),
    });
  }, [enabled, identity, isLive, queryClient, revision, subscription]);

  const error = failure?.identity === identity ? failure.error : query.error;
  return {
    ...query,
    error,
    isError: !!error,
    isPending: enabled && query.data === undefined && !error,
    refetch: () => {
      setFailure(undefined);
      if (!isLive) return query.refetch();
      setRevision((current) => current + 1);
    },
  };
}
