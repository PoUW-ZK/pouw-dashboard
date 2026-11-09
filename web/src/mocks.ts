// Deterministic presentation data. Set VITE_USE_MOCKS=false to use Hasura.
const hex = (n: number) => n.toString(16).padStart(64, "0");
const addresses = [
  `addr:72a${"0".repeat(58)}9f2`,
  `addr:4ac${"0".repeat(58)}17e`,
  `addr:0b3${"0".repeat(58)}8ca`,
];

const blocks = Array.from({ length: 36 }, (_, i) => ({
  hash: `blk:${hex(12567 - i)}`,
  height: 12567 - i,
  prev_hash: `blk:${hex(12566 - i)}`,
  miner: addresses[i % addresses.length],
  transfer_count: [15, 4, 5, 12][i % 4],
  registration_count: i === 35 ? 6 : 0,
  proof_count: i === 35 ? 0 : [12, 8, 15, 6][i % 4],
  time: new Date(Date.UTC(2026, 10, 2, 14, 32, 18) - i * 12400).toISOString(),
  difficulty: 2048,
  bucket_id: 3,
  bucket_count: 8,
  tx_root: hex(20000 + i),
  size_bytes: 1024 + i * 12,
  canonical: true,
}));

const registrationBlock = blocks.at(-1)!;
const circuits = Array.from({ length: 6 }, (_, i) => ({
  circuit_id: `circ:${hex(18 + i)}`,
  txid: `tx:${hex(800 + i)}`,
  proof_system: ["groth16", "plonk_kzg", "marlin"][i % 3],
  constraint_count: 400000 + i * 100000,
  registrant: addresses[i % addresses.length],
  registered_block: registrationBlock.hash,
  registered_height: registrationBlock.height,
  registered_time: registrationBlock.time,
  fee: 100,
  canonical: true,
  sort_key: `${registrationBlock.height}.1.${i}`,
})).reverse();

const transfers = blocks.flatMap((block, i) =>
  Array.from({ length: block.transfer_count }, (_, position) => ({
    txid: `tx:${hex(100 + i * 16 + position)}`,
    sender: addresses[position % addresses.length],
    recipient: addresses[(position + 1) % addresses.length],
    amount: [10, 2, 10, 10, 12, 10, 5, 1][position % 8],
    fee: 1,
    nonce: i * 16 + position,
    block_hash: block.hash,
    height: block.height,
    time: block.time,
    canonical: true,
    sort_key: `${block.height}.0.${String(position).padStart(2, "0")}`,
  })),
);

const proofs = blocks.flatMap((block, i) =>
  Array.from({ length: block.proof_count }, (_, position) => {
    const index = i * 16 + position;
    const circuit = circuits[position % circuits.length];
    return {
      proof_hash: `proof:${hex(200 + index)}`,
      request_txid: `tx:${hex(300 + position + i * 16 + (i ? 1000 : 0))}`,
      circuit_id: circuit.circuit_id,
      fee: [4, 8, 10, 3, 5, 11][position % 6],
      block_hash: block.hash,
      height: block.height,
      time: block.time,
      miner: block.miner,
      client: addresses[(position + 1) % addresses.length],
      proof_system: circuit.proof_system,
      constraint_count: circuit.constraint_count,
      usage_counter: position,
      proof_bytes: 192,
      witness_bytes: 4096,
      public_input_count: 2,
      eta: hex(index + 1).slice(2),
      mask: hex(index + 1000).slice(2),
      canonical: true,
      sort_key: `${block.height}.2.${String(position).padStart(2, "0")}`,
    };
  }),
);

const orphan = {
  ...blocks[0],
  hash: `blk:${hex(20000)}`,
  canonical: false,
  transfer_count: 1,
  proof_count: 0,
};
const orphanTransfer = {
  ...transfers[0],
  block_hash: orphan.hash,
  canonical: false,
};
const allTransfers = [...transfers, orphanTransfer];

function pageBySortKey<T extends { sort_key: string }>(
  rows: T[],
  before: unknown,
  limit: number,
) {
  return rows
    .filter((row) => row.sort_key < String(before))
    .sort((a, b) => b.sort_key.localeCompare(a.sort_key))
    .slice(0, limit);
}

function blockEntries<T extends { sort_key: string }>(
  rows: T[],
  after: unknown,
  limit: unknown,
) {
  return rows
    .filter((row) => row.sort_key > String(after))
    .sort((a, b) => a.sort_key.localeCompare(b.sort_key))
    .slice(0, Number(limit));
}

function addressHistory(id: string) {
  return [
    ...transfers
      .filter((tx) => tx.sender === id || tx.recipient === id)
      .map((tx) => ({
        ...tx,
        kind: "transfer",
        direction: tx.sender === id ? "out" : "in",
      })),
    ...circuits
      .filter((row) => row.registrant === id)
      .map((row) => ({
        ...row,
        kind: "register_circuit",
        direction: "out",
        height: row.registered_height,
        time: row.registered_time,
        amount: null,
      })),
    ...proofs
      .filter((row) => row.client === id)
      .map((row) => ({
        ...row,
        txid: row.request_txid,
        kind: "proof_request",
        direction: "out",
        amount: null,
      })),
  ];
}

