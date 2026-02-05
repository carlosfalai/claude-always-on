require('dotenv').config();
const { Bot } = require('grammy');
const Anthropic = require('@anthropic-ai/sdk');
const memorySystem = require('./memory-system');
const CheckInSystem = require('./check-ins');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize bot
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// Your Telegram user ID (for security)
const AUTHORIZED_USER_ID = parseInt(process.env.TELEGRAM_USER_ID);

// Initialize check-in system
const checkIns = new CheckInSystem(bot);
checkIns.setupCallbackHandlers();

// Middleware: Security check - only respond to authorized user
bot.use(async (ctx, next) => {
  if (ctx.from?.id !== AUTHORIZED_USER_ID) {
    console.log(`❌ Unauthorized access attempt from user ${ctx.from?.id}`);
    return; // Ignore messages from unauthorized users
  }
  await next();
});

// Command: /start
bot.command('start', async (ctx) => {
  await ctx.reply(
    `🤖 *Claude Always-On v2.0*\n\n` +
    `I'm your 24/7 AI assistant, powered by Claude.\n\n` +
    `*New Features:*\n` +
    `✅ Persistent memory (Supabase)\n` +
    `✅ Proactive check-ins (every 30min)\n` +
    `✅ Goal tracking\n` +
    `🔜 Voice calling (coming soon)\n\n` +
    `*Commands:*\n` +
    `/start - Show this message\n` +
    `/help - Get help\n` +
    `/memory - View my memories\n` +
    `/goals - View your goals\n` +
    `/checkin - Test proactive check-in\n` +
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
    `• I have persistent memory - stored in Supabase\n` +
    `• I track your goals and progress\n` +
    `• I proactively check in every 30 minutes\n` +
    `• I respect sacred hours (7-10am) and quiet hours (after 10pm)\n\n` +
    `*Memory System:*\n` +
    `I automatically detect and store:\n` +
    `- Facts about you\n` +
    `- Your preferences\n` +
    `- Your goals\n\n` +
    `*Smart Check-ins:*\n` +
    `Every 30 minutes I review context and decide:\n` +
    `- NONE: Let you work (80% of the time)\n` +
    `- TEXT: Send message if something matters\n` +
    `- CALL: Voice call if urgent (coming soon)`,
    { parse_mode: 'Markdown' }
  );
});

