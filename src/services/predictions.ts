/**
 * Core predictions service — orchestrates weekend setup, locking, scoring,
 * and automated announcements for the prediction championship.
 */

import { Client, TextChannel } from 'discord.js';
import { DateTime } from 'luxon';
import {
  PredictionCategory,
  PredictionWeekendState,
  LockWindow,
  WeekendOfficialResults,
  UserPicks,
  QUALY_LOCK_CATEGORIES,
  RACE_LOCK_CATEGORIES,
  SPRINT_LOCK_CATEGORIES,
} from '../types/predictions';
import { Race, RaceSchedule } from '../types/f1';
import {
  getNextRace,
  getCurrentRaces,
  getRaceResults,
  getQualyResults,
  getSprintRaceResults,
} from './f1api';
import {
  getWeekendState,
  setWeekendState,
  getUserPicks,
  setUserPicks,
  isWeekendScored,
  markWeekendScored,
  updateLeaderboard,
  getLeaderboard,
  isPredictionAnnounced,
  markPredictionAnnounced,
  isResultAnnounced,
  markResultAnnounced,
  loadPredictionState,
} from './predictionStateStore';
import { scoreWeekend } from './predictionScoring';
import {
  buildPredictionsOpenEmbed,
  buildWeekendResultsEmbed,
} from '../utils/predictionFormat';
import { parseSessionDateTime, hoursUntil } from '../utils/time';
import { logger } from '../utils/logger';

// ─── Configuration ───────────────────────────────────────────

function getLockMinutesBefore(): number {
  return parseInt(process.env.PREDICTION_LOCK_MINUTES_BEFORE || '5', 10);
}

function sprintPredictionsEnabled(): boolean {
  return (process.env.ENABLE_SPRINT_PREDICTIONS ?? 'true') === 'true';
}

function weekendPostsEnabled(): boolean {
  return (process.env.ENABLE_WEEKEND_PREDICTION_POSTS ?? 'true') === 'true';
}

function getPredictionsChannelId(): string | undefined {
  return process.env.DISCORD_PREDICTIONS_CHANNEL_ID;
}

function getPredictionsChannel(client: Client): TextChannel | null {
  const channelId = getPredictionsChannelId();
  if (!channelId) return null;
  const channel = client.channels.cache.get(channelId);
  if (!channel || !(channel instanceof TextChannel)) {
    logger.warn('Predictions channel not found or not a text channel', { channelId });
    return null;
  }
  return channel;
}

// ─── Weekend setup ───────────────────────────────────────────

/**
 * Determine whether a race is a sprint weekend based on its schedule.
 */
export function isSprintWeekend(schedule: RaceSchedule): boolean {
  return schedule.sprintRace != null || schedule.sprintQualy != null;
}

/**
 * Build lock windows from a race schedule.
 * Each lock = session start time minus configured offset.
 */
function buildLockWindows(schedule: RaceSchedule): LockWindow {
  const offsetMin = getLockMinutesBefore();

  const qualyDt = parseSessionDateTime(schedule.qualy.date, schedule.qualy.time);
  const raceDt = parseSessionDateTime(schedule.race.date, schedule.race.time);

  const windows: LockWindow = {
    qualyLock: qualyDt.minus({ minutes: offsetMin }).toISO()!,
    raceLock: raceDt.minus({ minutes: offsetMin }).toISO()!,
  };

  // Sprint lock = before sprint qualifying if available, else before sprint race
  if (schedule.sprintQualy) {
    const sprintQualyDt = parseSessionDateTime(schedule.sprintQualy.date, schedule.sprintQualy.time);
    windows.sprintLock = sprintQualyDt.minus({ minutes: offsetMin }).toISO()!;
  } else if (schedule.sprintRace) {
    const sprintRaceDt = parseSessionDateTime(schedule.sprintRace.date, schedule.sprintRace.time);
    windows.sprintLock = sprintRaceDt.minus({ minutes: offsetMin }).toISO()!;
  }

  return windows;
}

/**
 * Ensure a weekend prediction state exists for the given race.
 * Creates one if missing.
 */
