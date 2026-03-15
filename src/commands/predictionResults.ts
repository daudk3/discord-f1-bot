/**
 * /prediction-results command — show the latest scored weekend results.
 */

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getNextRace } from '../services/f1api';
import { getWeekendState, getAllWeekends } from '../services/predictionStateStore';
import { buildPredictionResultsEmbed } from '../utils/predictionFormat';

export const data = new SlashCommandBuilder()
  .setName('prediction-results')
  .setDescription('View the latest scored prediction results');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  // Find the most recently scored weekend
  const weekends = getAllWeekends();
  const scoredWeekends = Object.values(weekends)
    .filter((w) => w.scored)
    .sort((a, b) => b.round - a.round);

  if (scoredWeekends.length === 0) {
    // Check if there's an active weekend that hasn't been scored yet
    const race = await getNextRace();
    if (race) {
      const weekend = getWeekendState(race.raceId);
      if (weekend && !weekend.scored) {
        await interaction.editReply(
          `**Round ${weekend.round}: ${weekend.raceName}** has not been scored yet.\n` +
          'Results will be available after the race.',
        );
        return;
      }
    }
    await interaction.editReply('No scored prediction weekends found yet this season.');
    return;
  }

  const latest = scoredWeekends[0];
  const embed = buildPredictionResultsEmbed(latest);
  await interaction.editReply({ embeds: [embed] });
}
