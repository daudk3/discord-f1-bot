# Deployment Guide — Linux VPS

This guide covers deploying the Discord F1 bot on a fresh Linux VPS (Ubuntu 22.04/24.04 or Debian 12). Two methods are covered: **Docker** (recommended) and **bare-metal with PM2**.

---

## Table of Contents

1. [Initial Server Setup](#1-initial-server-setup)
2. [Install Dependencies](#2-install-dependencies)
3. [Clone the Repository](#3-clone-the-repository)
4. [Configure Environment Variables](#4-configure-environment-variables)
5. [Method A: Docker (Recommended)](#5-method-a-docker-recommended)
6. [Method B: Bare-Metal with PM2](#6-method-b-bare-metal-with-pm2)
7. [Register Slash Commands](#7-register-slash-commands)
8. [Verify the Bot is Running](#8-verify-the-bot-is-running)
9. [Updates and Maintenance](#9-updates-and-maintenance)
10. [Monitoring and Alerts](#10-monitoring-and-alerts)

---

## 1. Initial Server Setup

### Create a non-root user

Log in as root, then create a dedicated user:

```bash
adduser botuser
usermod -aG sudo botuser
```

Switch to the new user for all remaining steps:

```bash
su - botuser
```

### Harden SSH (optional but recommended)

```bash
sudo nano /etc/ssh/sshd_config
```

Set these values:

```
PermitRootLogin no
PasswordAuthentication no
```

Reload SSH:

```bash
sudo systemctl reload ssh
```

Make sure you have your SSH key added to `~/.ssh/authorized_keys` before doing this, or you will lock yourself out.

### Configure the firewall

```bash
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

The bot does not listen on any port, so no other rules are needed.

---

## 2. Install Dependencies

### Install Node.js 20 via NodeSource

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # should print v20.x.x
npm -v
```

### Install Git

```bash
sudo apt-get install -y git
```

### Install Docker (if using Method A)

```bash
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

Allow your user to run Docker without sudo:

```bash
sudo usermod -aG docker botuser
newgrp docker
docker --version   # verify
```

---

## 3. Clone the Repository

```bash
cd ~
git clone https://github.com/your-username/discord-f1-bot.git
cd discord-f1-bot
```

---

## 4. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Fill in all required values:

```env
DISCORD_TOKEN=your-bot-token-here
DISCORD_CLIENT_ID=your-client-id-here
DISCORD_GUILD_ID=your-guild-id-here
DISCORD_ANNOUNCEMENT_CHANNEL_ID=your-channel-id-here
SESSION_ANNOUNCEMENT_HOURS_BEFORE=24
SESSION_RESULT_POLL_MINUTES=10
TIMEZONE=America/Toronto
```

**Finding your Discord values:**

| Value | Where to find it |
|-------|-----------------|
| `DISCORD_TOKEN` | Discord Developer Portal → Your App → Bot → Token |
| `DISCORD_CLIENT_ID` | Discord Developer Portal → Your App → General Information → Application ID |
| `DISCORD_GUILD_ID` | Right-click your server in Discord → Copy Server ID (requires Developer Mode on) |
| `DISCORD_ANNOUNCEMENT_CHANNEL_ID` | Right-click a text channel → Copy Channel ID |

Restrict the file permissions so only your user can read it:

```bash
chmod 600 .env
```

---

## 5. Method A: Docker (Recommended)

Docker is the cleanest option — it isolates dependencies and makes updates simple.

### Build and start

```bash
docker compose up -d --build
```

This will:
- Build the image (compiles TypeScript inside the container)
- Start the bot in a detached container
- Mount `./data` so `bot-state.json` persists between restarts

### Check it is running

```bash
docker compose ps
docker compose logs -f
```

### Enable auto-start on reboot

Docker Compose containers with `restart: unless-stopped` restart automatically when the Docker daemon starts. Ensure Docker itself starts on boot:

```bash
sudo systemctl enable docker
```

### Register slash commands (one-time)

```bash
docker compose run --rm f1-bot \
  node dist/scripts/deploy-commands.js
```

Or from the host with `ts-node` (see [Section 7](#7-register-slash-commands)).

---

## 6. Method B: Bare-Metal with PM2

Use this if you prefer to avoid Docker.

### Install and build

```bash
npm install
npm run build
```

### Install PM2

```bash
sudo npm install -g pm2
```

### Start the bot

```bash
pm2 start dist/src/index.js --name f1-bot
```

### Save the process list and enable startup on reboot

```bash
pm2 save
pm2 startup
```

PM2 will print a command to run — copy and execute it. It looks like:

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u botuser --hp /home/botuser
```

### Useful PM2 commands

```bash
pm2 status              # show all processes
pm2 logs f1-bot         # tail logs
pm2 logs f1-bot --lines 100   # last 100 lines
pm2 restart f1-bot      # restart
pm2 stop f1-bot         # stop
pm2 delete f1-bot       # remove from PM2
```

---

## 7. Register Slash Commands

This step registers the `/ping`, `/next`, `/last`, `/drivers`, and `/constructors` commands with Discord. It only needs to be run once (or again after adding new commands).

### Guild-scoped (instant — use for first setup)

```bash
npm run deploy-commands
```

### Global (propagates in up to 1 hour)

```bash
npx ts-node scripts/deploy-commands.ts --global
```

If you are running inside Docker and do not have `ts-node` on the host, you can run the compiled version:

```bash
# First build the project locally or inside the container
node dist/scripts/deploy-commands.js
```

---

## 8. Verify the Bot is Running

1. Open Discord and go to your server.
2. Type `/ping` — the bot should respond immediately with its latency.
3. Type `/next` — should return the upcoming race weekend.
4. Check the announcement channel after the next scheduled session for automatic posts.

**Check logs for any errors:**

```bash
# Docker
docker compose logs -f

# PM2
pm2 logs f1-bot
```

---

## 9. Updates and Maintenance

### Pull the latest code

```bash
cd ~/discord-f1-bot
git pull
```

### Update with Docker

```bash
docker compose up -d --build
```

Docker will rebuild the image and recreate the container. The `./data` volume is preserved.

### Update with PM2

```bash
npm install
npm run build
pm2 restart f1-bot
```

### Rotate the bot token

If you need to rotate your Discord token:

```bash
nano .env   # update DISCORD_TOKEN

# Docker
docker compose up -d

# PM2
pm2 restart f1-bot
```

### Clear posted state (re-post announcements)

If you want the bot to re-announce something it has already posted, edit or delete the state file:

```bash
# View current state
cat data/bot-state.json

# Reset all state (will re-announce everything it finds pending)
echo '{"announcedWeekends":[],"postedResults":[],"lastCheck":null}' > data/bot-state.json

# Restart the bot so it picks up the reset state
docker compose restart   # or: pm2 restart f1-bot
```

---

## 10. Monitoring and Alerts

### View live logs

```bash
# Docker
docker compose logs -f --tail=100

# PM2
pm2 logs f1-bot --lines 100
```

### Check disk usage of the state file

The `data/bot-state.json` file grows over the course of a season as race IDs accumulate. It stays small (a few kilobytes), but you can inspect it:

```bash
wc -c data/bot-state.json
cat data/bot-state.json | python3 -m json.tool
```

### Set up log rotation with PM2

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Simple uptime monitoring

If you want to know when the bot goes offline, use a free external monitor like [UptimeRobot](https://uptimerobot.com) or [Betterstack](https://betterstack.com). Since the bot has no HTTP endpoint, you would add a minimal health check server.

**Optional: add a tiny health check endpoint** (add to `src/index.ts` before `client.login`):

```typescript
import * as http from 'http';

http.createServer((_, res) => {
  res.writeHead(client.isReady() ? 200 : 503);
  res.end(client.isReady() ? 'OK' : 'Not ready');
}).listen(3000);
```

Then expose port 3000 in `docker-compose.yml`:

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

And point your uptime monitor at `http://your-vps-ip:3000`.

---

## Troubleshooting

**Bot is online but commands are not showing up:**
Run `npm run deploy-commands` again. Guild commands are instant; global commands take up to 1 hour.

**`MODULE_NOT_FOUND` error for `index.cjs`:**
The `@f1api/sdk` package has a packaging bug. Run the postinstall manually:
```bash
npm run postinstall
```
Or if using Docker, rebuild the image — the Dockerfile handles it.

**Announcements are not posting:**
- Check that `DISCORD_ANNOUNCEMENT_CHANNEL_ID` is set in `.env`.
- Check that the bot has **Send Messages** and **Embed Links** permissions in that channel.
- Check the logs for `Scheduler` lines to confirm it is running.
- Inspect `data/bot-state.json` to see if the weekend/session is already marked as posted.

**Bot crashes on startup:**
- Verify `DISCORD_TOKEN` is correct and not expired.
- Check `npm run build` completes without errors.
- Review the full log output for the specific error message.
