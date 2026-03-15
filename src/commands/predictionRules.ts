/**
 * /prediction-rules command — show scoring rules and lock behavior.
 */

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { buildScoringRulesEmbed } from '../utils/predictionFormat';

export const data = new SlashCommandBuilder()
  .setName('prediction-rules')
  .setDescription('View prediction scoring rules and lock timing');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const embed = buildScoringRulesEmbed();
  await interaction.editReply({ embeds: [embed] });
}
