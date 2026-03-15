import { EmbedBuilder } from 'discord.js';
import {
  Race,
  RaceResult,
  QualyResult,
  FpResult,
  SprintRaceResult,
  SprintQualyResult,
  DriverStanding,
  ConstructorStanding,
  SessionType,
  SESSION_LABELS,
  RaceSchedule,
} from '../types/f1';
import { parseSessionDateTime, formatSessionTime, isInPast } from './time';

const F1_RED = 0xe10600;

/**
 * Build an embed for the /next command showing the next race weekend.
 */
export function buildNextRaceEmbed(race: Race): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(F1_RED)
    .setTitle(`🏎️ Round ${race.round}: ${race.raceName}`)
    .setURL(race.url || null)
    .addFields(
      { name: 'Circuit', value: race.circuit.circuitName, inline: true },
      { name: 'Location', value: `${race.circuit.city}, ${race.circuit.country}`, inline: true },
    );

  if (race.laps) {
    embed.addFields({ name: 'Laps', value: String(race.laps), inline: true });
  }

  // Build session schedule
  const scheduleLines = buildScheduleLines(race.schedule);
  if (scheduleLines.length > 0) {
    embed.addFields({ name: 'Session Schedule', value: scheduleLines.join('\n') });
  }

  embed.setFooter({ text: 'Times shown in Eastern Time' });

  return embed;
}

/**
 * Build formatted schedule lines from a RaceSchedule.
 */
export function buildScheduleLines(schedule: RaceSchedule): string[] {
  const lines: string[] = [];

  const sessions: { key: keyof RaceSchedule; label: string }[] = [
    { key: 'fp1', label: SESSION_LABELS[SessionType.FP1] },
    { key: 'fp2', label: SESSION_LABELS[SessionType.FP2] },
    { key: 'fp3', label: SESSION_LABELS[SessionType.FP3] },
    { key: 'sprintQualy', label: SESSION_LABELS[SessionType.SprintQualifying] },
    { key: 'sprintRace', label: SESSION_LABELS[SessionType.SprintRace] },
    { key: 'qualy', label: SESSION_LABELS[SessionType.Qualifying] },
    { key: 'race', label: SESSION_LABELS[SessionType.Race] },
  ];

  for (const session of sessions) {
    const s = schedule[session.key];
    if (!s) continue;

    const dt = parseSessionDateTime(s.date, s.time);
    const timeStr = formatSessionTime(dt);
    const status = isInPast(dt) ? '✅' : '⏳';
    lines.push(`${status} **${session.label}**: ${timeStr}`);
  }

  return lines;
}

/**
 * Build an embed for the /last command showing last race results.
 */
export function buildLastRaceEmbed(race: Race, results: RaceResult[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(F1_RED)
    .setTitle(`🏁 ${race.raceName} — Results`)
    .setURL(race.url || null);

  if (results.length === 0) {
    embed.setDescription('No results available yet.');
    return embed;
  }

  const top10 = results.slice(0, 10);
  const lines = top10.map((r) => {
    const name = r.driver?.shortName || `${r.driver?.name ?? ''} ${r.driver?.surname ?? ''}`.trim() || 'Unknown';
    const team = r.team?.teamName || '';
    const timeStr = r.retired ? 'DNF' : (r.time || '');
    const teamPart = team ? ` - ${team}` : '';
    const timePart = timeStr ? ` - ${timeStr}` : '';
    return `**${r.position}.** ${name}${teamPart}${timePart}`;
  });

  embed.setDescription(lines.join('\n'));
  embed.setFooter({ text: `Showing top ${top10.length} of ${results.length} classified` });

  return embed;
}

/**
 * Build an embed for the /drivers command.
 */
export function buildDriverStandingsEmbed(standings: DriverStanding[], season: string | number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(F1_RED)
    .setTitle(`🏆 ${season} Driver Standings`);

  const top10 = standings.slice(0, 10);
  const lines = top10.map((s) => {
    const name = s.driver?.shortName
      || `${s.driver?.name ?? ''} ${s.driver?.surname ?? ''}`.trim()
      || 'Unknown';
    const team = s.team?.teamName || '';
    const teamPart = team ? ` | ${team}` : '';
    return `**${s.position}.** ${name}${teamPart} — **${s.points}** pts`;
  });

  embed.setDescription(lines.join('\n'));
  embed.setFooter({ text: 'Top 10 drivers shown' });

  return embed;
}

/**
 * Build an embed for the /constructors command.
 */
export function buildConstructorStandingsEmbed(standings: ConstructorStanding[], season: string | number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(F1_RED)
    .setTitle(`🏗️ ${season} Constructor Standings`);

  const top10 = standings.slice(0, 10);
  const lines = top10.map((s) => {
    const name = s.team?.teamName || 'Unknown';
    return `**${s.position}.** ${name} — **${s.points}** pts`;
  });

  embed.setDescription(lines.join('\n'));
  embed.setFooter({ text: `Showing ${top10.length} constructors` });

  return embed;
}

/**
 * Build a pre-weekend announcement embed.
 */
export function buildWeekendAnnouncementEmbed(race: Race): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(F1_RED)
    .setTitle(`📅 Upcoming: Round ${race.round} — ${race.raceName}`)
    .addFields(
      { name: 'Circuit', value: race.circuit.circuitName, inline: true },
      { name: 'Location', value: `${race.circuit.city}, ${race.circuit.country}`, inline: true },
    );

  if (race.laps) {
    embed.addFields({ name: 'Laps', value: String(race.laps), inline: true });
  }

  const scheduleLines = buildScheduleLines(race.schedule);
  if (scheduleLines.length > 0) {
    embed.addFields({ name: 'Session Schedule', value: scheduleLines.join('\n') });
  }

  embed.setFooter({ text: 'Times shown in Eastern Time • Enjoy the race weekend!' });

  return embed;
}

