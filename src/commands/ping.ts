import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Health check — verify the bot is online');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const latency = Date.now() - interaction.createdTimestamp;
  await interaction.reply({ content: `🏎️ Pong! Latency: **${latency}ms** | API: **${interaction.client.ws.ping}ms**`, ephemeral: true });
}
