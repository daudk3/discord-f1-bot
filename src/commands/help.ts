import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

const F1_RED = 0xe10600;

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show all available commands and how to use them');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(F1_RED)
    .setTitle('🏎️ F1 Bot — Command Guide')
    .setDescription('Here are all the commands you can use:')
    .addFields(
      {
        name: '📡 General',
        value:
          '`/ping` — Check if the bot is online\n' +
          '`/help` — Show this help message',
      },
      {
        name: '🏁 Race Info',
        value:
          '`/next` — Next race weekend schedule & session times\n' +
          '`/last` — Most recent race result (top 10)\n' +
          '`/drivers` — Current driver championship standings\n' +
          '`/constructors` — Current constructor standings',
      },
      {
        name: '🔮 Predictions',
        value:
          '`/predict pole <driver>` — Predict pole position winner\n' +
          '`/predict race <winner> <p2> <p3> <fastest_lap>` — Predict race winner, podium & fastest lap\n' +
          '`/predict sprint <winner> <p2> <p3>` — Predict sprint winner & podium (sprint weekends only)\n' +
          '`/my-predictions` — View your current picks for this weekend\n' +
          '`/prediction-standings` — Season prediction leaderboard\n' +
          '`/prediction-results` — Latest scored weekend results\n' +
          '`/prediction-rules` — Scoring rules & lock timing',
      },
      {
        name: '⏰ How Predictions Work',
        value:
          '1. Before each weekend the bot posts a **Predictions Open** message\n' +
          '2. Use `/predict` to submit your picks — driver autocomplete helps you choose\n' +
          '3. You can update picks by re-running the command until the lock time\n' +
          '4. Pole locks before qualifying, race picks lock before the race, sprint locks before sprint qualifying\n' +
          '5. After the race, predictions are scored automatically and standings update',
      },
    )
    .setFooter({ text: 'All times shown in Eastern Time • Powered by f1api.dev' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
