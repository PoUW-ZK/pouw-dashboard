import { useExplorerQuery } from "../../lib/useExplorerQuery";
import { heightCursor } from "../../lib/usePage";
import { showPouw } from "../../lib/config";
import type { ChainNumber } from "../../lib/formatters";
import type { Block } from "../blocks/api";

export interface BlockDetail extends Omit<Block, "transfer_count" | "registration_count" | "proof_count"> {
  prev_hash: string;
  difficulty: ChainNumber;
  bucket_id: ChainNumber;
  bucket_count: ChainNumber;
  canonical: boolean;
  tx_root: string;
  size_bytes: ChainNumber;
  fee_total: ChainNumber;
  transfers: {
    txid: string;
    sender: string;
    recipient: string;
    amount: ChainNumber;
    fee: ChainNumber;
    sort_key: string;
  }[];
  registrations: {
    circuit_id: string;
    txid: string;
    proof_system: string;
    registrant: string;
    fee: ChainNumber;
    sort_key: string;
  }[];
  proofs: {
    proof_hash: string;
    circuit_id: string;
    fee: ChainNumber;
    client: string;
    usage_counter: ChainNumber;
    sort_key: string;
  }[];
}

export function useBlockDetail(id: string) {
  const byHeight = /^\d{1,18}$/.test(id);
  const query = useExplorerQuery<{ blocks: BlockDetail[] }>(byHeight ? "BlockByHeight" : "BlockByHash", byHeight ? { height: id } : { hash: id });
  return {
    ...query,
    data: query.data && { blocks: query.data.blocks.map((block) => ({
      ...block,
      transfer_count: block.transfers.length,
      registration_count: block.registrations.length,
      proof_count: block.proofs.length,
    })) },
  };
}

export type RecordKind = "circuits" | "transactions" | "proofs";
export type DetailKind = RecordKind | "blocks" | "addresses";
export type Value = string | number | boolean | null;
type Details = Record<string, Record<string, Value>[]>;

export function useDetail(kind: RecordKind, id: string) {
  const name = kind === "transactions" ? "Transaction" : kind === "circuits" ? "Circuit" : "Proof";
  const variables = kind === "transactions" ? { txid: id } : kind === "circuits" ? { circuitId: id } : { proofHash: id };
  const query = useExplorerQuery<Details>(name, variables);
  const data = query.data;
  return {
    ...query,
    data: data && kind === "transactions"
      ? { transfers: data.transfers, ...(showPouw ? { registrations: data.circuits, proofs: data.proofs } : {}) }
      : data,
  };
}

interface Address {
  address: string;
  balance?: ChainNumber;
  mining_rewards?: ChainNumber;
  txs_sent: ChainNumber;
  txs_received: ChainNumber;
  proof_requests: ChainNumber;
  blocks_mined: ChainNumber;
}

export function useAddress(id: string) {
  return useExplorerQuery<{ addresses: Address[] }>("Address", { address: id });
}

interface AddressTransaction {
  txid: string;
  kind: string;
  direction: string;
  height: ChainNumber;
  time: string;
  amount: ChainNumber | null;
  fee: ChainNumber;
  sort_key: string;
}

export function useAddressHistory(id: string, before = "~", limit = 20) {
  return useExplorerQuery<{ address_txs: AddressTransaction[] }>("AddressTxs", { address: id, before, limit: limit + 1, filter: showPouw ? {} : { kind: { _eq: "transfer" } } });
}

export function useMinedBlocks(id: string, before?: string, limit = 20) {
  return useExplorerQuery<{ blocks: Block[] }>("MinedBlocks", { miner: id, before: heightCursor(before), limit: limit + 1 });
}

interface CircuitProof {
  proof_hash: string;
  height: ChainNumber;
  time: string;
  client: string;
  fee: ChainNumber;
  sort_key: string;
}

export function useCircuitProofs(id: string, before = "~", limit = 20) {
  return useExplorerQuery<{ proofs: CircuitProof[] }>("CircuitProofs", { circuitId: id, before, limit: limit + 1 });
}
