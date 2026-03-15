/**
 * Types for the season-long predictions championship system.
 */

// ─── Prediction categories ──────────────────────────────────

export enum PredictionCategory {
  PolePosition = 'pole',
  RaceWinner = 'raceWinner',
  RacePodium = 'racePodium',
  FastestLap = 'fastestLap',
  SprintWinner = 'sprintWinner',
  SprintPodium = 'sprintPodium',
}

/** Categories that lock before qualifying */
export const QUALY_LOCK_CATEGORIES: PredictionCategory[] = [
  PredictionCategory.PolePosition,
];

/** Categories that lock before the race */
export const RACE_LOCK_CATEGORIES: PredictionCategory[] = [
  PredictionCategory.RaceWinner,
  PredictionCategory.RacePodium,
  PredictionCategory.FastestLap,
];

/** Categories that lock before sprint qualifying / sprint race */
export const SPRINT_LOCK_CATEGORIES: PredictionCategory[] = [
  PredictionCategory.SprintWinner,
  PredictionCategory.SprintPodium,
];

/** Human-readable labels */
export const CATEGORY_LABELS: Record<PredictionCategory, string> = {
  [PredictionCategory.PolePosition]: 'Pole Position',
  [PredictionCategory.RaceWinner]: 'Race Winner',
  [PredictionCategory.RacePodium]: 'Race Podium (P1, P2, P3)',
  [PredictionCategory.FastestLap]: 'Fastest Lap',
  [PredictionCategory.SprintWinner]: 'Sprint Winner',
  [PredictionCategory.SprintPodium]: 'Sprint Podium (P1, P2, P3)',
};

// ─── Scoring ─────────────────────────────────────────────────

export const SCORING = {
  /** Main race */
  RACE_WINNER: 10,
  PODIUM_EXACT: 8,
  PODIUM_ON_PODIUM: 4,  // correct driver, wrong position
  POLE_POSITION: 6,
  FASTEST_LAP: 4,
  /** Sprint */
  SPRINT_WINNER: 6,
  SPRINT_PODIUM_EXACT: 4,
  SPRINT_PODIUM_ON_PODIUM: 2,
} as const;

// ─── User picks ──────────────────────────────────────────────

/** A single driver pick identified by driverId from f1api.dev */
export interface DriverPick {
  driverId: string;
  /** Cached display name so we don't need API calls to show picks */
  displayName: string;
}

/** All picks a user can submit for a weekend */
export interface UserPicks {
  pole?: DriverPick;
  raceWinner?: DriverPick;
  /** Ordered: [P1, P2, P3] */
  racePodium?: [DriverPick, DriverPick, DriverPick];
  fastestLap?: DriverPick;
  sprintWinner?: DriverPick;
  /** Ordered: [P1, P2, P3] */
  sprintPodium?: [DriverPick, DriverPick, DriverPick];
}

// ─── Weekend prediction state ────────────────────────────────

/** Lock window info derived from session schedule */
export interface LockWindow {
  qualyLock: string;    // ISO timestamp — pole predictions lock
  raceLock: string;     // ISO timestamp — race predictions lock
  sprintLock?: string;  // ISO timestamp — sprint predictions lock (absent on non-sprint weekends)
}

/** Per-user scored result for a weekend */
export interface WeekendUserScore {
  userId: string;
  displayName: string;
  /** Points earned this weekend, broken down */
  breakdown: Record<string, number>;
  /** Total points this weekend */
  total: number;
}

/** Stored official results used for scoring a weekend */
export interface WeekendOfficialResults {
  poleDriverId?: string;
  raceWinnerId?: string;
  /** Ordered [P1, P2, P3] driver IDs */
  racePodiumIds?: [string, string, string];
  fastestLapDriverId?: string;
  sprintWinnerId?: string;
  /** Ordered [P1, P2, P3] driver IDs */
  sprintPodiumIds?: [string, string, string];
}

// ─── Season leaderboard ──────────────────────────────────────

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalPoints: number;
  weekendCount: number;
  /** For tie-breaking: number of perfect category predictions */
  perfectPicks: number;
}

// ─── Persistent prediction state ─────────────────────────────

export interface PredictionWeekendState {
  raceId: string;
  raceName: string;
  round: number;
  year: number;
  isSprint: boolean;
  lockWindows: LockWindow;
  /** keyed by Discord userId */
  picks: Record<string, UserPicks>;
  /** Set after scoring is complete */
  scored: boolean;
  /** Per-user scores (populated after scoring) */
  scores?: WeekendUserScore[];
  /** Official results used for scoring */
  officialResults?: WeekendOfficialResults;
}

export interface PredictionState {
  /** Season year for which this state applies */
  season: number;
  /** Keyed by raceId */
  weekends: Record<string, PredictionWeekendState>;
  /** Cumulative season leaderboard entries keyed by userId */
  leaderboard: Record<string, LeaderboardEntry>;
  /** raceIds for which the "Predictions Open" post was sent */
  announcedPredictions: string[];
  /** raceIds for which the "Weekend Results" post was sent */
  announcedResults: string[];
  /** raceIds for which sprint prediction reminder was sent */
  announcedSprintReminders: string[];
}

export const DEFAULT_PREDICTION_STATE: PredictionState = {
  season: new Date().getFullYear(),
  weekends: {},
  leaderboard: {},
  announcedPredictions: [],
  announcedResults: [],
  announcedSprintReminders: [],
};
