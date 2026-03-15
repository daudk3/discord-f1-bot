/**
 * /my-predictions command — view your current picks for the active weekend.
 */

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getNextRace } from '../services/f1api';
import { ensureWeekendState } from '../services/predictions';
import { getUserPicks, getWeekendState } from '../services/predictionStateStore';
import { buildMyPredictionsEmbed } from '../utils/predictionFormat';

export const data = new SlashCommandBuilder()
  .setName('my-predictions')
  .setDescription('View your current predictions for this weekend');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const race = await getNextRace();
  if (!race) {
    await interaction.editReply('No upcoming race weekend found.');
    return;
  }

  ensureWeekendState(race);
  const weekend = getWeekendState(race.raceId);
  if (!weekend) {
    await interaction.editReply('Could not load weekend prediction state.');
    return;
  }

  const picks = getUserPicks(race.raceId, interaction.user.id);
  if (!picks) {
    await interaction.editReply(
      `No predictions submitted yet for **Round ${weekend.round}: ${weekend.raceName}**.\n` +
      'Use `/predict pole`, `/predict race`, or `/predict sprint` to submit your picks.',
    );
    return;
  }

  const embed = buildMyPredictionsEmbed(weekend, picks);
  await interaction.editReply({ embeds: [embed] });
}
