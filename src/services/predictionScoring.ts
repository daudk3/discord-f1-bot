/**
 * Scoring logic for the predictions championship.
 *
 * Scoring rules:
 *   Main race:
 *     - Correct race winner:                 10 pts
 *     - Correct podium driver, exact place:   8 pts each
 *     - Correct podium driver, wrong place:   4 pts each
 *     - Correct pole position:                6 pts
 *     - Correct fastest lap:                  4 pts
 *   Sprint:
 *     - Correct sprint winner:                6 pts
 *     - Correct sprint podium, exact place:   4 pts each
 *     - Correct sprint podium, wrong place:   2 pts each
 *
 * Tie-breaking (deterministic):
 *   1. Higher total season points
 *   2. More "perfect pick" categories (categories where points were earned)
 *   3. More weekends participated
 *   4. Alphabetical by display name (final fallback)
 */

import {
  UserPicks,
  WeekendOfficialResults,
  WeekendUserScore,
  SCORING,
} from '../types/predictions';

/**
 * Score a single user's picks against official results for a weekend.
 */
export function scoreUserPicks(
  userId: string,
  displayName: string,
  picks: UserPicks,
  results: WeekendOfficialResults,
  isSprint: boolean,
): WeekendUserScore {
  const breakdown: Record<string, number> = {};
  let total = 0;

  // ── Pole position ──
  if (picks.pole && results.poleDriverId) {
    const pts = picks.pole.driverId === results.poleDriverId ? SCORING.POLE_POSITION : 0;
    breakdown.pole = pts;
    total += pts;
  }

  // ── Race winner ──
  if (picks.raceWinner && results.raceWinnerId) {
    const pts = picks.raceWinner.driverId === results.raceWinnerId ? SCORING.RACE_WINNER : 0;
    breakdown.raceWinner = pts;
    total += pts;
  }

  // ── Race podium ──
  if (picks.racePodium && results.racePodiumIds) {
    let podiumPts = 0;
    for (let i = 0; i < 3; i++) {
      const pickedId = picks.racePodium[i]?.driverId;
      if (!pickedId) continue;
      if (pickedId === results.racePodiumIds[i]) {
        // Exact position match
        podiumPts += SCORING.PODIUM_EXACT;
      } else if (results.racePodiumIds.includes(pickedId)) {
        // Right driver, wrong position
        podiumPts += SCORING.PODIUM_ON_PODIUM;
      }
    }
    breakdown.racePodium = podiumPts;
    total += podiumPts;
  }

  // ── Fastest lap ──
  if (picks.fastestLap && results.fastestLapDriverId) {
    const pts = picks.fastestLap.driverId === results.fastestLapDriverId ? SCORING.FASTEST_LAP : 0;
    breakdown.fastestLap = pts;
    total += pts;
  }

  // ── Sprint predictions (only if sprint weekend) ──
  if (isSprint) {
    if (picks.sprintWinner && results.sprintWinnerId) {
      const pts = picks.sprintWinner.driverId === results.sprintWinnerId ? SCORING.SPRINT_WINNER : 0;
      breakdown.sprintWinner = pts;
      total += pts;
    }

    if (picks.sprintPodium && results.sprintPodiumIds) {
      let sprintPodiumPts = 0;
      for (let i = 0; i < 3; i++) {
        const pickedId = picks.sprintPodium[i]?.driverId;
        if (!pickedId) continue;
        if (pickedId === results.sprintPodiumIds[i]) {
          sprintPodiumPts += SCORING.SPRINT_PODIUM_EXACT;
        } else if (results.sprintPodiumIds.includes(pickedId)) {
          sprintPodiumPts += SCORING.SPRINT_PODIUM_ON_PODIUM;
        }
      }
      breakdown.sprintPodium = sprintPodiumPts;
      total += sprintPodiumPts;
    }
  }

  return { userId, displayName, breakdown, total };
}

/**
 * Score all users for a weekend and return sorted results.
 */
export function scoreWeekend(
  picks: Record<string, UserPicks>,
  results: WeekendOfficialResults,
  isSprint: boolean,
  userNames: Record<string, string>,
): WeekendUserScore[] {
  const scores: WeekendUserScore[] = [];

  for (const [userId, userPicks] of Object.entries(picks)) {
    const displayName = userNames[userId] || userId;
    const score = scoreUserPicks(userId, displayName, userPicks, results, isSprint);
    scores.push(score);
  }

  // Sort: highest total first, then by number of scoring categories
  scores.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const aCategories = Object.values(a.breakdown).filter((v) => v > 0).length;
    const bCategories = Object.values(b.breakdown).filter((v) => v > 0).length;
    if (bCategories !== aCategories) return bCategories - aCategories;
    return a.displayName.localeCompare(b.displayName);
  });

  return scores;
}
