/**
 * Discord embed builders for the prediction championship system.
 */

import { EmbedBuilder } from 'discord.js';
import { DateTime } from 'luxon';
import {
  PredictionWeekendState,
  LeaderboardEntry,
  WeekendUserScore,
  UserPicks,
  SCORING,
  CATEGORY_LABELS,
  PredictionCategory,
} from '../types/predictions';
import { Race } from '../types/f1';
import { getTimezone } from './time';

const F1_RED = 0xe10600;
const PREDICTION_BLUE = 0x3498db;

// ─── Leaderboard formatting ─────────────────────────────────

function formatLeaderboardLines(entries: LeaderboardEntry[], limit = 10): string {
  if (entries.length === 0) return '_No predictions yet this season._';

  return entries.slice(0, limit).map((e, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
    return `${medal} ${e.displayName} — **${e.totalPoints}** pts (${e.weekendCount} weekend${e.weekendCount !== 1 ? 's' : ''})`;
  }).join('\n');
}

// ─── Lock time formatting ────────────────────────────────────

function formatLockTime(isoString: string): string {
  const dt = DateTime.fromISO(isoString).setZone(getTimezone());
  return dt.toFormat("ccc, LLL dd · hh:mm a 'ET'");
}

// ─── "Predictions Open" embed ────────────────────────────────

export function buildPredictionsOpenEmbed(
  race: Race,
  weekend: PredictionWeekendState,
  leaderboard: LeaderboardEntry[],
  isSprint: boolean,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(PREDICTION_BLUE)
    .setTitle(`🔮 Predictions Open — Round ${race.round}: ${race.raceName}`)
    .setDescription(
      'Submit your predictions before the lock times below!\n' +
      'Use `/predict` to submit or update your picks.',
    );

  // Categories and lock times
  const categoryLines: string[] = [];

  categoryLines.push('**Race Predictions** (lock before qualifying):');
  categoryLines.push(`  • Pole Position`);
  categoryLines.push(`  ⏰ Lock: ${formatLockTime(weekend.lockWindows.qualyLock)}`);
  categoryLines.push('');
  categoryLines.push('**Race Predictions** (lock before race):');
  categoryLines.push(`  • Race Winner`);
  categoryLines.push(`  • Race Podium (P1, P2, P3)`);
  categoryLines.push(`  • Fastest Lap`);
  categoryLines.push(`  ⏰ Lock: ${formatLockTime(weekend.lockWindows.raceLock)}`);

  if (isSprint && weekend.lockWindows.sprintLock) {
    categoryLines.push('');
    categoryLines.push('**Sprint Predictions** (lock before sprint qualifying):');
    categoryLines.push(`  • Sprint Winner`);
    categoryLines.push(`  • Sprint Podium (P1, P2, P3)`);
    categoryLines.push(`  ⏰ Lock: ${formatLockTime(weekend.lockWindows.sprintLock)}`);
  }

  embed.addFields({ name: 'Prediction Categories', value: categoryLines.join('\n') });

  // Commands
  embed.addFields({
    name: 'How to Predict',
    value:
      '`/predict pole` — Pick pole position winner\n' +
      '`/predict race` — Pick race winner, podium, fastest lap\n' +
      (isSprint ? '`/predict sprint` — Pick sprint winner & podium\n' : '') +
      '`/my-predictions` — View your current picks\n' +
      '`/prediction-rules` — View scoring rules',
  });

  // Season leaderboard
  embed.addFields({
    name: '🏆 Season Standings',
    value: formatLeaderboardLines(leaderboard),
  });

  embed.setFooter({ text: 'Times shown in Eastern Time • Picks can be updated until lock time' });

  return embed;
}

// ─── "Weekend Prediction Results" embed ──────────────────────

