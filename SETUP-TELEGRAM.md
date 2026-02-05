# Telegram Bot Setup

## Step 1: Create Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send: `/newbot`
3. Choose a name: `Claude Always-On` (or whatever you want)
4. Choose a username: `carlos_claude_bot` (must end in `bot`)
5. BotFather will give you a **bot token** like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
6. Copy this token to `.env` file as `TELEGRAM_BOT_TOKEN`

## Step 2: Get Your Telegram User ID

1. Search for **@userinfobot** on Telegram
2. Send: `/start`
3. It will reply with your user ID (a number like `123456789`)
4. Copy this to `.env` file as `TELEGRAM_USER_ID`

## Step 3: Start the Bot

```bash
npm start
```

## Step 4: Test It

1. Search for your bot in Telegram (the username you chose)
2. Send: `/start`
3. You should get a reply!

---

**Security Note:** The bot will ONLY respond to your Telegram user ID. Anyone else messaging it will be ignored.
