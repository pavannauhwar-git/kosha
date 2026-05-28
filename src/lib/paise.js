export function fromRupees(n) {
  if (n === null || n === undefined || n === '') return 0n;
  const num = Number(n);
  if (Number.isNaN(num) || !Number.isFinite(num)) return 0n;
  return BigInt(Math.round(num * 100));
}

export function toRupees(p) {
  if (p === null || p === undefined) return 0;
  return Number(p) / 100;
}

export function add(a, b) {
  return BigInt(a || 0n) + BigInt(b || 0n);
}

export function sub(a, b) {
  return BigInt(a || 0n) - BigInt(b || 0n);
}

export function mul(p, factor) {
  if (p === null || p === undefined || !Number.isFinite(Number(factor))) return 0n;
  const result = Number(p) * Number(factor);
  return BigInt(Math.round(result));
}

export function divEvenly(total, n) {
  const totalBig = BigInt(total || 0n);
  const numShares = BigInt(n || 1);
  if (numShares <= 0n) return [];

  const base = totalBig / numShares;
  let remainder = totalBig % numShares;

  const result = Array(Number(numShares)).fill(base);
  const absRemainder = remainder < 0n ? -remainder : remainder;
  const sign = remainder < 0n ? -1n : 1n;

  for (let i = 0; i < Number(absRemainder); i++) {
    result[i] += sign;
  }

  return result;
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
