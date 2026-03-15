import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getCurrentDriverStandings } from '../services/f1api';
import { buildDriverStandingsEmbed } from '../utils/format';

export const data = new SlashCommandBuilder()
  .setName('drivers')
  .setDescription('Show the current Formula 1 driver standings');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const data = await getCurrentDriverStandings();
  if (!data || data.standings.length === 0) {
    await interaction.editReply('Could not fetch driver standings. The API may be unavailable — try again later.');
    return;
  }

  const embed = buildDriverStandingsEmbed(data.standings, data.season);
  await interaction.editReply({ embeds: [embed] });
}
