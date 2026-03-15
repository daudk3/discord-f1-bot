import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getLastRace, getLastRaceResults } from '../services/f1api';
import { buildLastRaceEmbed } from '../utils/format';
import { Race, RaceResult } from '../types/f1';

export const data = new SlashCommandBuilder()
  .setName('last')
  .setDescription('Show the most recent Formula 1 race result');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const [race, resultData] = await Promise.all([
    getLastRace(),
    getLastRaceResults(),
  ]);

  if (!race) {
    await interaction.editReply('Could not fetch the last race. The API may be unavailable — try again later.');
    return;
  }

  const results: RaceResult[] = resultData?.results ?? [];
  const embed = buildLastRaceEmbed(race, results);
  await interaction.editReply({ embeds: [embed] });
}