export function ensureWeekendState(race: Race): PredictionWeekendState {
  const existing = getWeekendState(race.raceId);
  if (existing) return existing;

  const year = parseInt(race.schedule.race.date.slice(0, 4), 10);
  const isSprint = isSprintWeekend(race.schedule);

  const weekend: PredictionWeekendState = {
    raceId: race.raceId,
    raceName: race.raceName,
    round: race.round,
    year,
    isSprint,
    lockWindows: buildLockWindows(race.schedule),
    picks: {},
    scored: false,
  };

  setWeekendState(race.raceId, weekend);
  logger.info('Created prediction weekend state', {
    raceId: race.raceId,
    raceName: race.raceName,
    isSprint,
  });
  return weekend;
}

// ─── Lock checking ───────────────────────────────────────────

/**
 * Check whether a specific prediction category is locked for a weekend.
 */
export function isCategoryLocked(category: PredictionCategory, weekend: PredictionWeekendState): boolean {
  const now = DateTime.utc();

  if (QUALY_LOCK_CATEGORIES.includes(category)) {
    return now >= DateTime.fromISO(weekend.lockWindows.qualyLock);
  }

  if (RACE_LOCK_CATEGORIES.includes(category)) {
    return now >= DateTime.fromISO(weekend.lockWindows.raceLock);
  }

  if (SPRINT_LOCK_CATEGORIES.includes(category)) {
    if (!weekend.lockWindows.sprintLock) return true; // no sprint = locked
    return now >= DateTime.fromISO(weekend.lockWindows.sprintLock);
  }

  return true;
}

/**
 * Get all currently open categories for a weekend.
 */
export function getOpenCategories(weekend: PredictionWeekendState): PredictionCategory[] {
  const allCategories = [
    PredictionCategory.PolePosition,
    PredictionCategory.RaceWinner,
    PredictionCategory.RacePodium,
    PredictionCategory.FastestLap,
  ];

  if (weekend.isSprint && sprintPredictionsEnabled()) {
    allCategories.push(PredictionCategory.SprintWinner, PredictionCategory.SprintPodium);
  }

  return allCategories.filter((cat) => !isCategoryLocked(cat, weekend));
}

/**
 * Check if all prediction categories are locked (weekend is fully locked).
 */
export function isFullyLocked(weekend: PredictionWeekendState): boolean {
  return getOpenCategories(weekend).length === 0;
}

// ─── Pick submission ─────────────────────────────────────────

export interface SubmitResult {
  success: boolean;
  message: string;
}

/**
 * Submit or update a user's picks for a weekend.
 * Only updates categories that are still open.
 */
export function submitPicks(
  raceId: string,
  userId: string,
  newPicks: Partial<UserPicks>,
): SubmitResult {
  const weekend = getWeekendState(raceId);
  if (!weekend) {
    return { success: false, message: 'No active prediction weekend found.' };
  }

  if (weekend.scored) {
    return { success: false, message: 'This weekend has already been scored. Picks are closed.' };
  }

  const existing = getUserPicks(raceId, userId) || {};
  const updated: UserPicks = { ...existing };
  const accepted: string[] = [];
  const rejected: string[] = [];

  // Check each submitted category
  if (newPicks.pole !== undefined) {
    if (!isCategoryLocked(PredictionCategory.PolePosition, weekend)) {
      updated.pole = newPicks.pole;
      accepted.push('Pole Position');
    } else {
      rejected.push('Pole Position (locked)');
    }
  }

  if (newPicks.raceWinner !== undefined) {
    if (!isCategoryLocked(PredictionCategory.RaceWinner, weekend)) {
      updated.raceWinner = newPicks.raceWinner;
      accepted.push('Race Winner');
    } else {
      rejected.push('Race Winner (locked)');
    }
  }

  if (newPicks.racePodium !== undefined) {
    if (!isCategoryLocked(PredictionCategory.RacePodium, weekend)) {
      updated.racePodium = newPicks.racePodium;
      accepted.push('Race Podium');
    } else {
      rejected.push('Race Podium (locked)');
    }
  }

  if (newPicks.fastestLap !== undefined) {
    if (!isCategoryLocked(PredictionCategory.FastestLap, weekend)) {
      updated.fastestLap = newPicks.fastestLap;
      accepted.push('Fastest Lap');
    } else {
      rejected.push('Fastest Lap (locked)');
    }
  }

  if (newPicks.sprintWinner !== undefined) {
    if (weekend.isSprint && sprintPredictionsEnabled() && !isCategoryLocked(PredictionCategory.SprintWinner, weekend)) {
      updated.sprintWinner = newPicks.sprintWinner;
      accepted.push('Sprint Winner');
    } else {
      rejected.push('Sprint Winner (locked or not available)');
    }
  }

  if (newPicks.sprintPodium !== undefined) {
    if (weekend.isSprint && sprintPredictionsEnabled() && !isCategoryLocked(PredictionCategory.SprintPodium, weekend)) {
      updated.sprintPodium = newPicks.sprintPodium;
      accepted.push('Sprint Podium');
    } else {
      rejected.push('Sprint Podium (locked or not available)');
    }
  }

  if (accepted.length === 0) {
    const msg = rejected.length > 0
      ? `All submitted categories are locked: ${rejected.join(', ')}`
      : 'No valid predictions submitted.';
    return { success: false, message: msg };
  }

  setUserPicks(raceId, userId, updated);

  let msg = `Saved: ${accepted.join(', ')}`;
  if (rejected.length > 0) {
    msg += `\nRejected: ${rejected.join(', ')}`;
  }

  return { success: true, message: msg };
}