// Command: /memory
bot.command('memory', async (ctx) => {
  const userId = ctx.from.id;
  const memories = await memorySystem.getRelevantMemories(userId, '', 10);

  if (memories.length === 0) {
    await ctx.reply('💭 I don\'t have any memories stored yet. Chat with me to build our history!');
    return;
  }

  let message = '🧠 *My Memories About You:*\n\n';
  memories.forEach((m, i) => {
    message += `${i + 1}. ${m.content}\n   _${m.category} • ${new Date(m.created_at).toLocaleDateString()}_\n\n`;
  });

  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// Command: /goals
bot.command('goals', async (ctx) => {
  const userId = ctx.from.id;
  const goals = await memorySystem.getGoals(userId);

  if (goals.length === 0) {
    await ctx.reply('🎯 You haven\'t set any goals yet. Tell me about your goals!');
    return;
  }

  let message = '🎯 *Your Goals:*\n\n';
  goals.forEach((g, i) => {
    const deadline = g.deadline ? ` (deadline: ${new Date(g.deadline).toLocaleDateString()})` : '';
    message += `${i + 1}. ${g.goal}\n   Status: _${g.progress}_${deadline}\n\n`;
  });

  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// Command: /checkin (test check-in manually)
bot.command('checkin', async (ctx) => {
  await ctx.reply('🔍 Running test check-in...');
  await checkIns.test();
  await ctx.reply('✅ Check-in completed!');
});

// Command: /stats
bot.command('stats', async (ctx) => {
  const userId = ctx.from.id;

  const [memories, goals, recentConversations, lastCheckIn] = await Promise.all([
    memorySystem.getRelevantMemories(userId, '', 100),
    memorySystem.getGoals(userId),
    memorySystem.getRecentConversations(userId, 100),
    memorySystem.getLastCheckIn(userId)
  ]);

  const lastCheckInTime = lastCheckIn
    ? new Date(lastCheckIn.created_at).toLocaleString()
    : 'Never';

  await ctx.reply(
    `📊 *Bot Statistics*\n\n` +
    `Memories stored: ${memories.length}\n` +
    `Active goals: ${goals.length}\n` +
    `Conversations: ${recentConversations.length}\n` +
    `Last check-in: ${lastCheckInTime}\n` +
    `Uptime: ${process.uptime().toFixed(0)}s\n` +
    `Status: 🟢 Online`,
    { parse_mode: 'Markdown' }
  );
});

// Handle text messages
bot.on('message:text', async (ctx) => {
  const userId = ctx.from.id;
  const userMessage = ctx.message.text;

  // Skip if it's a command
  if (userMessage.startsWith('/')) return;

  console.log(`[${new Date().toISOString()}] User: ${userMessage}`);

  try {
    // Store user message in Supabase
    await memorySystem.storeConversation(userId, 'user', userMessage);

    // Get recent conversation history from Supabase
    const recentConversations = await memorySystem.getRecentConversations(userId, 20);

    // Convert to Claude format
    const history = recentConversations.map(c => ({
      role: c.role,
      content: c.content
    }));

    // Build context from memory
    const context = await memorySystem.buildContext(userId, userMessage);

    // Show typing indicator
    await ctx.replyWithChatAction('typing');

    // Call Claude API with context
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: `You are Claude, a 24/7 AI assistant accessible via Telegram. You have persistent memory and can help with various tasks.

**Memory Context:**
${context}

**Your Capabilities:**
- Remember facts, preferences, and goals
- Proactively check in every 30 minutes
- Detect and store important information from conversations
- Track goal progress

**Important:**
- If the user mentions a goal, acknowledge it and confirm you'll track it
- If the user shares a preference or fact, confirm you'll remember it
- Be concise but thorough
- Use emojis occasionally

Respond naturally to the user's message.`,
      messages: history,
    });

    const assistantMessage = response.content[0].text;

    // Store assistant response in Supabase
    await memorySystem.storeConversation(userId, 'assistant', assistantMessage);

    // Detect and store goals/facts
    await detectAndStoreMemories(userId, userMessage, assistantMessage);

    console.log(`[${new Date().toISOString()}] Claude: ${assistantMessage.substring(0, 100)}...`);

    // Reply to user
    await ctx.reply(assistantMessage);

  } catch (error) {
    console.error('Error calling Claude API:', error);
    await ctx.reply('❌ Sorry, I encountered an error. Please try again.');
  }
});

/**
 * Detect and store goals/facts from conversation
 */
async function detectAndStoreMemories(userId, userMessage, assistantMessage) {
  try {
    // Use Claude to detect if this is a goal or important fact
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Analyze this conversation and detect if it contains:
1. A goal the user wants to achieve
2. An important fact or preference

User: ${userMessage}
Assistant: ${assistantMessage}

Output format:
TYPE: [GOAL|FACT|NONE]
CONTENT: [what to remember]
CATEGORY: [category name]

If NONE, just output "TYPE: NONE"`
      }]
    });

    const analysis = response.content[0].text;
    const typeMatch = analysis.match(/TYPE:\s*(GOAL|FACT|NONE)/);
    const contentMatch = analysis.match(/CONTENT:\s*(.+)/);
    const categoryMatch = analysis.match(/CATEGORY:\s*(.+)/);

    if (typeMatch && typeMatch[1] !== 'NONE' && contentMatch) {
      const type = typeMatch[1];
      const content = contentMatch[1].trim();
      const category = categoryMatch ? categoryMatch[1].trim() : 'general';

      if (type === 'GOAL') {
        await memorySystem.storeGoal(userId, content);
      } else if (type === 'FACT') {
        await memorySystem.storeMemory(userId, content, category);
      }
    }
  } catch (error) {
    console.error('Error detecting memories:', error);
  }
}

// Handle voice messages
bot.on('message:voice', async (ctx) => {
  const userId = ctx.from.id;

  try {
    await ctx.replyWithChatAction('typing');

    // Get voice file
    const voice = ctx.message.voice;
    const fileId = voice.file_id;

    console.log(`🎤 Received voice message from user ${userId}`);

    // Download voice file from Telegram
    const file = await ctx.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    console.log(`📥 Downloading voice file: ${fileUrl}`);

    // Download the file
    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');

    const response = await axios({
      url: fileUrl,
      method: 'GET',
      responseType: 'arraybuffer'
    });

    // Save temporarily
    const tempPath = path.join(__dirname, `voice_${Date.now()}.ogg`);
    fs.writeFileSync(tempPath, response.data);

    console.log(`💾 Saved to: ${tempPath}`);

    // TODO: Transcribe with Whisper API or similar
    // For now, acknowledge receipt
    await ctx.reply('🎤 Voice message received! Transcription coming soon...\n\n_Tip: You can also type your message._', {
      parse_mode: 'Markdown'
    });

    // Clean up
    fs.unlinkSync(tempPath);

  } catch (error) {
    console.error('Error handling voice message:', error);
    await ctx.reply('❌ Sorry, I had trouble processing your voice message. Can you type it instead?');
  }
});

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start bot
async function start() {
  console.log('🤖 Starting Claude Always-On v2.0...');

  // Initialize memory system
  await memorySystem.initialize();

  // Start dashboard
  const dashboard = require('./dashboard');
  dashboard.startDashboard();

  // Start bot
  bot.start({
    onStart: (botInfo) => {
      console.log(`✅ Bot started: @${botInfo.username}`);
      console.log(`🔐 Authorized user ID: ${AUTHORIZED_USER_ID}`);
      console.log(`📡 Listening for messages...`);
      console.log(`🧠 Memory system: Connected`);

      // Update dashboard status
      dashboard.updateStatus({ online: true });

      // Start proactive check-ins
      checkIns.start();
    }
  });
}

start();
