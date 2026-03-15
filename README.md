# Discord F1 Bot

A Discord bot for Formula 1 information, powered by [f1api.dev](https://f1api.dev) via the official `@f1api/sdk` package.

## Features

### Slash Commands

| Command | Description |
|---------|-------------|
| `/ping` | Health check — shows bot latency |
| `/help` | Show all available commands |
| `/next` | Next race weekend schedule with all session times |
| `/last` | Most recent race result |
| `/results <year> <round>` | All session results for a specific race weekend |
| `/drivers` | Current driver championship standings (top 10) |
| `/constructors` | Current constructor championship standings |
| `/championship <year>` | Driver & constructor standings for any season |
| `/predict pole` | Predict the pole position winner |
| `/predict race` | Predict race winner, podium (P1–P3), and fastest lap |
| `/predict sprint` | Predict sprint winner and podium (sprint weekends only) |
| `/my-predictions` | View your current picks for this weekend |
| `/prediction-standings` | View the season prediction championship leaderboard |
| `/prediction-rules` | View scoring rules and lock timing |
| `/prediction-results` | View the latest scored weekend prediction results |

All slash command responses are ephemeral (visible only to the invoking user).

### Automatic Announcements

When configured with a channel ID, the bot automatically:

- **Pre-weekend schedule** — Posts an embed with the full session schedule before each race weekend (configurable lead time, default 24 hours before first session).
- **Post-session results** — After each session completes (FP1–FP3, Qualifying, Sprint Qualifying, Sprint Race, Race), posts results wrapped in Discord spoiler tags so users can choose to reveal them.

Both announcement types track what has been posted in a local JSON file to avoid duplicates, even across restarts.

### Prediction Championship

A season-long predictions game where users submit picks for each race weekend and earn points based on accuracy. See the dedicated section below for full details.

### Display

- Driver names are prefixed with their national flag emoji based on nationality data from f1api.dev.
- Session schedules show completion status indicators and times in Eastern Time.
- Spoiler results are wrapped in a single block so one tap reveals everything.

## Setup

### Prerequisites

- Node.js 18+
- A Discord bot token ([Discord Developer Portal](https://discord.com/developers/applications))

### Install

```bash
git clone https://github.com/daudk3/discord-f1-bot
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
| `DISCORD_PREDICTIONS_CHANNEL_ID` | No | Channel ID for prediction announcements and leaderboard |
| `PREDICTION_LOCK_MINUTES_BEFORE` | No | Minutes before a session to lock predictions (default: 5) |
| `ENABLE_SPRINT_PREDICTIONS` | No | Enable sprint predictions on sprint weekends (default: `true`) |
| `ENABLE_WEEKEND_PREDICTION_POSTS` | No | Enable automated prediction open/results posts (default: `true`) |

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
├── index.ts                    # Bot entry point, event handlers
├── commands/                   # Slash command definitions
│   ├── ping.ts
│   ├── help.ts
│   ├── next.ts
│   ├── last.ts
│   ├── results.ts              # /results <year> <round>
│   ├── drivers.ts
│   ├── constructors.ts
│   ├── championship.ts         # /championship <year>
│   ├── predict.ts              # /predict pole|race|sprint (with autocomplete)
│   ├── myPredictions.ts        # /my-predictions
│   ├── predictionStandings.ts  # /prediction-standings
│   ├── predictionRules.ts      # /prediction-rules
│   └── predictionResults.ts    # /prediction-results
├── services/                   # Business logic
│   ├── f1api.ts                # Centralized SDK access (all @f1api/sdk calls)
│   ├── scheduler.ts            # In-process polling scheduler
│   ├── announcements.ts        # Weekend + result posting logic
│   ├── stateStore.ts           # JSON file persistence for posted state
│   ├── predictions.ts          # Prediction orchestration (locking, scoring, auto-posts)
│   ├── predictionScoring.ts    # Scoring logic
│   └── predictionStateStore.ts # Prediction state persistence
├── utils/                      # Shared helpers
│   ├── format.ts               # Discord embed builders
│   ├── predictionFormat.ts     # Prediction-specific embed builders
│   ├── nationality.ts          # Nationality-to-flag emoji mapping
│   ├── cache.ts                # In-memory TTL cache
│   ├── time.ts                 # Timezone-aware date/time utilities
│   └── logger.ts               # Structured logger
└── types/                      # TypeScript type definitions
    ├── f1.ts                   # F1 data types (extracted from SDK responses)
    ├── state.ts                # Bot state types
    └── predictions.ts          # Prediction types (picks, scoring, leaderboard)
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

## Prediction Championship

### Overview

The bot includes a season-long prediction championship where Discord users submit picks for each race weekend and earn points based on accuracy. Standings accumulate across the season.

### Poll-Style UX

Native Discord polls are not suitable for this system because they lack multi-field structured input, editable picks, separate scoring categories, and lock timing. Instead, the bot implements a **poll-style UX** through:

- **Public "Predictions Open" embeds** — posted automatically before each weekend to the predictions channel, showing categories, lock times, and the current season leaderboard.
- **Slash commands with autocomplete** — `/predict pole`, `/predict race`, `/predict sprint` let users submit structured picks with driver autocomplete. Users can re-run commands to update picks until the lock time.
- **Ephemeral confirmations** — all prediction submissions and views are private to the invoking user.
- **Public "Weekend Results" embeds** — posted automatically after scoring, showing weekend top scorers and the updated season leaderboard.

### Prediction Categories

**Race predictions (every weekend):**
- **Pole Position** — locks before qualifying
- **Race Winner** — locks before race
- **Race Podium** (P1, P2, P3) — locks before race
- **Fastest Lap** — locks before race

**Sprint predictions (sprint weekends only):**
- **Sprint Winner** — locks before sprint qualifying
- **Sprint Podium** (P1, P2, P3) — locks before sprint qualifying

Sprint categories only appear when the weekend has sprint sessions according to f1api.dev data.

### Scoring Rules

| Category | Condition | Points |
|----------|-----------|--------|
| Race Winner | Correct | 10 |
| Podium | Exact position | 8 per driver |
| Podium | On podium, wrong position | 4 per driver |
| Pole Position | Correct | 6 |
| Fastest Lap | Correct | 4 |
| Sprint Winner | Correct | 6 |
| Sprint Podium | Exact position | 4 per driver |
| Sprint Podium | On podium, wrong position | 2 per driver |

**Max points per weekend:** 44 (non-sprint) or 62 (sprint)

**Tie-breaking:** (1) higher total points, (2) more categories with points earned, (3) more weekends participated, (4) alphabetical.

### Lock Timing

Predictions lock automatically before the relevant session:
- Pole predictions lock before qualifying start
- Race predictions lock before race start
- Sprint predictions lock before sprint qualifying start

The offset is configurable via `PREDICTION_LOCK_MINUTES_BEFORE` (default: 5 minutes). All lock times are displayed in Eastern Time.

### Automated Posts

When `DISCORD_PREDICTIONS_CHANNEL_ID` is set and `ENABLE_WEEKEND_PREDICTION_POSTS=true`:

1. **"Predictions Open"** — posted before each weekend (within the same window as the schedule announcement). Includes: race info, prediction categories, lock times, how to submit, and the current top 10 season leaderboard.
2. **"Weekend Prediction Results"** — posted after the race is scored. Includes: weekend top scorers, scoring breakdown, and the updated top 10 season leaderboard.

Both posts are tracked in state to avoid duplicates across restarts.

### Scoring Trigger

Scoring runs automatically via the scheduler after the race end time + 3 hours. It fetches official results from f1api.dev (qualifying for pole, race results for winner/podium, race info for fastest lap, sprint results if applicable). If results are not yet available, scoring is deferred until the next check.

### State Persistence

Prediction state is stored in `data/prediction-state.json`, separate from the main bot state. It tracks:
- Weekend prediction configurations and lock windows
- All user picks per weekend
- Scored results and official results used for scoring
- Cumulative season leaderboard
- Which announcement/result posts have been sent

## Acknowledgements

Special thanks to the [f1api.dev](https://f1api.dev) team for providing a free, comprehensive, and well-maintained Formula 1 API. This bot would not be possible without their work.

## License

This project is licensed under the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html). See [LICENSE](LICENSE) for details.
