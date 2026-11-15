import { useQuery } from "@tanstack/react-query";
import { hasuraQuery } from "../../lib/hasura";
import { heightCursor } from "../../lib/usePage";
import { blockFields } from "../blocks/api";
import type { Block } from "../blocks/api";

const blockDetailFields = `
  ${blockFields} prev_hash difficulty bucket_count bucket_id tx_root size_bytes canonical fee_total
  transfers(where: {sort_key: {_gt: $transferAfter}}, order_by: {sort_key: asc}, limit: $entryLimit) { txid sender recipient amount fee sort_key }
  registrations(where: {sort_key: {_gt: $registrationAfter}}, order_by: {sort_key: asc}, limit: $entryLimit) { circuit_id txid proof_system registrant fee sort_key }
  proofs(where: {sort_key: {_gt: $proofAfter}}, order_by: {sort_key: asc}, limit: $entryLimit) { proof_hash circuit_id fee client usage_counter sort_key }
`;

export interface BlockDetail extends Block {
  prev_hash: string;
  difficulty: number;
  bucket_id: number;
  bucket_count: number;
  canonical: boolean;
  tx_root: string;
  size_bytes: number;
  fee_total: number;
  transfers: {
    txid: string;
    sender: string;
    recipient: string;
    amount: number;
    fee: number;
    sort_key: string;
  }[];
  registrations: {
    circuit_id: string;
    txid: string;
    proof_system: string;
    registrant: string;
    fee: number;
    sort_key: string;
  }[];
  proofs: {
    proof_hash: string;
    circuit_id: string;
    fee: number;
    client: string;
    usage_counter: number;
    sort_key: string;
  }[];
}

const blockEntryVariables =
  "$transferAfter: String!, $registrationAfter: String!, $proofAfter: String!, $entryLimit: Int!";

export function useBlockDetail(
  id: string,
  transferAfter = "",
  registrationAfter = "",
  proofAfter = "",
  limit = 6,
) {
  const byHeight = /^\d{1,18}$/.test(id);
  return useQuery({
    queryKey: [
      "block-detail",
      id,
      transferAfter,
      registrationAfter,
      proofAfter,
      limit,
    ],
    queryFn: () =>
      hasuraQuery<{ blocks: BlockDetail[] }>(
        byHeight
          ? `query BlockByHeight($height: bigint!, ${blockEntryVariables}) { blocks(where: {height: {_eq: $height}, canonical: {_eq: true}}) { ${blockDetailFields} } }`
          : `query BlockByHash($id: String!, ${blockEntryVariables}) { blocks(where: {hash: {_eq: $id}}) { ${blockDetailFields} } }`,
        {
          ...(byHeight ? { height: id } : { id }),
          transferAfter,
          registrationAfter,
          proofAfter,
          entryLimit: limit + 1,
        },
      ),
  });
}

const detailQueries = {
  circuits:
    "circuits(where: {circuit_id: {_eq: $id}}, limit: 1) { circuit_id txid proof_system constraint_count verifying_key_bytes circuit_bytes registrant fee registered_block registered_height registered_time canonical proof_count last_proof_height useful_work }",
  transactions:
    "transfers(where: {txid: {_eq: $id}}, order_by: {canonical: desc}) { txid block_hash height time sender recipient amount fee nonce canonical } registrations: circuits(where: {txid: {_eq: $id}}) { circuit_id txid proof_system constraint_count registrant fee registered_block registered_height registered_time canonical } proofs(where: {request_txid: {_eq: $id}}, order_by: {canonical: desc}) { proof_hash height canonical }",
  proofs:
    "proofs(where: {proof_hash: {_eq: $id}}, order_by: {canonical: desc}) { proof_hash request_txid block_hash height time miner client circuit_id proof_system constraint_count fee nonce usage_counter proof_bytes witness_bytes witness_sha256 public_input_count eta mask canonical }",
};

export type RecordKind = keyof typeof detailQueries;
export type DetailKind = RecordKind | "blocks" | "addresses";
export type Value = string | number | boolean | null;

export function useDetail(kind: RecordKind, id: string) {
  return useQuery({
    queryKey: ["details", kind, id],
    queryFn: () =>
      hasuraQuery<Record<string, Record<string, Value>[]>>(
        `query Detail($id: String!) { ${detailQueries[kind]} }`,
        { id },
      ),
  });
}

interface Address {
  address: string;
  balance?: number;
  mining_rewards?: number;
  txs_sent: number;
  txs_received: number;
  proof_requests: number;
  blocks_mined: number;
}

export function useAddress(id: string) {
  return useQuery({
    queryKey: ["address", id],
    queryFn: () =>
      hasuraQuery<{ addresses: Address[] }>(
        "query Address($id: String!) { addresses(where: {address: {_eq: $id}}) { address txs_sent txs_received proof_requests circuits_registered blocks_mined first_seen_height } }",
        { id },
      ),
  });
}

interface AddressTransaction {
  txid: string;
  kind: string;
  direction: string;
  height: number;
  time: string;
  amount: number | null;
  fee: number;
  sort_key: string;
}

export function useAddressHistory(id: string, before = "~", limit = 20) {
  return useQuery({
    queryKey: ["address-history", id, before, limit],
    queryFn: () =>
      hasuraQuery<{ address_txs: AddressTransaction[] }>(
        "query AddressTxs($id: String!, $before: String!, $limit: Int!) { address_txs(where: {address: {_eq: $id}, sort_key: {_lt: $before}}, order_by: {sort_key: desc}, limit: $limit) { txid kind direction height time amount fee sort_key } }",
        { id, before, limit: limit + 1 },
      ),
  });
}

export function useMinedBlocks(id: string, before?: string, limit = 20) {
  return useQuery({
    queryKey: ["mined-blocks", id, before, limit],
    queryFn: () =>
      hasuraQuery<{ blocks: Block[] }>(
        `query MinedBlocks($id: String!, $before: bigint!, $limit: Int!) { blocks(where: {miner: {_eq: $id}, canonical: {_eq: true}, height: {_lt: $before}}, order_by: {height: desc}, limit: $limit) { ${blockFields} } }`,
        { id, before: heightCursor(before), limit: limit + 1 },
      ),
  });
}

interface CircuitProof {
  proof_hash: string;
  height: number;
  time: string;
  client: string;
  fee: number;
  sort_key: string;
}

export function useCircuitProofs(id: string, before = "~", limit = 20) {
  return useQuery({
    queryKey: ["circuit-proofs", id, before, limit],
    queryFn: () =>
      hasuraQuery<{ proofs: CircuitProof[] }>(
        "query CircuitProofs($id: String!, $before: String!, $limit: Int!) { proofs(where: {circuit_id: {_eq: $id}, canonical: {_eq: true}, sort_key: {_lt: $before}}, order_by: {sort_key: desc}, limit: $limit) { proof_hash height time client fee sort_key } }",
        { id, before, limit: limit + 1 },
      ),
  });
}
