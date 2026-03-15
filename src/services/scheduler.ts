/**
 * Lightweight in-process scheduler.
 * Polls on a configurable interval for announcement and result posting duties.
 */

import { Client } from 'discord.js';
import { checkWeekendAnnouncement, checkSessionResults } from './announcements';
import { checkPredictionAnnouncement, checkPredictionResults } from './predictions';
import { updateLastCheck } from './stateStore';
import { logger } from '../utils/logger';

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the scheduler. Runs an initial check immediately, then on interval.
 */
export function startScheduler(client: Client): void {
  const pollMinutes = parseInt(process.env.SESSION_RESULT_POLL_MINUTES || '10', 10);
  const pollMs = pollMinutes * 60 * 1000;

  logger.info(`Scheduler starting with ${pollMinutes}-minute interval`);

  // Run immediately on startup
  runCheck(client);

  // Then on interval
  intervalHandle = setInterval(() => runCheck(client), pollMs);
}

/**
 * Stop the scheduler.
 */
export function stopScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('Scheduler stopped');
  }
}

/**
 * Run a single scheduler check cycle.
 */
async function runCheck(client: Client): Promise<void> {
  logger.info('Scheduler check starting');

  try {
    await checkWeekendAnnouncement(client);
  } catch (err) {
    logger.error('Scheduler: weekend announcement check failed', { error: String(err) });
  }

  try {
    await checkSessionResults(client);
  } catch (err) {
    logger.error('Scheduler: session results check failed', { error: String(err) });
  }

  try {
    await checkPredictionAnnouncement(client);
  } catch (err) {
    logger.error('Scheduler: prediction announcement check failed', { error: String(err) });
  }

  try {
    await checkPredictionResults(client);
  } catch (err) {
    logger.error('Scheduler: prediction results check failed', { error: String(err) });
  }

  updateLastCheck();
  logger.info('Scheduler check complete');
}
