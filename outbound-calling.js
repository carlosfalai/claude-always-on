require('dotenv').config();
const twilio = require('twilio');
const memorySystem = require('./memory-system');

/**
 * Outbound Calling System
 *
 * Bot calls YOU when:
 * 1. Proactive check-in decides "CALL" is needed
 * 2. You click "Call me" button in Telegram
 * 3. Manual trigger via /callme command
 */

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

class OutboundCalling {
  constructor(bot) {
    this.bot = bot;
    this.userId = parseInt(process.env.TELEGRAM_USER_ID);
    this.userPhone = process.env.USER_PHONE_NUMBER;
    this.activeCall = null;
  }

  /**
   * Initiate call to user
   */
  async callUser(reason = 'Check-in', message = null) {
    if (!this.userPhone) {
      console.error('❌ USER_PHONE_NUMBER not set in .env');
      throw new Error('Phone number not configured');
    }

    console.log(`📞 Calling user: ${this.userPhone}`);
    console.log(`   Reason: ${reason}`);

    try {
      // Notify via Telegram first
      await this.bot.api.sendMessage(
        this.userId,
        `📞 Calling you now...\n\nReason: ${reason}${message ? `\n\n${message}` : ''}`
      );

      // Build context for the call
      const context = await this.buildCallContext(reason, message);

      // Make the call via Twilio
      // The call will connect to our webhook server, which will create the ElevenLabs agent
      const call = await twilioClient.calls.create({
        from: process.env.TWILIO_PHONE_CA, // Bot's Twilio number
        to: this.userPhone, // User's phone
        url: `${process.env.WEBHOOK_BASE_URL}/voice/outbound?reason=${encodeURIComponent(reason)}`,
        method: 'POST',
        statusCallback: `${process.env.WEBHOOK_BASE_URL}/voice/status`,
        statusCallbackEvent: ['completed', 'failed'],
        record: true,
        recordingStatusCallback: `${process.env.WEBHOOK_BASE_URL}/voice/recording`,
        timeout: 30 // Ring for 30 seconds max
      });

      this.activeCall = {
        callSid: call.sid,
        reason: reason,
        startTime: new Date(),
        message: message
      };

      console.log(`✅ Call initiated: ${call.sid}`);
      console.log(`   Status: ${call.status}`);

      return call;

    } catch (error) {
      console.error('❌ Error initiating call:', error);

      // Notify user via Telegram
      await this.bot.api.sendMessage(
        this.userId,
        `❌ Failed to call you: ${error.message}`
      );

      throw error;
    }
  }

  /**
   * Build context for the call
   */
  async buildCallContext(reason, message) {
    const [memories, goals, recentConversations] = await Promise.all([
      memorySystem.getRelevantMemories(this.userId, '', 5),
      memorySystem.getGoals(this.userId),
      memorySystem.getRecentConversations(this.userId, 10)
    ]);

    let context = `**Call Reason:** ${reason}\n`;
    if (message) {
      context += `**Message:** ${message}\n`;
    }
    context += '\n';

    if (memories.length > 0) {
      context += '**Things I remember:**\n';
      memories.forEach(m => context += `- ${m.content}\n`);
      context += '\n';
    }

    if (goals.length > 0) {
      context += '**Active goals:**\n';
      goals.forEach(g => context += `- ${g.goal} (${g.progress})\n`);
      context += '\n';
    }

    if (recentConversations.length > 0) {
      context += '**Recent conversation:**\n';
      recentConversations.slice(-5).forEach(c => {
        context += `${c.role}: ${c.content.substring(0, 80)}...\n`;
      });
    }

    return context;
  }

  /**
   * Handle call completion
   */
  async handleCallComplete(callSid, duration, recordingUrl) {
    console.log(`✅ Call completed: ${callSid}`);
    console.log(`   Duration: ${duration}s`);

    if (recordingUrl) {
      console.log(`   Recording: ${recordingUrl}`);
    }

    // Store in memory
    if (this.activeCall && this.activeCall.callSid === callSid) {
      await memorySystem.storeConversation(
        this.userId,
        'system',
        `Phone call: ${this.activeCall.reason} (${duration}s)`,
        'phone'
      );

      // Send summary to Telegram
      await this.bot.api.sendMessage(
        this.userId,
        `✅ Call ended\n\nDuration: ${duration}s\nReason: ${this.activeCall.reason}`
      );

      this.activeCall = null;
    }
  }
}

module.exports = OutboundCalling;