export function buildWeekendResultsEmbed(
  weekend: PredictionWeekendState,
  leaderboard: LeaderboardEntry[],
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(F1_RED)
    .setTitle(`📊 Prediction Results — Round ${weekend.round}: ${weekend.raceName}`);

  const scores = weekend.scores ?? [];

  if (scores.length === 0) {
    embed.setDescription('No predictions were submitted for this weekend.');
  } else {
    // Weekend top scorers
    const topLines = scores.slice(0, 10).map((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
      const breakdownStr = Object.entries(s.breakdown)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      const detail = breakdownStr ? ` (${breakdownStr})` : '';
      return `${medal} ${s.displayName} — **${s.total}** pts${detail}`;
    }).join('\n');

    embed.addFields({ name: '🎯 Weekend Top Scorers', value: topLines || '_None_' });

    // Biggest mover (find who gained the most relative to their pre-weekend position)
    if (scores.length > 0) {
      const topScorer = scores[0];
      if (topScorer.total > 0) {
        embed.addFields({
          name: '⭐ Weekend Winner',
          value: `${topScorer.displayName} with **${topScorer.total}** points!`,
          inline: true,
        });
      }
    }
  }

  // Updated season leaderboard
  embed.addFields({
    name: '🏆 Updated Season Standings',
    value: formatLeaderboardLines(leaderboard),
  });

  embed.setFooter({ text: 'Season standings updated • Use /prediction-standings for full view' });

  return embed;
}

// ─── User picks display ─────────────────────────────────────

export function buildMyPredictionsEmbed(
  weekend: PredictionWeekendState,
  picks: UserPicks,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(PREDICTION_BLUE)
    .setTitle(`🔮 Your Predictions — Round ${weekend.round}: ${weekend.raceName}`);

  const lines: string[] = [];

  lines.push(`**Pole Position:** ${picks.pole?.displayName ?? '_not set_'}`);
  lines.push(`**Race Winner:** ${picks.raceWinner?.displayName ?? '_not set_'}`);

  if (picks.racePodium) {
    lines.push(`**Race Podium:**`);
    lines.push(`  P1: ${picks.racePodium[0]?.displayName ?? '_not set_'}`);
    lines.push(`  P2: ${picks.racePodium[1]?.displayName ?? '_not set_'}`);
    lines.push(`  P3: ${picks.racePodium[2]?.displayName ?? '_not set_'}`);
  } else {
    lines.push(`**Race Podium:** _not set_`);
  }

  lines.push(`**Fastest Lap:** ${picks.fastestLap?.displayName ?? '_not set_'}`);

  if (weekend.isSprint) {
    lines.push('');
    lines.push(`**Sprint Winner:** ${picks.sprintWinner?.displayName ?? '_not set_'}`);
    if (picks.sprintPodium) {
      lines.push(`**Sprint Podium:**`);
      lines.push(`  P1: ${picks.sprintPodium[0]?.displayName ?? '_not set_'}`);
      lines.push(`  P2: ${picks.sprintPodium[1]?.displayName ?? '_not set_'}`);
      lines.push(`  P3: ${picks.sprintPodium[2]?.displayName ?? '_not set_'}`);
    } else {
      lines.push(`**Sprint Podium:** _not set_`);
    }
  }

  embed.setDescription(lines.join('\n'));

  // Show lock status
  const lockLines: string[] = [];
  const now = DateTime.utc();

  const qualyLocked = now >= DateTime.fromISO(weekend.lockWindows.qualyLock);
  lockLines.push(`Pole: ${qualyLocked ? '🔒 Locked' : `⏳ Locks ${formatLockTime(weekend.lockWindows.qualyLock)}`}`);

  const raceLocked = now >= DateTime.fromISO(weekend.lockWindows.raceLock);
  lockLines.push(`Race picks: ${raceLocked ? '🔒 Locked' : `⏳ Locks ${formatLockTime(weekend.lockWindows.raceLock)}`}`);

  if (weekend.isSprint && weekend.lockWindows.sprintLock) {
    const sprintLocked = now >= DateTime.fromISO(weekend.lockWindows.sprintLock);
    lockLines.push(`Sprint picks: ${sprintLocked ? '🔒 Locked' : `⏳ Locks ${formatLockTime(weekend.lockWindows.sprintLock)}`}`);
  }

  embed.addFields({ name: 'Lock Status', value: lockLines.join('\n') });

  return embed;
}

