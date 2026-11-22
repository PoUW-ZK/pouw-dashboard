import { useMining } from "../dashboard/api";
import { configuredMiners } from "./miners";
import { mergeMiners } from "./shares";

export function useMiners() {
  const query = useMining();
  return {
    ...query,
    data: query.data && { miner_shares: mergeMiners(query.data.miner_shares, configuredMiners) },
  };
}
