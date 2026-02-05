require('dotenv').config();
const cron = require('node-cron');
const memorySystem = require('./memory-system');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

/**
 * Proactive Check-ins System
 *
 * Based on: https://godagoo.github.io/smart-checkins-presentation/
 *
 * Decision Framework:
 * - NONE: No notification (user continues uninterrupted)
 * - TEXT: Send Telegram message (non-urgent)
 * - CALL: Make voice call (urgent)
 *
 * Smart Gating:
 * - No contact within 2 hours of last check-in
 * - Sacred hours (7-10am): zero interruptions
 * - Quiet hours after 10pm
 * - 30-minute reminders before events
 */

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

class CheckInSystem {
  constructor(bot) {
    this.bot = bot;
    this.userId = parseInt(process.env.TELEGRAM_USER_ID);
    this.isRunning = false;
  }

  /**
   * Start proactive check-ins (every 30 minutes)
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Check-ins already running');
      return;
    }

    console.log('⏰ Starting proactive check-ins (every 30 minutes)...');

    // Run every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      await this.performCheckIn();
    });

    this.isRunning = true;
    console.log('✅ Check-ins started');
  }

  /**
   * Check if we're in sacred hours (7-10am) or quiet hours (after 10pm)
   */
  isRestrictedTime() {
    const now = new Date();
    const hour = now.getHours();

    // Sacred creative hours: 7-10am
    if (hour >= 7 && hour < 10) {
      console.log('🛡️  Sacred hours (7-10am) - skipping check-in');
      return true;
    }

    // Quiet hours: after 10pm
    if (hour >= 22) {
      console.log('🌙 Quiet hours (after 10pm) - skipping check-in');
      return true;
    }

    return false;
  }

  /**
   * Check if we contacted user too recently
   */
  async wasRecentContact() {
    const lastCheckIn = await memorySystem.getLastCheckIn(this.userId);

    if (!lastCheckIn) return false;

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const lastCheckInTime = new Date(lastCheckIn.created_at);

    if (lastCheckInTime > twoHoursAgo) {
      console.log('⏱️  Last check-in was less than 2 hours ago - skipping');
      return true;
    }

    return false;
  }

  /**
   * Collect context for check-in
   */
  async collectContext() {
    const gmailMonitor = require('./gmail-monitor');
    const calendarMonitor = require('./calendar-monitor');
    const notionMonitor = require('./notion-monitor');

    const context = {
      timestamp: new Date().toISOString(),
      goals: await memorySystem.getGoals(this.userId),
      memories: await memorySystem.getRelevantMemories(this.userId, '', 5),
      lastCheckIn: await memorySystem.getLastCheckIn(this.userId),
    };

    // Add Gmail context
    try {
      const gmailSummary = await gmailMonitor.getUrgentSummary();
      if (gmailSummary) {
        context.urgentEmails = gmailSummary;
      }
    } catch (error) {
      console.error('Error checking Gmail:', error.message);
    }

    // Add Calendar context
    try {
      const calendarSummary = await calendarMonitor.getEventsSummary();
      if (calendarSummary) {
        context.upcomingEvents = calendarSummary;
      }
    } catch (error) {
      console.error('Error checking Calendar:', error.message);
    }

    // Add Notion context
    try {
      const notionSummary = await notionMonitor.getTasksSummary();
      if (notionSummary) {
        context.tasks = notionSummary;
      }
    } catch (error) {
      console.error('Error checking Notion:', error.message);
    }

    return context;
  }

