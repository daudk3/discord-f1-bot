import 'dotenv/config';
import {
  Client,
  Collection,
  GatewayIntentBits,
  Events,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { logger } from './utils/logger';
import { loadState } from './services/stateStore';
import { startScheduler, stopScheduler } from './services/scheduler';

// Import commands
import * as ping from './commands/ping';
import * as next from './commands/next';
import * as last from './commands/last';
import * as drivers from './commands/drivers';
import * as constructors from './commands/constructors';

// ─── Types ────────────────────────────────────────────────────

interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// ─── Client setup ─────────────────────────────────────────────

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Register commands in a collection
const commands = new Collection<string, Command>();
const commandModules: Command[] = [ping, next, last, drivers, constructors];
for (const mod of commandModules) {
  commands.set(mod.data.name, mod);
}

// ─── Event handlers ───────────────────────────────────────────

client.once(Events.ClientReady, (readyClient) => {
  logger.info(`Bot online as ${readyClient.user.tag}`);

  // Load persisted state
  loadState();

  // Start the announcement/result scheduler
  if (process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID) {
    startScheduler(client);
  } else {
    logger.warn('DISCORD_ANNOUNCEMENT_CHANNEL_ID not set — scheduler disabled');
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    logger.warn('Unknown command received', { command: interaction.commandName });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    logger.error('Command execution failed', {
      command: interaction.commandName,
      error: String(err),
    });

    const reply = {
      content: 'Something went wrong while processing that command. Please try again later.',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

// ─── Graceful shutdown ────────────────────────────────────────

function shutdown(): void {
  logger.info('Shutting down...');
  stopScheduler();
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ─── Start ────────────────────────────────────────────────────

const token = process.env.DISCORD_TOKEN;
if (!token) {
  logger.error('DISCORD_TOKEN is not set in environment variables');
  process.exit(1);
}

client.login(token).catch((err) => {
  logger.error('Failed to log in to Discord', { error: String(err) });
  process.exit(1);
});
