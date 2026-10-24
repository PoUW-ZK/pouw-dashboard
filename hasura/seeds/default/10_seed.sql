-- Small consistent chain for local Hasura and the frontend mock.
-- Ids are sha256 of a readable label, so they are stable between runs.
CREATE OR REPLACE FUNCTION pg_temp.h(label text) RETURNS bytea LANGUAGE sql IMMUTABLE
    RETURN sha256(convert_to(label, 'UTF8'));
CREATE OR REPLACE FUNCTION pg_temp.f(label text) RETURNS bytea LANGUAGE sql IMMUTABLE
    RETURN substring(sha256(convert_to(label, 'UTF8')) FROM 1 FOR 31);

INSERT INTO miners (address, first_seen) VALUES
  (pg_temp.h('miner-a'), '2026-10-19 14:00:00+00'),
  (pg_temp.h('miner-b'), '2026-10-19 14:00:12+00');

-- heights 0..3 canonical, a competing block at height 3 that lost (orphaned)
INSERT INTO blocks (hash, height, prev_hash, block_time, miner, difficulty, bucket_count, bucket_id,
                    leaf_count, tx_root, size_bytes, canonical) VALUES
  (pg_temp.h('blk-0'),  0, '\x0000000000000000000000000000000000000000000000000000000000000000',
   '2026-10-19 14:00:00+00', pg_temp.h('miner-a'), 1000, 1, 0, 0, pg_temp.h('root-0'), 136, true),
  (pg_temp.h('blk-1'),  1, pg_temp.h('blk-0'), '2026-10-19 14:00:12+00', pg_temp.h('miner-b'), 1000, 1, 0, 2, pg_temp.h('root-1'), 1290, true),
  (pg_temp.h('blk-2'),  2, pg_temp.h('blk-1'), '2026-10-19 14:00:24+00', pg_temp.h('miner-a'), 1000, 2, 1, 3, pg_temp.h('root-2'), 1650, true),
  (pg_temp.h('blk-3'),  3, pg_temp.h('blk-2'), '2026-10-19 14:00:36+00', pg_temp.h('miner-a'), 1000, 2, 0, 2, pg_temp.h('root-3'), 920,  true),
  (pg_temp.h('blk-3b'), 3, pg_temp.h('blk-2'), '2026-10-19 14:00:37+00', pg_temp.h('miner-b'), 1000, 2, 0, 1, pg_temp.h('root-3b'), 560, false);

-- two circuits registered in block 1
INSERT INTO circuits (circuit_id, proof_system, constraint_count, verifying_key_bytes, circuit_bytes,
                      registrant, fee, registered_block, registered_height) VALUES
  (pg_temp.h('reg-sha'),   'groth16',   65536,  1032, 2097152, pg_temp.h('client-c'), 500, pg_temp.h('blk-1'), 1),
  (pg_temp.h('reg-image'), 'plonk_kzg', 262144, 2304, 8388608, pg_temp.h('client-c'), 500, pg_temp.h('blk-1'), 1);

INSERT INTO transfers (block_hash, position, txid, sender, recipient, amount, fee, nonce) VALUES
  (pg_temp.h('blk-2'),  0, pg_temp.h('tx-pay-1'), pg_temp.h('miner-a'),  pg_temp.h('client-d'), 50000, 10, 0),
  (pg_temp.h('blk-3'),  0, pg_temp.h('tx-pay-2'), pg_temp.h('client-d'), pg_temp.h('client-c'), 2500,  10, 1),
  (pg_temp.h('blk-3b'), 0, pg_temp.h('tx-pay-2'), pg_temp.h('client-d'), pg_temp.h('client-c'), 2500,  10, 1);

INSERT INTO proof_txs (block_hash, position, proof_hash, request_txid, circuit_id, requester, fee, nonce,
                       usage_counter, proof_bytes, witness_bytes, witness_sha256, public_input_count, eta, mask) VALUES
  (pg_temp.h('blk-2'), 0, pg_temp.h('proof-1'), pg_temp.h('req-1'), pg_temp.h('reg-sha'),   pg_temp.h('client-d'), 120, 0, 0, 192, 4096,  pg_temp.h('wit-1'), 2, pg_temp.f('eta-1'), pg_temp.f('mask-1')),
  (pg_temp.h('blk-2'), 1, pg_temp.h('proof-2'), pg_temp.h('req-2'), pg_temp.h('reg-image'), pg_temp.h('client-c'), 95,  2, 0, 768, 65536, pg_temp.h('wit-2'), 3, pg_temp.f('eta-2'), pg_temp.f('mask-2')),
  (pg_temp.h('blk-3'), 1, pg_temp.h('proof-3'), pg_temp.h('req-3'), pg_temp.h('reg-sha'),   pg_temp.h('client-c'), 110, 3, 1, 192, 4096,  pg_temp.h('wit-3'), 2, pg_temp.f('eta-3'), pg_temp.f('mask-3'));
