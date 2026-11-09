export const number = (value: number | string | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
        Number(value),
      );
export const shorten = (value: string) => {
  const display = /^(addr|blk|tx|proof):/.test(value)
    ? `0x${value.split(":")[1]}`
    : value.startsWith("circ:")
      ? `cir-${parseInt(value.split(":")[1], 16)}`
      : value;
  return display.length > 16
    ? `${display.slice(0, 5)}...${display.slice(-3)}`
    : display;
};
export const date = (value: string) => new Date(value).toLocaleString();
