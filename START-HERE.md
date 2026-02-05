# 🚀 Claude Always-On - Quick Start Guide

Your 24/7 AI assistant is ready to go! Follow these steps to get started.

---

## ✅ What's Already Configured

All your API keys and credentials are set up in `.env`:
- ✅ Anthropic API (Claude Sonnet 4.5)
- ✅ Telegram Bot Token
- ✅ Your Telegram User ID
- ✅ ElevenLabs API + Voice
- ✅ Twilio (for voice calls)
- ✅ Supabase (for memory)

---

## 📋 Setup Steps

### Step 1: Set Up Supabase Database (2 minutes)

1. Go to: https://supabase.com/dashboard/project/gbxksgxezbljwlnlpkpz
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**
4. Open file: `setup-supabase.sql`
5. Copy/paste the entire SQL into the query editor
6. Click **Run**
7. You should see: "Success. No rows returned"

**Tables created:**
- `semantic_memory` - Facts, preferences
- `goals` - Your tracked goals
- `check_in_logs` - Proactive check-in history
- `conversations` - Full conversation history

---

### Step 2: Start the Bot (30 seconds)

```bash
cd "C:\Users\Carlos Faviel Font\claude-always-on"
node bot-v2.js
```

You should see:
```
🤖 Starting Claude Always-On v2.0...
🧠 Initializing memory system...
✅ Memory system ready
✅ Bot started: @your_bot_name
🔐 Authorized user ID: 1889374592
📡 Listening for messages...
🧠 Memory system: Connected
⏰ Starting proactive check-ins (every 30 minutes)...
✅ Check-ins started
📊 Dashboard running at http://localhost:3001
```

---

### Step 3: Test in Telegram (2 minutes)

1. Open Telegram
2. Search for your bot (the username you created)
3. Send: `/start`

You should get a welcome message!

**Try these:**
- `/help` - See all features
- `I want to learn Spanish this year` - Bot will detect this as a goal
- `/goals` - View tracked goals
- `/memory` - See what it remembers
- `/checkin` - Test proactive check-in manually
- `/stats` - View bot statistics

---

### Step 4: View Dashboard (optional)

Open in browser: http://localhost:3001

The dashboard shows:
- Bot status (online/offline)
- Uptime
- Memory count
- Active goals
- Last check-in time
- Recent memories

---

## 🎯 Features

### 1. Persistent Memory
The bot remembers:
- Facts about you
- Your preferences
- Conversation history
- All stored in Supabase (survives restarts)

### 2. Goal Tracking
Say something like:
- "I want to learn Spanish"
- "My goal is to exercise 3x per week"
- "I need to finish the project by March"

Bot will detect and track it! Check with `/goals`

### 3. Proactive Check-ins (Every 30 minutes)
The bot checks:
- Your memory/goals
- Time of day

Then decides:
- **NONE** (80% of time) - Let you work
- **TEXT** - Send message if something matters
- **CALL** - Voice call if urgent (coming soon)

**Smart Gating:**
- No contact within 2 hours of last check-in
- Sacred hours (7-10am): Zero interruptions
- Quiet hours (after 10pm): No disturbance

### 4. Voice Calling (Coming Soon)
- Bidirectional calls (you call it, it calls you)
- Uses ElevenLabs conversational AI
- Post-call transcript processing
- Action item extraction

---

## 🛠️ Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Show all features |
| `/memory` | View stored memories |
| `/goals` | View active goals |
| `/checkin` | Test proactive check-in |
| `/stats` | Bot statistics |

---

## 📊 Monitoring

**Dashboard:** http://localhost:3001
- Auto-refreshes every 30 seconds
- Shows real-time status
- View memories and goals

**Console Logs:**
Watch the terminal where bot is running to see:
- Incoming messages
- Claude responses
- Check-in decisions
- Memory operations

---

## 🔧 Troubleshooting

### Bot won't start
- Check `.env` file has all values filled
- Run: `npm install` to ensure dependencies

### "Unauthorized access attempt"
- Your Telegram user ID doesn't match
- Check `.env` has correct `TELEGRAM_USER_ID`

### Supabase errors
- Run the SQL setup script first
- Check Supabase URL and key in `.env`

### Check-ins not working
- Wait 30 minutes for first check-in
- Or test manually with `/checkin`
- Check console logs for errors

---

## 💰 Costs

**Monthly estimate:**
- Claude Code Max: $200 (fixed)
- ElevenLabs: $5-20 (variable)
- Twilio: ~$10 (if using calls)
- Supabase: Free tier

**Total: ~$220-250/month fixed**

Compare to ClawdBot: $150-5000/month variable

---

## 🚀 What's Next?

1. ✅ Test basic messaging
2. ✅ Let it learn about you (chat for 10 minutes)
3. ✅ Check `/memory` and `/goals`
4. ✅ Wait for proactive check-in (30 min)
5. ⏳ Add voice calling webhooks
6. ⏳ Integrate with Gmail/Calendar for better check-ins

---

## 🎉 You're Ready!

Your 24/7 AI assistant is running. Start chatting and let it learn about you!

**Questions?** Check the bot logs or dashboard for status.

---

**Built in 2 hours. Cost: $220/month. Features: All of ClawdBot + custom voice + better security.**
