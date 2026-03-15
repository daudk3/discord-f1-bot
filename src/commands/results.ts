import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getRaceInfo, getSessionResults } from '../services/f1api';
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
  .setName('results')
  .setDescription('Show all session results for a specific race weekend')
  .addIntegerOption((opt) =>
    opt.setName('year').setDescription('Season year (e.g. 2025)').setRequired(true),
  )
  .addIntegerOption((opt) =>
    opt.setName('round').setDescription('Round number (e.g. 3)').setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const year = interaction.options.getInteger('year', true);
  const round = interaction.options.getInteger('round', true);

  const race = await getRaceInfo(year, round);
  if (!race) {
    await interaction.editReply(`No race found for ${year} round ${round}. Check the year and round number.`);
    return;
  }

  // Determine which sessions exist on this weekend
  const activeSessions = SESSION_ORDER.filter(({ key }) => {
    const s = race.schedule[key];
    return s && s.date && s.time;
  });

  if (activeSessions.length === 0) {
    await interaction.editReply(`No session schedule found for ${race.raceName}.`);
    return;
  }

  // Fetch all session results in parallel
  const fetches = await Promise.all(
    activeSessions.map(async ({ type }) => {
      const { lines, available } = await getSessionResults(type, year, round);
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
