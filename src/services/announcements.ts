/**
 * Announcement service — posts schedule and result embeds to the configured channel.
 */

import { Client, TextChannel } from 'discord.js';
import { Race, SessionType, SESSION_LABELS, RaceSchedule } from '../types/f1';
import { getNextRace, getCurrentRaces, getSessionResults } from './f1api';
import {
  isWeekendAnnounced,
  markWeekendAnnounced,
  isResultPosted,
  markResultPosted,
  sessionResultKey,
} from './stateStore';
import { buildWeekendAnnouncementEmbed, buildSessionResultEmbed } from '../utils/format';
import { parseSessionDateTime, isInPast, hoursUntil } from '../utils/time';
import { logger } from '../utils/logger';

/**
 * Get the announcement channel from the client.
 */
function getAnnouncementChannel(client: Client): TextChannel | null {
  const channelId = process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID;
  if (!channelId) {
    logger.warn('DISCORD_ANNOUNCEMENT_CHANNEL_ID not set, skipping announcements');
    return null;
  }

  const channel = client.channels.cache.get(channelId);
  if (!channel || !(channel instanceof TextChannel)) {
    logger.warn('Announcement channel not found or not a text channel', { channelId });
    return null;
  }

  return channel;
}

/**
 * Check and post pre-weekend schedule announcement if due.
 */
export async function checkWeekendAnnouncement(client: Client): Promise<void> {
  const channel = getAnnouncementChannel(client);
  if (!channel) return;

  const race = await getNextRace();
  if (!race) {
    logger.info('No upcoming race found for weekend announcement');
    return;
  }

  if (isWeekendAnnounced(race.raceId)) {
    return;
  }

  // Find the earliest session time
  const firstSessionDt = getEarliestSessionTime(race.schedule);
  if (!firstSessionDt) {
    logger.warn('Could not determine first session time', { raceId: race.raceId });
    return;
  }

  const hoursBeforeConfig = parseInt(process.env.SESSION_ANNOUNCEMENT_HOURS_BEFORE || '24', 10);
  const hours = hoursUntil(firstSessionDt);

  if (hours <= hoursBeforeConfig && hours > -2) {
    // Within the announcement window (up to 2 hours after start as a grace window)
    try {
      const embed = buildWeekendAnnouncementEmbed(race);
      await channel.send({ embeds: [embed] });
      markWeekendAnnounced(race.raceId);
      logger.info('Posted weekend announcement', { raceName: race.raceName, raceId: race.raceId });
    } catch (err) {
      logger.error('Failed to post weekend announcement', { error: String(err) });
    }
  }
}

/**
 * Check and post results for completed sessions.
 */
export async function checkSessionResults(client: Client): Promise<void> {
  const channel = getAnnouncementChannel(client);
  if (!channel) return;

  // Get all races this season and find ones with recently completed sessions
  const races = await getCurrentRaces();
  if (races.length === 0) return;

  const now = Date.now();

  for (const race of races) {
    const sessions = getSessionsFromSchedule(race.schedule);

    for (const { type, date, time } of sessions) {
      const dt = parseSessionDateTime(date, time);

      // Only check sessions that ended in the past (add ~3 hours buffer for race completion)
      if (!isInPast(dt)) continue;

      // Don't check sessions that are too old (more than 48 hours ago)
      const ageHours = (now - dt.toMillis()) / (1000 * 60 * 60);
      if (ageHours > 48) continue;

      const key = sessionResultKey(race.raceId, type);
      if (isResultPosted(key)) continue;

      // Determine year from the race's championshipId or date
      const year = parseInt(date.slice(0, 4), 10);
      const { lines, available } = await getSessionResults(type, year, race.round);

      if (!available) {
        // Results not yet published, skip for now
        continue;
      }

      try {
        const label = SESSION_LABELS[type];
        const embed = buildSessionResultEmbed(race.raceName, label, lines);
        await channel.send({ embeds: [embed] });
        markResultPosted(key);
        logger.info('Posted session results', {
          raceName: race.raceName,
          session: type,
          key,
        });
      } catch (err) {
        logger.error('Failed to post session results', { error: String(err), key });
      }
    }
  }
}

/**
 * Extract all non-null sessions from a schedule with their types.
 */
function getSessionsFromSchedule(
  schedule: RaceSchedule,
): { type: SessionType; date: string; time: string }[] {
  const sessions: { type: SessionType; date: string; time: string }[] = [];

  const mapping: { key: keyof RaceSchedule; type: SessionType }[] = [
    { key: 'fp1', type: SessionType.FP1 },
    { key: 'fp2', type: SessionType.FP2 },
    { key: 'fp3', type: SessionType.FP3 },
    { key: 'qualy', type: SessionType.Qualifying },
    { key: 'sprintQualy', type: SessionType.SprintQualifying },
    { key: 'sprintRace', type: SessionType.SprintRace },
    { key: 'race', type: SessionType.Race },
  ];

  for (const { key, type } of mapping) {
    const s = schedule[key];
    // The API returns { date: null, time: null } for sessions that don't exist
    // on a given weekend, so we must check the inner fields, not just truthiness.
    if (s && s.date && s.time) {
      sessions.push({ type, date: s.date, time: s.time });
    }
  }

  return sessions;
}

/**
 * Get the earliest session DateTime from a schedule.
 */
function getEarliestSessionTime(schedule: RaceSchedule) {
  const sessions = getSessionsFromSchedule(schedule);
  if (sessions.length === 0) return null;

  let earliest = parseSessionDateTime(sessions[0].date, sessions[0].time);
  for (let i = 1; i < sessions.length; i++) {
    const dt = parseSessionDateTime(sessions[i].date, sessions[i].time);
    if (dt < earliest) earliest = dt;
  }
  return earliest;
}
