export type BracketMatch = {
  round: number;
  slot: number;
  a: string | null;
  b: string | null;
  winner: string | null;
  state: "pending" | "ready" | "complete";
  scoreA?: number;
  scoreB?: number;
};
export function makeBracket(entrants: string[]): BracketMatch[] {
  if (
    entrants.length < 2 ||
    entrants.length > 64 ||
    new Set(entrants).size !== entrants.length
  )
    throw new Error("A bracket needs 2–64 unique entrants.");
  let seeds = [1, 2];
  while (seeds.length < entrants.length)
    seeds = seeds.flatMap((seed) => [seed, seeds.length * 2 + 1 - seed]);
  const matches: BracketMatch[] = [];
  for (let slot = 0; slot < seeds.length / 2; slot++)
    matches.push({
      round: 1,
      slot,
      a: entrants[seeds[slot * 2] - 1] ?? null,
      b: entrants[seeds[slot * 2 + 1] - 1] ?? null,
      winner: null,
      state: "ready",
    });
  for (let count = seeds.length / 4, round = 2; count >= 1; count /= 2, round++)
    for (let slot = 0; slot < count; slot++)
      matches.push({
        round,
        slot,
        a: null,
        b: null,
        winner: null,
        state: "pending",
      });
  return advanceBracket(matches);
}
export function advanceBracket(source: BracketMatch[]): BracketMatch[] {
  const matches = source.map((m) => ({ ...m }));
  for (const match of matches) {
    if (match.round > 1) {
      const left = matches.find(
        (m) => m.round === match.round - 1 && m.slot === match.slot * 2,
      )!;
      const right = matches.find(
        (m) => m.round === match.round - 1 && m.slot === match.slot * 2 + 1,
      )!;
      if (left.state !== "complete" || right.state !== "complete") continue;
      match.a = left.winner;
      match.b = right.winner;
      if (match.state === "pending") match.state = "ready";
    }
    if (match.state === "ready" && (!match.a || !match.b)) {
      match.winner = match.a ?? match.b;
      match.state = "complete";
    }
  }
  return matches;
}
