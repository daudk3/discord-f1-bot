/**
 * /predict command — submit or update predictions for the current weekend.
 *
 * Subcommands:
 *   /predict pole <driver>
 *   /predict race <winner> <p2> <p3> <fastest_lap>
 *   /predict sprint <winner> <p2> <p3>
 *
 * Uses autocomplete for driver names.
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from 'discord.js';
import { getNextRace, getCurrentDriversList } from '../services/f1api';
import {
  ensureWeekendState,
  submitPicks,
  isSprintWeekend,
  getOpenCategories,
} from '../services/predictions';
import { getWeekendState } from '../services/predictionStateStore';
import { DriverPick, UserPicks, PredictionCategory } from '../types/predictions';
import { buildMyPredictionsEmbed } from '../utils/predictionFormat';

export const data = new SlashCommandBuilder()
  .setName('predict')
  .setDescription('Submit predictions for the current race weekend')
  .addSubcommand((sub) =>
    sub
      .setName('pole')
      .setDescription('Predict the pole position winner')
      .addStringOption((opt) =>
        opt.setName('driver').setDescription('Driver name').setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('race')
      .setDescription('Predict race winner, podium, and fastest lap')
      .addStringOption((opt) =>
        opt.setName('winner').setDescription('Race winner').setRequired(true).setAutocomplete(true),
      )
      .addStringOption((opt) =>
        opt.setName('p2').setDescription('Podium P2').setRequired(true).setAutocomplete(true),
      )
      .addStringOption((opt) =>
        opt.setName('p3').setDescription('Podium P3').setRequired(true).setAutocomplete(true),
      )
      .addStringOption((opt) =>
        opt.setName('fastest_lap').setDescription('Fastest lap driver').setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('sprint')
      .setDescription('Predict sprint winner and podium')
      .addStringOption((opt) =>
        opt.setName('winner').setDescription('Sprint winner').setRequired(true).setAutocomplete(true),
      )
      .addStringOption((opt) =>
        opt.setName('p2').setDescription('Sprint P2').setRequired(true).setAutocomplete(true),
      )
      .addStringOption((opt) =>
        opt.setName('p3').setDescription('Sprint P3').setRequired(true).setAutocomplete(true),
      ),
  );

/**
 * Handle autocomplete for driver name options.
 */
export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();
  const drivers = await getCurrentDriversList();

  const filtered = drivers
    .filter((d) => {
      const fullName = `${d.name} ${d.surname}`.toLowerCase();
      return (
        fullName.includes(focused) ||
        d.shortName.toLowerCase().includes(focused) ||
        d.surname.toLowerCase().includes(focused)
      );
    })
    .slice(0, 25)
    .map((d) => ({
      name: `${d.name} ${d.surname} (${d.shortName}) — ${d.teamName}`,
      value: `${d.driverId}::${d.shortName || d.surname}`,
    }));

  await interaction.respond(filtered);
}

/**
 * Parse a driver selection value from autocomplete.
 * Format: "driverId::displayName"
 */
function parsePick(value: string): DriverPick | null {
  const parts = value.split('::');
  if (parts.length < 2) return null;
  return { driverId: parts[0], displayName: parts[1] };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const race = await getNextRace();
  if (!race) {
    await interaction.editReply('No upcoming race weekend found. Try again later.');
    return;
  }

  const weekend = ensureWeekendState(race);
  const subcommand = interaction.options.getSubcommand();

  let newPicks: Partial<UserPicks> = {};

  if (subcommand === 'pole') {
    const pick = parsePick(interaction.options.getString('driver', true));
    if (!pick) {
      await interaction.editReply('Invalid driver selection. Please use the autocomplete suggestions.');
      return;
    }
    newPicks.pole = pick;
  } else if (subcommand === 'race') {
    const winner = parsePick(interaction.options.getString('winner', true));
    const p2 = parsePick(interaction.options.getString('p2', true));
    const p3 = parsePick(interaction.options.getString('p3', true));
    const fl = parsePick(interaction.options.getString('fastest_lap', true));

    if (!winner || !p2 || !p3 || !fl) {
      await interaction.editReply('Invalid driver selection. Please use the autocomplete suggestions.');
      return;
    }

    newPicks.raceWinner = winner;
    newPicks.racePodium = [winner, p2, p3];
    newPicks.fastestLap = fl;
  } else if (subcommand === 'sprint') {
    if (!isSprintWeekend(race.schedule)) {
      await interaction.editReply('This is not a sprint weekend. Sprint predictions are not available.');
      return;
    }

    const winner = parsePick(interaction.options.getString('winner', true));
    const p2 = parsePick(interaction.options.getString('p2', true));
    const p3 = parsePick(interaction.options.getString('p3', true));

    if (!winner || !p2 || !p3) {
      await interaction.editReply('Invalid driver selection. Please use the autocomplete suggestions.');
      return;
    }

    newPicks.sprintWinner = winner;
    newPicks.sprintPodium = [winner, p2, p3];
  }

  const result = submitPicks(race.raceId, interaction.user.id, newPicks);

  if (!result.success) {
    await interaction.editReply(`❌ ${result.message}`);
    return;
  }

  // Show confirmation with updated picks
  const updatedPicks = (await import('../services/predictionStateStore')).getUserPicks(race.raceId, interaction.user.id);
  const updatedWeekend = getWeekendState(race.raceId)!;

  if (updatedPicks) {
    const embed = buildMyPredictionsEmbed(updatedWeekend, updatedPicks);
    embed.setDescription(`✅ ${result.message}\n\n` + (embed.data.description || ''));
    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply(`✅ ${result.message}`);
  }
}
