# Claude Always-On

24/7 AI assistant powered by Claude, accessible via Telegram with voice calling and proactive check-ins.

## Features

**Phase 1 (✅ Complete):**
- 🤖 Telegram bot with Claude integration
- 💬 Text conversations with memory
- 🔐 Security (only responds to your user ID)
- ⚡ Fast responses using Claude Sonnet 4.5

**Phase 2 (⏳ Coming):**
- 📞 Bidirectional voice calling (11labs + Twilio)
- 🎤 Voice message support

**Phase 3 (⏳ Coming):**
- 🧠 Persistent memory system (Supabase)
- 📝 Goal tracking

**Phase 4 (⏳ Coming):**
- ⏰ Proactive check-ins (every 30 minutes)
- 📧 Email monitoring
- 📅 Calendar integration

**Phase 5 (⏳ Coming):**
- 🎯 Post-call actions
- 🔄 Task execution

**Phase 6 (⏳ Coming):**
- 📊 Observability dashboard

## Quick Start

### 1. Set Up Telegram Bot

Follow instructions in `SETUP-TELEGRAM.md` to:
1. Create bot with @BotFather
2. Get your bot token
3. Get your user ID
4. Add both to `.env` file

### 2. Start the Bot

```bash
npm start
```

### 3. Test It

Search for your bot in Telegram and send: `/start`

## Commands

- `/start` - Welcome message
- `/help` - Show help
- `/clear` - Clear conversation history
- `/stats` - Show bot statistics

## Architecture

```
User (Telegram)
    ↕
Telegram Bot (Grammy)
    ↕
Claude API (Sonnet 4.5)
    ↕
Memory (Supabase) [coming soon]
```

## Cost

- **Claude Code Max Plan:** $200/month (fixed)
- **11labs:** ~$10/month (when added)
- **Twilio:** ~$10/month (when added)
- **Supabase:** Free tier
- **Total:** ~$220-250/month fixed

Compare to ClawdBot: $150-5000/month variable (often $500+)

## Security

- Only responds to your Telegram user ID
- Bot token secured in .env
- Runs locally on your machine
- No data exposure to external services

## Development

```bash
# Development mode (auto-restart)
npm run dev

# Production mode
npm start
```

## Next Steps

1. ✅ Phase 1: Basic Telegram bot
2. Add voice calling
3. Add Supabase memory
4. Add proactive check-ins
5. Add observability dashboard

## Credits

Inspired by ClawdBot and the Claude Code community.