// ─── Scoring ─────────────────────────────────────────────────

/**
 * Fetch official results from f1api.dev and build the WeekendOfficialResults.
 * Returns null if results are not yet available.
 */
export async function fetchOfficialResults(
  weekend: PredictionWeekendState,
): Promise<WeekendOfficialResults | null> {
  const { year, round, isSprint } = weekend;

  // We need at minimum qualifying and race results
  const [qualyResults, raceResults] = await Promise.all([
    getQualyResults(year, round),
    getRaceResults(year, round),
  ]);

  // Race results required for scoring
  if (raceResults.length === 0) return null;

  const results: WeekendOfficialResults = {};

  // Pole = P1 in qualifying
  if (qualyResults.length > 0) {
    const poleDriver = qualyResults.find((r) => r.gridPosition === 1);
    if (poleDriver) results.poleDriverId = poleDriver.driverId;
  }

  // Race winner = position 1
  const winner = raceResults.find((r) => r.position === 1);
  if (winner) results.raceWinnerId = winner.driver?.driverId;

  // Race podium = positions 1, 2, 3
  const podium = raceResults
    .filter((r) => r.position >= 1 && r.position <= 3)
    .sort((a, b) => a.position - b.position);
  if (podium.length === 3) {
    results.racePodiumIds = [
      podium[0].driver?.driverId,
      podium[1].driver?.driverId,
      podium[2].driver?.driverId,
    ] as [string, string, string];
  }

  // Fastest lap — look for the driver with a non-null fastLap who set the fastest time
  // The race object fast_lap field has the driver ID
  const raceData = await (await import('./f1api')).getRaceInfo(year, round);
  if (raceData?.fast_lap?.fast_lap_driver_id) {
    results.fastestLapDriverId = raceData.fast_lap.fast_lap_driver_id;
  }

  // Sprint results (only if sprint weekend)
  if (isSprint && sprintPredictionsEnabled()) {
    const sprintResults = await getSprintRaceResults(year, round);
    if (sprintResults.length > 0) {
      const sprintWinner = sprintResults.find((r) => r.position === 1);
      if (sprintWinner) results.sprintWinnerId = sprintWinner.driverId;

      const sprintPodium = sprintResults
        .filter((r) => r.position >= 1 && r.position <= 3)
        .sort((a, b) => a.position - b.position);
      if (sprintPodium.length === 3) {
        results.sprintPodiumIds = [
          sprintPodium[0].driverId,
          sprintPodium[1].driverId,
          sprintPodium[2].driverId,
        ] as [string, string, string];
      }
    }
  }

  return results;
}

/**
 * Attempt to score a weekend. Returns true if scoring happened.
 */
