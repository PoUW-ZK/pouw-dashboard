export function searchCandidates(value: string, includePouw = false): string[] {
  const q = value.trim();
  const raw = /^(?:0x)?([a-f0-9]{64})$/i.exec(q);
  if (raw) return (includePouw ? ["blk", "tx", "addr", "proof", "circ"] : ["blk", "tx", "addr"]).map((prefix) => `${prefix}:${raw[1].toLowerCase()}`);
  return [q.replace(/^(blk|tx|addr|proof|circ):([a-f0-9]+)$/i, (_, prefix: string, hex: string) => `${prefix.toLowerCase()}:${hex.toLowerCase()}`)];
}