// ─── Season standings ────────────────────────────────────────

export function buildSeasonStandingsEmbed(
  leaderboard: LeaderboardEntry[],
  limit: number,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(PREDICTION_BLUE)
    .setTitle('🏆 Prediction Championship Standings');

  embed.setDescription(formatLeaderboardLines(leaderboard, limit));

  embed.setFooter({
    text: `Showing top ${Math.min(limit, leaderboard.length)} of ${leaderboard.length} participants • Tie-break: perfect picks, then weekends participated`,
  });

  return embed;
}

// ─── Scoring rules ───────────────────────────────────────────

export function buildScoringRulesEmbed(): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(PREDICTION_BLUE)
    .setTitle('📋 Prediction Scoring Rules');

  embed.addFields({
    name: 'Main Race',
    value:
      `• Correct **Race Winner**: ${SCORING.RACE_WINNER} pts\n` +
      `• Correct **Podium** driver in exact position: ${SCORING.PODIUM_EXACT} pts\n` +
      `• Correct **Podium** driver, wrong position: ${SCORING.PODIUM_ON_PODIUM} pts\n` +
      `• Correct **Pole Position**: ${SCORING.POLE_POSITION} pts\n` +
      `• Correct **Fastest Lap**: ${SCORING.FASTEST_LAP} pts`,
  });

  embed.addFields({
    name: 'Sprint (sprint weekends only)',
    value:
      `• Correct **Sprint Winner**: ${SCORING.SPRINT_WINNER} pts\n` +
      `• Correct **Sprint Podium** exact position: ${SCORING.SPRINT_PODIUM_EXACT} pts\n` +
      `• Correct **Sprint Podium** wrong position: ${SCORING.SPRINT_PODIUM_ON_PODIUM} pts`,
  });

  embed.addFields({
    name: 'Lock Timing',
    value:
      '• **Pole** predictions lock before qualifying\n' +
      '• **Race** predictions lock before race start\n' +
      '• **Sprint** predictions lock before sprint qualifying\n' +
      `• Default offset: configurable (env \`PREDICTION_LOCK_MINUTES_BEFORE\`)`,
  });

  embed.addFields({
    name: 'Tie-Breaking',
    value:
      '1. Higher total season points\n' +
      '2. More categories with points earned (\"perfect picks\")\n' +
      '3. More weekends participated\n' +
      '4. Alphabetical (final fallback)',
  });

  embed.addFields({
    name: 'Max Points Per Weekend',
    value:
      `Non-sprint: ${SCORING.RACE_WINNER + SCORING.PODIUM_EXACT * 3 + SCORING.POLE_POSITION + SCORING.FASTEST_LAP} pts\n` +
      `Sprint weekend: ${SCORING.RACE_WINNER + SCORING.PODIUM_EXACT * 3 + SCORING.POLE_POSITION + SCORING.FASTEST_LAP + SCORING.SPRINT_WINNER + SCORING.SPRINT_PODIUM_EXACT * 3} pts`,
  });

  return embed;
}

// ─── Weekend results display ─────────────────────────────────

export function buildPredictionResultsEmbed(
  weekend: PredictionWeekendState,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(F1_RED)
    .setTitle(`📊 Prediction Results — Round ${weekend.round}: ${weekend.raceName}`);

  if (!weekend.scored || !weekend.scores) {
    embed.setDescription('This weekend has not been scored yet. Results will appear after the race.');
    return embed;
  }

  const scores = weekend.scores;
  if (scores.length === 0) {
    embed.setDescription('No predictions were submitted for this weekend.');
    return embed;
  }

  const lines = scores.map((s, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
    return `${medal} ${s.displayName} — **${s.total}** pts`;
  }).join('\n');

  embed.setDescription(lines);

  return embed;
}
