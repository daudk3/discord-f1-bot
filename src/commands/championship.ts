import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getDriverStandingsByYear, getConstructorStandingsByYear } from '../services/f1api';
import { buildDriverStandingsEmbed, buildConstructorStandingsEmbed } from '../utils/format';

export const data = new SlashCommandBuilder()
  .setName('championship')
  .setDescription('Show driver and constructor standings for a specific season')
  .addIntegerOption((opt) =>
    opt.setName('year').setDescription('Season year (e.g. 2010)').setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const year = interaction.options.getInteger('year', true);

  const [driverData, constructorData] = await Promise.all([
    getDriverStandingsByYear(year),
    getConstructorStandingsByYear(year),
  ]);

  if (!driverData?.standings.length && !constructorData?.standings.length) {
    await interaction.editReply(`No championship data found for ${year}. Check the year is valid.`);
    return;
  }

  const embeds = [];
  if (driverData && driverData.standings.length > 0) {
    embeds.push(buildDriverStandingsEmbed(driverData.standings, driverData.season));
  }
  if (constructorData && constructorData.standings.length > 0) {
    embeds.push(buildConstructorStandingsEmbed(constructorData.standings, constructorData.season));
  }

  await interaction.editReply({ embeds });
}
