import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getCurrentConstructorStandings } from '../services/f1api';
import { buildConstructorStandingsEmbed } from '../utils/format';

export const data = new SlashCommandBuilder()
  .setName('constructors')
  .setDescription('Show the current Formula 1 constructor standings');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const data = await getCurrentConstructorStandings();
  if (!data || data.standings.length === 0) {
    await interaction.editReply('Could not fetch constructor standings. The API may be unavailable — try again later.');
    return;
  }

  const embed = buildConstructorStandingsEmbed(data.standings, data.season);
  await interaction.editReply({ embeds: [embed] });
}
