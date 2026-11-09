import { SectionHeader, StatCard, StatsGrid } from "../../components/ui";
import type { Stats, Work } from "./api";
import { number } from "../../lib/formatters";
export function NetworkOverview({ stats }: { stats: Stats }) {
  return (
    <section>
      <SectionHeader title="Network overview" />
      <StatsGrid>
        <StatCard label="Indexed height" value={number(stats.indexed_height)} />
        <StatCard label="Active Buckets" value={number(stats.bucket_count)} />
        <StatCard
          label="Registered circuits"
          value={number(stats.circuit_count)}
        />
        <StatCard label="Processed proofs" value={number(stats.proof_count)} />
      </StatsGrid>
    </section>
  );
}
export function MiningOverview({
  stats,
  work,
}: {
  stats: Stats;
  work: Work[];
}) {
  const total = work.reduce((sum, item) => sum + Number(item.useful_work), 0);
  return (
    <section>
      <SectionHeader title="Mining overview" />
      <StatsGrid>
        <StatCard
          label="Avg. block interval"
          value={`${number(stats.avg_block_interval_s)}s`}
        />
        <StatCard
          label="Useful work"
          value={new Intl.NumberFormat("en-US", {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format(total)}
        />
      </StatsGrid>
    </section>
  );
}
