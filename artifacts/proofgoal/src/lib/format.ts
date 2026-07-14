export function formatLamports(lamports: number): string {
  return (lamports / 1e9).toFixed(2);
}

export function formatOdds(odds: number): string {
  return odds.toFixed(2);
}

export function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
