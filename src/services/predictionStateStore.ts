/**
 * Persistent state store for the predictions championship.
 * Separate JSON file from main bot state to keep concerns isolated.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  PredictionState,
  PredictionWeekendState,
  UserPicks,
  LeaderboardEntry,
  WeekendUserScore,
  DEFAULT_PREDICTION_STATE,
} from '../types/predictions';
import { logger } from '../utils/logger';

const STATE_FILE = path.resolve(process.cwd(), 'data', 'prediction-state.json');

let state: PredictionState = { ...DEFAULT_PREDICTION_STATE };

// ─── Load / Save ─────────────────────────────────────────────

export function loadPredictionState(): PredictionState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PredictionState>;
      state = {
        season: parsed.season ?? new Date().getFullYear(),
        weekends: parsed.weekends ?? {},
        leaderboard: parsed.leaderboard ?? {},
        announcedPredictions: parsed.announcedPredictions ?? [],
        announcedResults: parsed.announcedResults ?? [],
        announcedSprintReminders: parsed.announcedSprintReminders ?? [],
      };
      const weekendCount = Object.keys(state.weekends).length;
      const userCount = Object.keys(state.leaderboard).length;
      logger.info('Loaded prediction state', { weekendCount, userCount });
    } else {
      state = { ...DEFAULT_PREDICTION_STATE };
      savePredictionState();
      logger.info('Initialized fresh prediction state');
    }
  } catch (err) {
    logger.error('Failed to load prediction state, starting fresh', { error: String(err) });
    state = { ...DEFAULT_PREDICTION_STATE };
  }
  return state;
}

export function savePredictionState(): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    logger.error('Failed to save prediction state', { error: String(err) });
  }
}

// ─── Weekend management ──────────────────────────────────────

export function getWeekendState(raceId: string): PredictionWeekendState | null {
  return state.weekends[raceId] ?? null;
}

export function setWeekendState(raceId: string, weekend: PredictionWeekendState): void {
  state.weekends[raceId] = weekend;
  savePredictionState();
}

export function getAllWeekends(): Record<string, PredictionWeekendState> {
  return state.weekends;
}

// ─── User picks ──────────────────────────────────────────────

export function getUserPicks(raceId: string, userId: string): UserPicks | null {
  return state.weekends[raceId]?.picks[userId] ?? null;
}

export function setUserPicks(raceId: string, userId: string, picks: UserPicks): void {
  if (!state.weekends[raceId]) return;
  state.weekends[raceId].picks[userId] = picks;
  savePredictionState();
}

// ─── Scoring ─────────────────────────────────────────────────

export function markWeekendScored(raceId: string, scores: WeekendUserScore[]): void {
  const weekend = state.weekends[raceId];
  if (!weekend) return;
  weekend.scored = true;
  weekend.scores = scores;
  savePredictionState();
}

export function isWeekendScored(raceId: string): boolean {
  return state.weekends[raceId]?.scored ?? false;
}

// ─── Leaderboard ─────────────────────────────────────────────

export function getLeaderboard(): LeaderboardEntry[] {
  return Object.values(state.leaderboard)
    .sort((a, b) => {
      // Primary: total points descending
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      // Tie-break: more perfect picks wins
      if (b.perfectPicks !== a.perfectPicks) return b.perfectPicks - a.perfectPicks;
      // Final tie-break: more weekends participated
      return b.weekendCount - a.weekendCount;
    });
}

export function updateLeaderboard(scores: WeekendUserScore[]): void {
  for (const score of scores) {
    const existing = state.leaderboard[score.userId];
    const perfectCount = Object.values(score.breakdown).filter((v) => v > 0).length;
    if (existing) {
      existing.totalPoints += score.total;
      existing.weekendCount += 1;
      existing.perfectPicks += perfectCount;
      existing.displayName = score.displayName; // keep name updated
    } else {
      state.leaderboard[score.userId] = {
        userId: score.userId,
        displayName: score.displayName,
        totalPoints: score.total,
        weekendCount: 1,
        perfectPicks: perfectCount,
      };
    }
  }
  savePredictionState();
}

// ─── Announcement tracking ───────────────────────────────────

export function isPredictionAnnounced(raceId: string): boolean {
  return state.announcedPredictions.includes(raceId);
}

export function markPredictionAnnounced(raceId: string): void {
  if (!state.announcedPredictions.includes(raceId)) {
    state.announcedPredictions.push(raceId);
    savePredictionState();
  }
}

export function isResultAnnounced(raceId: string): boolean {
  return state.announcedResults.includes(raceId);
}

export function markResultAnnounced(raceId: string): void {
  if (!state.announcedResults.includes(raceId)) {
    state.announcedResults.push(raceId);
    savePredictionState();
  }
}

export function isSprintReminderAnnounced(raceId: string): boolean {
  return state.announcedSprintReminders.includes(raceId);
}

export function markSprintReminderAnnounced(raceId: string): void {
  if (!state.announcedSprintReminders.includes(raceId)) {
    state.announcedSprintReminders.push(raceId);
    savePredictionState();
  }
}

export function getPredictionState(): Readonly<PredictionState> {
  return state;
}
