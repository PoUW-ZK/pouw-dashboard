export type ChainNumber = number | string;
const integers = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimals = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export const number = (value: ChainNumber | bigint | null | undefined): string => {
  if (value == null || value === "") return "—";
  if (typeof value === "bigint") return integers.format(value);
  if (typeof value === "number") return Number.isFinite(value) ? decimals.format(value) : "—";
  if (typeof value !== "string") return "—";
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return "—";
  const fraction = match[3] ?? "";
  // Round the decimal string without first converting its integer part to Number.
  const scaled = BigInt(match[2]) * 100n + BigInt((fraction + "00").slice(0, 2)) + (fraction[2] >= "5" ? 1n : 0n);
  const tail = String(scaled % 100n).padStart(2, "0").replace(/0+$/, "");
  return `${match[1] && scaled ? "-" : ""}${integers.format(scaled / 100n)}${tail ? `.${tail}` : ""}`;
};

export const sumIntegers = (...values: ChainNumber[]) => values.reduce<bigint>((sum, value) => sum + BigInt(value), 0n);

export const shorten = (value: string) => {
  const display = /^(addr|blk|tx|proof):/.test(value)
    ? `0x${value.split(":")[1]}`
    : value;
  return display.length > 16 ? `${display.slice(0, 6)}…${display.slice(-4)}` : display;
};
export const date = (value: string) => new Date(value).toLocaleString();
