-- Mock block source for local development (pouw-dashboard#46).
--
-- mock.add_block() appends one fake canonical block on top of the current tip: a random
-- known miner, one transfer between known addresses and one proof transaction for a known
-- circuit, then refreshes the statistics. Run every few seconds by the compose service
-- "mock-blocks" (docker compose --profile mock up -d), so the explorer sees live data
-- without a node.
--
-- Only for the local compose: not a seed (CI runs every file in seeds/), and never on
-- staging. Ids are sha256 of a label with "mock-" and the height, so they never collide
-- with the seed.

CREATE SCHEMA IF NOT EXISTS mock;

CREATE OR REPLACE FUNCTION mock.add_block() RETURNS bigint
    LANGUAGE plpgsql AS $$
DECLARE
    v_tip      blocks%ROWTYPE;
    v_height   bigint;
    v_hash     bytea;
    v_label    text;
    v_miner    bytea;
    v_sender   bytea;
    v_receiver bytea;
    v_circuit  bytea;
    v_client   bytea;
BEGIN
    SELECT * INTO v_tip FROM blocks WHERE canonical ORDER BY height DESC LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'no canonical block: load the seed first (docker compose down -v, then up)';
    END IF;
    v_height := v_tip.height + 1;
    v_label  := 'mock-' || v_height || '-' || clock_timestamp();
    v_hash   := sha256(convert_to('blk-' || v_label, 'UTF8'));

    -- known parties: a miner from the miners table, clients from earlier transactions
    SELECT address INTO v_miner FROM miners ORDER BY random() LIMIT 1;
    SELECT a INTO v_sender FROM (
        SELECT recipient AS a FROM transfers UNION SELECT requester FROM proof_txs
        UNION SELECT address FROM miners) x ORDER BY random() LIMIT 1;
    SELECT a INTO v_receiver FROM (
        SELECT recipient AS a FROM transfers UNION SELECT requester FROM proof_txs
        UNION SELECT address FROM miners) x WHERE a <> v_sender ORDER BY random() LIMIT 1;
    SELECT circuit_id INTO v_circuit FROM circuits ORDER BY random() LIMIT 1;
    SELECT requester INTO v_client FROM proof_txs ORDER BY random() LIMIT 1;

    INSERT INTO blocks (hash, height, prev_hash, block_time, miner, difficulty, bucket_count,
                        bucket_id, leaf_count, tx_root, size_bytes)
    VALUES (v_hash, v_height, v_tip.hash, now(), v_miner, v_tip.difficulty, v_tip.bucket_count,
            (v_height % v_tip.bucket_count)::int,
            CASE WHEN v_circuit IS NULL OR v_client IS NULL THEN 1 ELSE 2 END,
            sha256(convert_to('root-' || v_label, 'UTF8')), 900);

    INSERT INTO transfers (block_hash, position, txid, sender, recipient, amount, fee, nonce)
    SELECT v_hash, 0, sha256(convert_to('tx-' || v_label, 'UTF8')), v_sender, v_receiver,
           100 + floor(random() * 5000)::bigint, 10,
           (SELECT count(*) FROM transfers t WHERE t.sender = v_sender);

    IF v_circuit IS NOT NULL AND v_client IS NOT NULL THEN
        INSERT INTO proof_txs (block_hash, position, proof_hash, request_txid, circuit_id,
                               requester, fee, nonce, usage_counter, proof_bytes, witness_bytes,
                               witness_sha256, public_input_count, eta, mask)
        SELECT v_hash, 0, sha256(convert_to('proof-' || v_label, 'UTF8')),
               sha256(convert_to('req-' || v_label, 'UTF8')), v_circuit, v_client,
               90 + floor(random() * 40)::bigint,
               (SELECT count(*) FROM proof_txs p WHERE p.requester = v_client),
               (SELECT count(*) FROM proof_txs p JOIN blocks b ON b.hash = p.block_hash
                 WHERE b.miner = v_miner AND p.circuit_id = v_circuit),
               192, 4096, sha256(convert_to('wit-' || v_label, 'UTF8')), 2,
               substring(sha256(convert_to('eta-' || v_label, 'UTF8')) FROM 1 FOR 31),
               substring(sha256(convert_to('mask-' || v_label, 'UTF8')) FROM 1 FOR 31);
    END IF;

    -- statistics are materialized views since pouw-indexer migration 0003
    IF to_regprocedure('api.refresh_stats()') IS NOT NULL THEN
        PERFORM api.refresh_stats();
    END IF;
    RETURN v_height;
END $$;
