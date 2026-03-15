/**
 * Persistent state store backed by a JSON file.
 * Tracks what the bot has already announced/posted to avoid duplicates.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BotState, DEFAULT_STATE } from '../types/state';
import { logger } from '../utils/logger';

// Use process.cwd() so the data dir is always at project root regardless of
// whether we run from src/ (ts-node) or dist/src/ (compiled).
const STATE_FILE = path.resolve(process.cwd(), 'data', 'bot-state.json');

let state: BotState = { ...DEFAULT_STATE };

/**
 * Load state from disk. Safe to call multiple times.
 */
export function loadState(): BotState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<BotState>;
      state = {
        announcedWeekends: parsed.announcedWeekends ?? [],
        postedResults: parsed.postedResults ?? [],
        lastCheck: parsed.lastCheck ?? null,
      };
      logger.info('Loaded bot state from disk', {
        announcedWeekends: state.announcedWeekends.length,
        postedResults: state.postedResults.length,
      });
    } else {
      state = { ...DEFAULT_STATE };
      saveState();
      logger.info('Initialized fresh bot state');
    }
  } catch (err) {
    logger.error('Failed to load bot state, starting fresh', { error: String(err) });
    state = { ...DEFAULT_STATE };
  }
  return state;
}

/**
 * Save current state to disk.
 */
export function saveState(): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    logger.error('Failed to save bot state', { error: String(err) });
  }
}

/**
 * Check if a weekend has already been announced.
 */
export function isWeekendAnnounced(raceId: string): boolean {
  return state.announcedWeekends.includes(raceId);
}

/**
 * Mark a weekend as announced.
 */
export function markWeekendAnnounced(raceId: string): void {
  if (!state.announcedWeekends.includes(raceId)) {
    state.announcedWeekends.push(raceId);
    saveState();
  }
}

/**
 * Build a unique key for a session result post.
 */
export function sessionResultKey(raceId: string, sessionType: string): string {
  return `${raceId}:${sessionType}`;
}

/**
 * Check if a session result has already been posted.
 */
export function isResultPosted(key: string): boolean {
  return state.postedResults.includes(key);
}

/**
 * Mark a session result as posted.
 */
export function markResultPosted(key: string): void {
  if (!state.postedResults.includes(key)) {
    state.postedResults.push(key);
    saveState();
  }
}

/**
 * Update the last check timestamp.
 */
export function updateLastCheck(): void {
  state.lastCheck = new Date().toISOString();
  saveState();
}

/**
 * Get current state (read-only snapshot).
 */
export function getState(): Readonly<BotState> {
  return state;
}