export async function tryScoreWeekend(raceId: string): Promise<boolean> {
  const weekend = getWeekendState(raceId);
  if (!weekend || weekend.scored) return false;

  // Don't score until the race should be finished (race start + 3 hours)
  const raceDt = parseSessionDateTime(
    weekend.lockWindows.raceLock.slice(0, 10),
    '00:00:00',
  );
  // Use the actual race time from lock window + offset to approximate
  const raceLockDt = DateTime.fromISO(weekend.lockWindows.raceLock);
  const raceApproxEnd = raceLockDt.plus({ hours: 3 });
  if (DateTime.utc() < raceApproxEnd) return false;

  const results = await fetchOfficialResults(weekend);
  if (!results) {
    logger.info('Official results not yet available for scoring', { raceId });
    return false;
  }

  // Build userId -> displayName mapping from picks
  const userNames: Record<string, string> = {};
  for (const [userId] of Object.entries(weekend.picks)) {
    // Use userId as fallback; the actual display names get set during pick submission
    // We'll update from the picks' driver display names or just use the userId
    userNames[userId] = userId;
  }

  const scores = scoreWeekend(weekend.picks, results, weekend.isSprint, userNames);

  // Store official results and scores
  weekend.officialResults = results;
  markWeekendScored(raceId, scores);
  updateLeaderboard(scores);

  logger.info('Weekend scored successfully', {
    raceId,
    raceName: weekend.raceName,
    participants: scores.length,
  });

  return true;
}

// ─── Automated posts ─────────────────────────────────────────

/**
 * Check and post "Predictions Open" announcement.
 * Called from the scheduler.
 */
export async function checkPredictionAnnouncement(client: Client): Promise<void> {
  if (!weekendPostsEnabled()) return;
  const channel = getPredictionsChannel(client);
  if (!channel) return;

  const race = await getNextRace();
  if (!race) return;

  if (isPredictionAnnounced(race.raceId)) return;

  // Post when we're within the announcement window
  const hoursBeforeConfig = parseInt(process.env.SESSION_ANNOUNCEMENT_HOURS_BEFORE || '24', 10);
  const firstSession = getEarliestSessionTime(race.schedule);
  if (!firstSession) return;

  const hours = hoursUntil(firstSession);
  if (hours > hoursBeforeConfig || hours < -2) return;

  // Ensure weekend state exists
  ensureWeekendState(race);

  const leaderboard = getLeaderboard();
  const isSprint = isSprintWeekend(race.schedule);
  const weekend = getWeekendState(race.raceId)!;

  try {
    const embed = buildPredictionsOpenEmbed(race, weekend, leaderboard, isSprint);
    await channel.send({ embeds: [embed] });
    markPredictionAnnounced(race.raceId);
    logger.info('Posted predictions open announcement', { raceId: race.raceId });
  } catch (err) {
    logger.error('Failed to post predictions open', { error: String(err) });
  }
}

/**
 * Check and post "Weekend Prediction Results" after scoring.
 * Called from the scheduler.
 */
export async function checkPredictionResults(client: Client): Promise<void> {
  if (!weekendPostsEnabled()) return;
  const channel = getPredictionsChannel(client);
  if (!channel) return;

  // Check all current-season races for recently scored weekends
  const races = await getCurrentRaces();

  for (const race of races) {
    if (isResultAnnounced(race.raceId)) continue;

    const weekend = getWeekendState(race.raceId);
    if (!weekend) continue;

    // Try scoring if not already scored
    if (!weekend.scored) {
      await tryScoreWeekend(race.raceId);
    }

    // If now scored and not yet announced, post results
    if (weekend.scored && weekend.scores && !isResultAnnounced(race.raceId)) {
      try {
        const leaderboard = getLeaderboard();
        const embed = buildWeekendResultsEmbed(weekend, leaderboard);
        await channel.send({ embeds: [embed] });
        markResultAnnounced(race.raceId);
        logger.info('Posted weekend prediction results', { raceId: race.raceId });
      } catch (err) {
        logger.error('Failed to post prediction results', { error: String(err) });
      }
    }
  }
}

// ─── Helper ──────────────────────────────────────────────────

function getEarliestSessionTime(schedule: RaceSchedule): DateTime | null {
  const sessions = [
    schedule.fp1,
    schedule.fp2,
    schedule.fp3,
    schedule.qualy,
    schedule.sprintQualy,
    schedule.sprintRace,
    schedule.race,
  ].filter((s): s is { date: string; time: string } => s != null);

  if (sessions.length === 0) return null;

  let earliest = parseSessionDateTime(sessions[0].date, sessions[0].time);
  for (let i = 1; i < sessions.length; i++) {
    const dt = parseSessionDateTime(sessions[i].date, sessions[i].time);
    if (dt < earliest) earliest = dt;
  }
  return earliest;
}
