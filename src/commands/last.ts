import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getLastRace, getSessionResults } from '../services/f1api';
import { buildSessionResultEmbed } from '../utils/format';
import { SessionType, SESSION_LABELS, RaceSchedule } from '../types/f1';

const SESSION_ORDER: { key: keyof RaceSchedule; type: SessionType }[] = [
  { key: 'fp1', type: SessionType.FP1 },
  { key: 'fp2', type: SessionType.FP2 },
  { key: 'fp3', type: SessionType.FP3 },
  { key: 'sprintQualy', type: SessionType.SprintQualifying },
  { key: 'sprintRace', type: SessionType.SprintRace },
  { key: 'qualy', type: SessionType.Qualifying },
  { key: 'race', type: SessionType.Race },
];

export const data = new SlashCommandBuilder()
  .setName('last')
  .setDescription('Show all session results from the most recent race weekend');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const race = await getLastRace();
  if (!race) {
    await interaction.editReply('Could not fetch the last race. The API may be unavailable — try again later.');
    return;
  }

  // Determine which sessions existed on this weekend
  const activeSessions = SESSION_ORDER.filter(({ key }) => {
    const s = race.schedule[key];
    return s && s.date && s.time;
  });

  if (activeSessions.length === 0) {
    await interaction.editReply(`No session schedule found for ${race.raceName}.`);
    return;
  }

  // Extract year from the race schedule date
  const raceDate = race.schedule.race?.date ?? race.schedule.fp1?.date;
  const year = raceDate ? parseInt(raceDate.slice(0, 4), 10) : new Date().getFullYear();

  // Fetch all session results in parallel
  const fetches = await Promise.all(
    activeSessions.map(async ({ type }) => {
      const { lines, available } = await getSessionResults(type, year, race.round);
      return { type, lines, available };
    }),
  );

  const embeds = fetches
    .filter((f) => f.available)
    .map((f) => buildSessionResultEmbed(race.raceName, SESSION_LABELS[f.type], f.lines));

  if (embeds.length === 0) {
    await interaction.editReply(`No results available yet for ${race.raceName}.`);
    return;
  }

  // Discord allows up to 10 embeds per message
  await interaction.editReply({ embeds });
}
