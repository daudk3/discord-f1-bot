/**
 * /prediction-standings command — view the season prediction leaderboard.
 */

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getLeaderboard } from '../services/predictionStateStore';
import { buildSeasonStandingsEmbed } from '../utils/predictionFormat';

export const data = new SlashCommandBuilder()
  .setName('prediction-standings')
  .setDescription('View the season prediction championship leaderboard')
  .addIntegerOption((opt) =>
    opt
      .setName('limit')
      .setDescription('Number of entries to show (default: 10)')
      .setMinValue(1)
      .setMaxValue(50)
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const limit = interaction.options.getInteger('limit') ?? 10;
  const leaderboard = getLeaderboard();

  const embed = buildSeasonStandingsEmbed(leaderboard, limit);
  await interaction.editReply({ embeds: [embed] });
}
