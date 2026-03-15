import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getNextRace } from '../services/f1api';
import { buildNextRaceEmbed } from '../utils/format';

export const data = new SlashCommandBuilder()
  .setName('next')
  .setDescription('Show the next Formula 1 race weekend schedule');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const race = await getNextRace();
  if (!race) {
    await interaction.editReply('Could not fetch the next race. The API may be unavailable — try again later.');
    return;
  }

  const embed = buildNextRaceEmbed(race);
  await interaction.editReply({ embeds: [embed] });
}
