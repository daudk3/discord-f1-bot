/**
 * Register slash commands with Discord.
 *
 * Usage:
 *   npx ts-node scripts/deploy-commands.ts         # register to a specific guild (fast, for dev)
 *   npx ts-node scripts/deploy-commands.ts --global # register globally (takes up to 1 hour)
 */

import 'dotenv/config';
import { REST, Routes } from 'discord.js';

import * as ping from '../src/commands/ping';
import * as help from '../src/commands/help';
import * as next from '../src/commands/next';
import * as last from '../src/commands/last';
import * as drivers from '../src/commands/drivers';
import * as constructors from '../src/commands/constructors';
import * as predict from '../src/commands/predict';
import * as myPredictions from '../src/commands/myPredictions';
import * as predictionStandings from '../src/commands/predictionStandings';
import * as predictionRules from '../src/commands/predictionRules';
import * as predictionResults from '../src/commands/predictionResults';
import * as results from '../src/commands/results';

const commands = [
  ping, help, next, last, drivers, constructors,
  predict, myPredictions, predictionStandings, predictionRules, predictionResults,
  results,
].map((c) => c.data.toJSON());

async function main(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId) {
    console.error('DISCORD_TOKEN and DISCORD_CLIENT_ID must be set in .env');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const isGlobal = process.argv.includes('--global');

  try {
    if (isGlobal) {
      console.log(`Registering ${commands.length} commands globally...`);
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('Global commands registered. May take up to 1 hour to propagate.');
    } else {
      if (!guildId) {
        console.error('DISCORD_GUILD_ID must be set in .env for guild-scoped registration.');
        console.error('Use --global flag for global registration instead.');
        process.exit(1);
      }
      console.log(`Registering ${commands.length} commands to guild ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log('Guild commands registered. Available immediately.');
    }
  } catch (err) {
    console.error('Failed to register commands:', err);
    process.exit(1);
  }
}

main();