  /**
   * Ask Claude to decide: NONE, TEXT, or CALL
   */
  async makeDecision(context) {
    const prompt = `You are a proactive AI assistant performing a check-in.

**Current Context:**
- Time: ${context.timestamp}
- User's Goals: ${JSON.stringify(context.goals, null, 2)}
- Recent Memories: ${JSON.stringify(context.memories, null, 2)}
- Last Check-in: ${context.lastCheckIn ? context.lastCheckIn.created_at : 'Never'}
${context.urgentEmails ? `\n**URGENT EMAILS:**\n${context.urgentEmails}` : ''}
${context.upcomingEvents ? `\n**UPCOMING EVENTS:**\n${context.upcomingEvents}` : ''}
${context.tasks ? `\n**TASKS:**\n${context.tasks}` : ''}

**Your Task:**
Decide if you should contact the user. Output EXACTLY one of:
- NONE: No action needed (user is likely focused)
- TEXT: Send Telegram message (something worth mentioning but not urgent)
- CALL: Make voice call (urgent or time-sensitive)

**Decision Framework:**
- NONE: Use this 80% of the time. Only interrupt if truly important.
- TEXT: New opportunity, reminder, FYI update, non-urgent question
- CALL: Urgent deadline, important decision needed, time-sensitive matter

**Output Format:**
ACTION: [NONE|TEXT|CALL]
REASON: [brief explanation]
MESSAGE: [if TEXT or CALL, what to say to the user]

Make your decision:`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });

      const decision = response.content[0].text;
      console.log('🤖 Claude decision:', decision);

      return this.parseDecision(decision);
    } catch (error) {
      console.error('Error making decision:', error);
      return { action: 'NONE', reason: 'Error', message: null };
    }
  }

  /**
   * Parse Claude's decision
   */
  parseDecision(text) {
    const actionMatch = text.match(/ACTION:\s*(NONE|TEXT|CALL)/);
    const reasonMatch = text.match(/REASON:\s*(.+)/);
    const messageMatch = text.match(/MESSAGE:\s*(.+)/s);

    return {
      action: actionMatch ? actionMatch[1] : 'NONE',
      reason: reasonMatch ? reasonMatch[1].trim() : 'Unknown',
      message: messageMatch ? messageMatch[1].trim() : null,
    };
  }

  /**
   * Execute the decision
   */
  async executeDecision(decision) {
    switch (decision.action) {
      case 'NONE':
        console.log(`✨ No action needed: ${decision.reason}`);
        await memorySystem.logCheckIn(
          this.userId,
          'proactive',
          null,
          'NONE'
        );
        break;

      case 'TEXT':
        console.log(`📱 Sending text: ${decision.message}`);
        await this.bot.api.sendMessage(this.userId, decision.message);
        await memorySystem.logCheckIn(
          this.userId,
          'proactive',
          decision.message,
          'TEXT'
        );
        break;

      case 'CALL':
        console.log(`📞 Urgent situation detected - requesting permission to call`);
        await this.requestCallPermission(decision.message);
        await memorySystem.logCheckIn(
          this.userId,
          'proactive',
          decision.message,
          'CALL_REQUESTED'
        );
        break;
    }
  }

  /**
   * Perform a check-in cycle
   */
  async performCheckIn() {
    console.log('\n🔍 Performing check-in...');

    try {
      // 1. Check time restrictions
      if (this.isRestrictedTime()) {
        return;
      }

      // 2. Check if we contacted too recently
      if (await this.wasRecentContact()) {
        return;
      }

      // 3. Collect context
      const context = await this.collectContext();

      // 4. Make decision
      const decision = await this.makeDecision(context);

      // 5. Execute decision
      await this.executeDecision(decision);

    } catch (error) {
      console.error('❌ Check-in error:', error);
    }
  }

  /**
   * Request permission to call user
   */
  async requestCallPermission(message) {
    const { InlineKeyboard } = require('grammy');

    const keyboard = new InlineKeyboard()
      .text('✅ Call me now', 'call_yes')
      .text('❌ Just text', 'call_no');

    await this.bot.api.sendMessage(
      this.userId,
      `🚨 *Urgent Update*\n\n${message}\n\n_Should I call you to discuss this?_`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  }

  /**
   * Make the actual voice call using ElevenLabs with full context
   */
  async makeCall(reason, context = null) {
    const fetch = require('node-fetch');
    const gmailMonitor = require('./gmail-monitor');

    console.log('📞 Initiating ElevenLabs voice call with context...');

    try {
      // Get latest urgent emails if not provided
      let emailContext = '';
      if (context && context.urgentEmails) {
        emailContext = `\n\nUrgent emails:\n${context.urgentEmails}`;
      } else {
        const urgentSummary = await gmailMonitor.getUrgentSummary();
        if (urgentSummary) {
          emailContext = `\n\n${urgentSummary}`;
        }
      }

      // Get recent emails even if not urgent
      const recentEmails = await gmailMonitor.checkAllNewEmails();
      const recentContext = recentEmails.length > 0
        ? `\n\nRecent emails (last ${recentEmails.length}): ${recentEmails.slice(0, 5).map(e => `${e.from}: ${e.subject}`).join('; ')}`
        : '';

      const fullContext = `${reason}${emailContext}${recentContext}`;

      const response = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agent_id: 'agent_5201kgqb02jbf2w99y6xzhga3rmz',
          agent_phone_number_id: 'phnum_4401kgqb1zgzfbj921brbgr4cxdk',
          to_number: process.env.USER_PHONE_NUMBER,
          conversation_initiation_client_data: {
            conversation_config_override: {
              agent: {
                first_message: `Hello Carlos! I'm calling because: ${reason}`,
                prompt: {
                  prompt: `You are Carlos' personal AI assistant. You have access to his emails and can see:

${fullContext}

You just told him: "${reason}".

During this call:
- You can reference specific emails by sender and subject
- If he asks "what emails do I have", tell him about the recent/urgent ones
- Keep responses SHORT (1-2 sentences)
- Wait for his reply after each response
- Be conversational and helpful
- DO NOT end call unless he says goodbye

Speak naturally in English.`
                }
              }
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      console.log(`✅ Call initiated: ${result.callSid}`);

      await this.bot.api.sendMessage(
        this.userId,
        `📞 Llamándote ahora con tu propia voz... (${result.callSid})`
      );

      return result.callSid;
    } catch (error) {
      console.error('❌ Call error:', error.message);
      await this.bot.api.sendMessage(
        this.userId,
        `❌ Error al llamar: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Handle call permission response
   */
  setupCallbackHandlers() {
    this.bot.callbackQuery('call_yes', async (ctx) => {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        `${ctx.callbackQuery.message.text}\n\n✅ _Calling you now..._`,
        { parse_mode: 'Markdown' }
      );

      // Extract the reason from the message
      const reason = ctx.callbackQuery.message.text.split('\n\n')[1];
      await this.makeCall(reason);
    });

    this.bot.callbackQuery('call_no', async (ctx) => {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        `${ctx.callbackQuery.message.text}\n\n📱 _Okay, I'll just text you instead._`,
        { parse_mode: 'Markdown' }
      );
    });
  }

  /**
   * Test check-in (manual trigger)
   */
  async test() {
    console.log('🧪 Running test check-in...');
    await this.performCheckIn();
  }
}

module.exports = CheckInSystem;