/**
 * Build a spoiler-wrapped result message for a completed session.
 */
export function buildSessionResultEmbed(
  raceName: string,
  sessionLabel: string,
  lines: string[],
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(F1_RED)
    .setTitle(`🏁 ${raceName} — ${sessionLabel} Results`);

  if (lines.length === 0) {
    embed.setDescription('No results available.');
    return embed;
  }

  // Wrap each result line in spoiler tags
  const spoilerLines = lines.map((line) => `||${line}||`);
  embed.setDescription(spoilerLines.join('\n'));
  embed.setFooter({ text: 'Results hidden as spoilers — tap to reveal' });

  return embed;
}

/**
 * Format race results into spoiler-ready lines.
 */
export function formatRaceResultLines(results: RaceResult[]): string[] {
  return results.slice(0, 20).map((r) => {
    const name = r.driver?.shortName || `${r.driver?.name ?? ''} ${r.driver?.surname ?? ''}`.trim() || '???';
    const team = r.team?.teamName || '';
    const timeStr = r.retired ? 'DNF' : (r.time || '');
    return `${r.position}. ${name} - ${team} - ${timeStr}`.trim();
  });
}

/**
 * Format qualifying results into spoiler-ready lines.
 */
export function formatQualyResultLines(results: QualyResult[]): string[] {
  return results.slice(0, 20).map((r) => {
    const name = r.driver?.shortName || `${r.driver?.name ?? ''} ${r.driver?.surname ?? ''}`.trim() || '???';
    const team = r.team?.teamName || '';
    const bestTime = r.q3 || r.q2 || r.q1 || 'No time';
    return `${r.gridPosition}. ${name} - ${team} - ${bestTime}`;
  });
}

/**
 * Format FP results into spoiler-ready lines (sorted by time, no position field).
 */
export function formatFpResultLines(results: FpResult[]): string[] {
  // FP results from the API don't have a position; they may already be sorted by time
  return results.slice(0, 20).map((r, i) => {
    const name = r.driver?.shortName || `${r.driver?.name ?? ''} ${r.driver?.surname ?? ''}`.trim() || '???';
    const team = r.team?.teamName || '';
    const time = r.time || 'No time';
    return `${i + 1}. ${name} - ${team} - ${time}`;
  });
}

/**
 * Format sprint race results into spoiler-ready lines.
 */
export function formatSprintRaceResultLines(results: SprintRaceResult[]): string[] {
  return results.slice(0, 20).map((r) => {
    const name = r.driver?.shortName || `${r.driver?.name ?? ''} ${r.driver?.surname ?? ''}`.trim() || '???';
    const team = r.team?.teamName || '';
    return `${r.position}. ${name} - ${team} - ${r.points} pts`;
  });
}

/**
 * Format sprint qualifying results into spoiler-ready lines.
 */
export function formatSprintQualyResultLines(results: SprintQualyResult[]): string[] {
  return results.slice(0, 20).map((r) => {
    const name = r.driver?.shortName || `${r.driver?.name ?? ''} ${r.driver?.surname ?? ''}`.trim() || '???';
    const team = r.team?.teamName || '';
    const bestTime = r.sq3 || r.sq2 || r.sq1 || 'No time';
    return `${r.gridPosition}. ${name} - ${team} - ${bestTime}`;
  });
}
