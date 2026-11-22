import { SectionHeader, StatCard, StatsGrid } from "../../components/ui";
import { useMining } from "./api";
import type { Stats } from "./api";
import { date, number, sumIntegers } from "../../lib/formatters";
import { showPouw } from "../../lib/config";

export function NetworkOverview({ stats }: { stats: Stats }) {
  return (
    <section>
      <SectionHeader title="Network overview" />
      <StatsGrid>
        <StatCard label="Indexed height" value={number(stats.indexed_height)} />
        <StatCard label="Blocks" value={number(stats.block_count)} />
        <StatCard label="Transfers" value={number(stats.transfer_count)} />
        <StatCard label="Latest block" value={stats.latest_block_time ? date(stats.latest_block_time) : "Waiting for the first block"} />
        {showPouw && <StatCard label="Registered circuits" value={number(stats.circuit_count)} />}
        {showPouw && <StatCard label="Processed proofs" value={number(stats.proof_count)} />}
      </StatsGrid>
    </section>
  );
}

export function MiningOverview({ stats }: { stats: Stats }) {
  const work = useMining();
  const interval = work.data?.stats[0]?.avg_block_interval_s;
  const total = sumIntegers(...(work.data?.useful_work ?? []).map((row) => row.useful_work));
  return (
    <section>
      <SectionHeader title="Mining overview" />
      <StatsGrid>
        <StatCard label="Avg. block interval" value={interval == null ? "Waiting for more blocks" : `${number(interval)} s`} />
        <StatCard label="Canonical blocks" value={number(stats.block_count)} />
        {showPouw && <StatCard label="Useful work" value={work.data ? number(total) : "—"} />}
      </StatsGrid>
    </section>
  );
}
