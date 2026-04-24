// -----------------------------------------------------------------------------
// Round-robin-only format plugin.
//
// Everyone plays everyone. One pseudo-group (label "A") holds the whole field.
// Storage-wise this reuses the existing groups/groupMembers/matches tables
// with stage="group" and a single group per category.
//
// Standings use the same ranking logic as regular group-stage standings.
// -----------------------------------------------------------------------------

import type { SeededPlayer } from "./draw";
import { orderBySeed } from "./draw";
import type { DrawMode } from "./format";
import { computeStandings } from "./standings";
import { generateRoundRobin, type PlannedMatch } from "./roundRobin";
import type {
  EngineGroup,
  GroupStanding,
  Player,
} from "./types";

export type RoundRobinOnlyInput = {
  players: SeededPlayer[];
  /**
   * Ordering before the round-robin is generated. "seeded_snake" sorts by
   * `seed` asc so seed 1 is `players[0]` - this makes the schedule
   * reproducible. Otherwise players keep their insertion order.
   */
  drawMode?: DrawMode;
};

export type RoundRobinPlan = {
  /** Single pseudo-group. Label is always "A", position 0. */
  group: { label: "A"; position: 0; players: Player[] };
  matches: PlannedMatch[];
};

export function planRoundRobinOnly(
  input: RoundRobinOnlyInput,
): RoundRobinPlan {
  const ordered =
    input.drawMode === "seeded_snake"
      ? orderBySeed(input.players)
      : input.players.slice();
  return {
    group: { label: "A", position: 0, players: ordered },
    matches: generateRoundRobin(ordered),
  };
}

export function roundRobinStandings(
  group: Pick<EngineGroup, "id" | "label" | "players" | "matches">,
): GroupStanding {
  return computeStandings(group);
}