export function mockQuery(
  query: string,
  variables: Record<string, unknown>,
): unknown {
  const id = String(variables.id);
  const limit = Number(variables.limit);
  const before = variables.before;

  if (query.includes("query Overview")) {
    return {
      stats: [
        {
          indexed_height: 12567,
          bucket_count: 8,
          circuit_count: 132,
          proof_count: 8912,
          avg_block_interval_s: 12.4,
        },
      ],
      useful_work: [
        { proof_system: "groth16", proof_count: 5400, useful_work: 1400000 },
        { proof_system: "plonk_kzg", proof_count: 2800, useful_work: 800000 },
        { proof_system: "marlin", proof_count: 712, useful_work: 200000 },
      ],
    };
  }
  if (query.includes("query Miners")) {
    return {
      miner_shares: addresses.map((miner, i) => ({
        miner,
        blocks: [12, 9, 7][i],
        share: [0.4286, 0.3214, 0.25][i],
        last_block_height: 12567 - i,
      })),
    };
  }
  if (query.includes("query Blocks(") || query.includes("query MinedBlocks(")) {
    return {
      blocks: blocks
        .filter(
          (block) =>
            block.height < Number(before) &&
            (variables.id == null || block.miner === id),
        )
        .slice(0, limit),
    };
  }
  if (query.includes("query Circuits(")) {
    return {
      circuits: pageBySortKey(circuits, before, limit).map(
        circuitWithProofStats,
      ),
    };
  }
  if (query.includes("query CircuitProofs(")) {
    return {
      proofs: pageBySortKey(
        proofs.filter((row) => row.circuit_id === id),
        before,
        limit,
      ),
    };
  }
  if (query.includes("query Search")) {
    const q = String(variables.q);
    const block = /^\d{1,18}$/.test(q)
      ? blocks.find((row) => row.height === Number(q))
      : [...blocks, orphan].find((row) => row.hash === q);
    if (block)
      return {
        search: [{ kind: "block", id: block.hash, height: block.height }],
      };

    return {
      search: [
        ...circuits
          .filter((row) => row.circuit_id === q || row.txid === q)
          .map((row) => ({
            kind: "circuit",
            id: row.circuit_id,
            height: row.registered_height,
          })),
        ...addresses
          .filter((address) => address === q)
          .map((address) => ({
            kind: "address",
            id: address,
            height: registrationBlock.height,
          })),
        ...allTransfers
          .filter((row) => row.txid === q)
          .map((row) => ({
            kind: "transfer",
            id: row.txid,
            height: row.height,
          })),
        ...proofs
          .filter((row) => row.proof_hash === q || row.request_txid === q)
          .map((row) => ({
            kind: "proof",
            id: row.proof_hash,
            height: row.height,
          })),
      ],
    };
  }
  if (query.includes("query BlockBy")) {
    const block =
      variables.height == null
        ? [...blocks, orphan].find((row) => row.hash === id)
        : blocks.find((row) => row.height === Number(variables.height));
    if (!block) return { blocks: [] };
    const blockTransfers = allTransfers.filter(
      (row) => row.block_hash === block.hash,
    );
    const blockProofs = proofs.filter((row) => row.block_hash === block.hash);
    const registrations = circuits.filter(
      (row) => row.registered_block === block.hash,
    );
    return {
      blocks: [
        {
          ...block,
          transfers: blockEntries(
            blockTransfers,
            variables.transferAfter,
            variables.entryLimit,
          ),
          proofs: blockEntries(
            blockProofs,
            variables.proofAfter,
            variables.entryLimit,
          ),
          registrations: blockEntries(
            registrations,
            variables.registrationAfter,
            variables.entryLimit,
          ),
          fee_total: [
            ...blockTransfers,
            ...blockProofs,
            ...registrations,
          ].reduce((total, row) => total + row.fee, 0),
        },
      ],
    };
  }
  if (query.includes("query Address(")) {
    if (!addresses.includes(id)) return { addresses: [] };
    const history = addressHistory(id);
    return {
      addresses: [
        {
          address: id,
          balance: 125.5,
          mining_rewards: 24,
          txs_sent: history.filter(
            (row) => row.direction === "out" && row.kind !== "proof_request",
          ).length,
          txs_received: history.filter((row) => row.direction === "in").length,
          proof_requests: history.filter((row) => row.kind === "proof_request")
            .length,
          blocks_mined: blocks.filter((row) => row.miner === id).length,
        },
      ],
    };
  }
  if (query.includes("query AddressTxs(")) {
    return { address_txs: pageBySortKey(addressHistory(id), before, limit) };
  }
  if (query.includes("transfers(where:")) {
    return {
      transfers: allTransfers.filter((row) => row.txid === id),
      registrations: circuits.filter((row) => row.txid === id),
      proofs: proofs
        .filter((row) => row.request_txid === id)
        .map(({ proof_hash, height, canonical }) => ({
          proof_hash,
          height,
          canonical,
        })),
    };
  }
  if (query.includes("proofs(where:")) {
    return {
      proofs: proofs
        .filter((row) => row.proof_hash === id)
        .map(({ sort_key: _sortKey, ...row }) => row),
    };
  }
  if (query.includes("circuits(where:")) {
    return {
      circuits: circuits
        .filter((row) => row.circuit_id === id)
        .map(circuitWithProofStats)
        .map(({ sort_key: _sortKey, ...row }) => row),
    };
  }
  throw new Error("No mock response for this operation");
}

function circuitWithProofStats(circuit: (typeof circuits)[number]) {
  const matching = proofs.filter(
    (row) => row.circuit_id === circuit.circuit_id,
  );
  return {
    ...circuit,
    proof_count: matching.length,
    last_proof_height: matching[0]?.height ?? null,
    useful_work: matching.length * circuit.constraint_count,
  };
}
