require('dotenv').config();
const { Bot } = require('grammy');
const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize bot
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// Your Telegram user ID (for security)
const AUTHORIZED_USER_ID = parseInt(process.env.TELEGRAM_USER_ID);

// Conversation memory (in-memory for now, will move to Supabase)
const conversationHistory = new Map();

// Middleware: Security check - only respond to authorized user
bot.use(async (ctx, next) => {
  if (ctx.from?.id !== AUTHORIZED_USER_ID) {
    console.log(`Unauthorized access attempt from user ${ctx.from?.id}`);
    return; // Ignore messages from unauthorized users
  }
  await next();
});

// Command: /start
bot.command('start', async (ctx) => {
  await ctx.reply(
    `🤖 *Claude Always-On*\n\n` +
    `I'm your 24/7 AI assistant, powered by Claude.\n\n` +
    `*Available Commands:*\n` +
    `/start - Show this message\n` +
    `/help - Get help\n` +
    `/clear - Clear conversation history\n` +
    `/stats - Show bot statistics\n\n` +
    `Just send me a message and I'll respond!`,
    { parse_mode: 'Markdown' }
  );
});

// Command: /help
bot.command('help', async (ctx) => {
  await ctx.reply(
    `*How to use:*\n\n` +
    `• Send text messages - I'll respond using Claude\n` +
    `• Send voice messages - (coming soon)\n` +
    `• I have memory - I remember our conversations\n` +
    `• I can proactively check in - (coming soon)\n` +
    `• I can call you - (coming soon)\n\n` +
    `*Commands:*\n` +
    `/clear - Clear my memory of our conversation\n` +
    `/stats - See how much we've talked`,
    { parse_mode: 'Markdown' }
  );
});

// Command: /clear
bot.command('clear', async (ctx) => {
  const userId = ctx.from.id;
  conversationHistory.delete(userId);
  await ctx.reply('✅ Conversation history cleared!');
});

// Command: /stats
bot.command('stats', async (ctx) => {
  const userId = ctx.from.id;
  const history = conversationHistory.get(userId) || [];
  await ctx.reply(
    `📊 *Bot Statistics*\n\n` +
    `Messages in memory: ${history.length}\n` +
    `Uptime: ${process.uptime().toFixed(0)}s\n` +
    `Status: 🟢 Online`,
    { parse_mode: 'Markdown' }
  );
});

// Handle voice messages
bot.on('message:voice', async (ctx) => {
  const userId = ctx.from.id;
  console.log(`[${new Date().toISOString()}] Received voice message from user ${userId}`);

  try {
    await ctx.reply('🎤 Voice messages coming soon! For now, please send text messages.');
  } catch (error) {
    console.error('Error handling voice:', error);
  }
});

// Handle text messages
bot.on('message:text', async (ctx) => {
  const userId = ctx.from.id;
  const userMessage = ctx.message.text;

  // Skip if it's a command
  if (userMessage.startsWith('/')) return;

  console.log(`[${new Date().toISOString()}] User: ${userMessage}`);

  // Get or create conversation history
  if (!conversationHistory.has(userId)) {
    conversationHistory.set(userId, []);
  }
  const history = conversationHistory.get(userId);

  // Add user message to history
  history.push({ role: 'user', content: userMessage });

  // Keep only last 20 messages (10 exchanges)
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }

  try {
    // Show typing indicator
    await ctx.replyWithChatAction('typing');

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: `You are Claude, a helpful AI assistant accessible 24/7 via Telegram. You have access to the user's conversation history and can help with various tasks. Be concise but thorough. Use emojis occasionally to make responses friendly.`,
      messages: history,
    });

    const assistantMessage = response.content[0].text;

    // Add assistant response to history
    history.push({ role: 'assistant', content: assistantMessage });

    console.log(`[${new Date().toISOString()}] Claude: ${assistantMessage.substring(0, 100)}...`);

    // Reply to user
    await ctx.reply(assistantMessage);

  } catch (error) {
    console.error('Error calling Claude API:', error);
    await ctx.reply('❌ Sorry, I encountered an error. Please try again.');
  }
});

// Handle voice messages (placeholder for now)
bot.on('message:voice', async (ctx) => {
  await ctx.reply('🎤 Voice message support coming soon!');
});

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start bot
console.log('🤖 Starting Claude Always-On bot...');
bot.start({
  onStart: (botInfo) => {
    console.log(`✅ Bot started: @${botInfo.username}`);
    console.log(`🔐 Authorized user ID: ${AUTHORIZED_USER_ID}`);
    console.log(`📡 Listening for messages...`);
  }
});
