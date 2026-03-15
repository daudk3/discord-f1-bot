# Discord F1 Bot

A Discord bot for Formula 1 information, powered by [f1api.dev](https://f1api.dev) via the official `@f1api/sdk` package.

## Features

### Slash Commands

| Command | Description |
|---------|-------------|
| `/ping` | Health check — shows bot latency |
| `/next` | Next race weekend schedule with all session times |
| `/last` | Most recent race result (top 10 finishers) |
| `/drivers` | Current driver championship standings (top 10) |
| `/constructors` | Current constructor championship standings |

### Automatic Announcements

When configured with a channel ID, the bot automatically:

- **Pre-weekend schedule** — Posts an embed with the full session schedule before each race weekend (configurable lead time, default 24 hours before first session).
- **Post-session results** — After each session completes (FP1–FP3, Qualifying, Sprint Qualifying, Sprint Race, Race), posts results wrapped in Discord spoiler tags so users can choose to reveal them.

Both announcement types track what has been posted in a local JSON file to avoid duplicates, even across restarts.

## Setup

### Prerequisites

- Node.js 18+
- A Discord bot token ([Discord Developer Portal](https://discord.com/developers/applications))

### Install

```bash
git clone <repo-url>
cd discord-f1-bot
npm install
```

### Environment Variables

Copy the example and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Yes | Application ID from Discord Developer Portal |
| `DISCORD_GUILD_ID` | Yes* | Server ID for guild-scoped command registration |
| `DISCORD_ANNOUNCEMENT_CHANNEL_ID` | No | Channel ID for automatic announcements |
| `SESSION_ANNOUNCEMENT_HOURS_BEFORE` | No | Hours before first session to post schedule (default: 24) |
| `SESSION_RESULT_POLL_MINUTES` | No | Polling interval for result checks in minutes (default: 10) |
| `TIMEZONE` | No | IANA timezone for displayed times (default: `America/Toronto`) |

\* Required for guild-scoped command registration. Not needed if using `--global`.

### Register Slash Commands

**Guild-scoped (instant, for development):**

```bash
npm run deploy-commands
```

**Global (takes up to 1 hour to propagate):**

```bash
npx ts-node scripts/deploy-commands.ts --global
```

### Run

**Development (with ts-node):**

```bash
npm run dev
```

**Production (compiled):**

```bash
npm run build
npm start
```

## Architecture

```
src/
├── index.ts              # Bot entry point, event handlers
├── commands/             # Slash command definitions
│   ├── ping.ts
│   ├── next.ts
│   ├── last.ts
│   ├── drivers.ts
│   └── constructors.ts
├── services/             # Business logic
│   ├── f1api.ts          # Centralized SDK access (all @f1api/sdk calls)
│   ├── scheduler.ts      # In-process polling scheduler
│   ├── announcements.ts  # Weekend + result posting logic
│   └── stateStore.ts     # JSON file persistence for posted state
├── utils/                # Shared helpers
│   ├── format.ts         # Discord embed builders
│   ├── cache.ts          # In-memory TTL cache
│   ├── time.ts           # Timezone-aware date/time utilities
│   └── logger.ts         # Structured logger
└── types/                # TypeScript type definitions
    ├── f1.ts             # F1 data types (extracted from SDK responses)
    └── state.ts          # Bot state types
```

All F1 API access is centralized in `src/services/f1api.ts`. Discord commands never touch the SDK directly.

## Scheduler Behavior

- The scheduler runs inside the bot process (no external cron needed).
- On startup, it immediately checks for pending announcements and results.
- It then polls on the configured interval (`SESSION_RESULT_POLL_MINUTES`).
- Weekend announcements are posted when the first session is within `SESSION_ANNOUNCEMENT_HOURS_BEFORE` hours.
- Session results are only posted once they become available from the API and only for sessions that ended in the last 48 hours.
- Posted state is persisted to `data/bot-state.json` to survive restarts.

## Timezone Handling

- All times from the F1 API are in UTC.
- All human-facing times are displayed in Eastern Time using the IANA timezone `America/Toronto`.
- This correctly handles EST/EDT daylight saving transitions.
- To use a different timezone, set the `TIMEZONE` environment variable to any valid IANA timezone identifier.
- "ET" in output labels refers to Eastern Time (the `America/Toronto` zone).

## Caching

The bot uses an in-memory TTL cache to reduce redundant API calls:

| Data | TTL |
|------|-----|
| Next race | 1 hour |
| Last race | 6 hours |
| Standings | 6 hours |
| Race results | 30 minutes |
| Session results | 15 minutes |
| All current races | 1 hour |

## SDK Notes & Limitations

This bot uses `@f1api/sdk` v1.1.0. Key observations:

- **SDK bug:** The SDK's `package.json` `exports` field references `./dist/index.cjs` but the actual file is `./dist/index.js`. The `postinstall` script creates a symlink to work around this. If you see a `MODULE_NOT_FOUND` error for `index.cjs`, run `npm run postinstall`.
- **No exported inner types:** The SDK exports response-level types (`RaceApiResponse`, etc.) but not inner data types (`Race`, `DriverStandings`, etc.). This project defines its own matching types in `src/types/f1.ts`.
- **FP results have no position field:** Free practice results from the API include times but no explicit position/ranking. The bot displays them in the order returned (assumed to be fastest-first).
- **Sprint sessions are nullable:** Sprint Qualifying and Sprint Race schedule entries are `null` for non-sprint weekends. The bot handles this gracefully.
- **`getLastFpXResults` requires an object parameter:** Even though all fields are optional, you must pass at least `{}`.
- **Response shapes may vary:** The bot validates for null/undefined before accessing nested fields to avoid crashes on unexpected API responses.

## Assumptions

1. The F1 API returns session times in UTC.
2. Sprint sessions are simply absent (null) from non-sprint weekends.
3. FP results are returned in fastest-to-slowest order.
4. The bot is run from the project root directory (for `data/bot-state.json` path resolution).
5. "ET" in the output refers to Eastern Time (`America/Toronto`), not "ETC".

## License

ISC
