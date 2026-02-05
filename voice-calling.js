require('dotenv').config();
const axios = require('axios');
const twilio = require('twilio');
const memorySystem = require('./memory-system');

/**
 * Voice Calling System
 *
 * Uses ElevenLabs Conversational AI + Twilio for voice calls
 * Features:
 * - Bidirectional calling (you call it, it calls you)
 * - Uses your cloned voice
 * - Injects context (memory, recent messages, goals)
 * - Post-call transcript processing
 * - Stores call summary in memory
 */

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

class VoiceCallingSystem {
  constructor(bot) {
    this.bot = bot;
    this.userId = parseInt(process.env.TELEGRAM_USER_ID);
    this.activeCall = null;
  }

  /**
   * Create ElevenLabs Conversational AI Agent
   */
  async createConversationalAgent() {
    try {
      // Build context from memory
      const context = await this.buildCallContext();

      const response = await axios.post(
        'https://api.elevenlabs.io/v1/convai/agents',
        {
          name: 'Claude Always-On Assistant',
          conversation_config: {
            agent: {
              prompt: {
                prompt: `You are Claude, the user's personal AI assistant. You're speaking to them via phone call.

${context}

**Your Role:**
- Be helpful and concise
- Speak naturally (you're on a phone call)
- If they ask you to do something, confirm you'll handle it
- Keep responses brief (this is a phone call, not a chat)
- Use their name occasionally
- Be proactive but respectful

**Current Context:**
This call was initiated because: [will be set dynamically]

Respond naturally to what they say.`
              },
              first_message: "Hey! What's up?",
              language: "en"
            }
          },
          tts: {
            voice_id: process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM", // Default to Rachel voice if custom not set
            model_id: "eleven_turbo_v2",
            optimize_streaming_latency: 3
          },
          conversation_config_override: {
            tts: {
              voice_id: process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"
            }
          }
        },
        {
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('🎙️  Created conversational agent:', response.data.agent_id);
      return response.data.agent_id;

    } catch (error) {
      console.error('Error creating conversational agent:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Build context for call (memory, messages, goals)
   */
  async buildCallContext() {
    const [memories, goals, recentConversations] = await Promise.all([
      memorySystem.getRelevantMemories(this.userId, '', 5),
      memorySystem.getGoals(this.userId),
      memorySystem.getRecentConversations(this.userId, 10)
    ]);

    let context = '**What I know about the user:**\n';

    if (memories.length > 0) {
      context += '\nMemories:\n';
      memories.forEach(m => {
        context += `- ${m.content}\n`;
      });
    }

    if (goals.length > 0) {
      context += '\nActive Goals:\n';
      goals.forEach(g => {
        context += `- ${g.goal} (${g.progress})\n`;
      });
    }

    if (recentConversations.length > 0) {
      context += '\nRecent conversation (last 10 messages):\n';
      recentConversations.slice(-10).forEach(c => {
        context += `${c.role}: ${c.content.substring(0, 100)}...\n`;
      });
    }

    return context;
  }

  /**
   * Initiate outbound call (bot calls user)
   */
  async callUser(reason = 'Proactive check-in') {
    try {
      console.log(`📞 Initiating call to user...`);
      console.log(`   Reason: ${reason}`);

      // Create conversational agent
      const agentId = await this.createConversationalAgent();

      // Make call via Twilio
      const call = await twilioClient.calls.create({
        from: process.env.TWILIO_PHONE_CA, // Your Twilio number
        to: '+1234567890', // TODO: Add your actual phone number to .env
        url: `https://api.elevenlabs.io/v1/convai/agents/${agentId}/call`,
        method: 'POST',
        statusCallback: `http://your-server.com/call-status`, // TODO: Add webhook URL
        statusCallbackEvent: ['completed'],
        record: true
      });

      this.activeCall = {
        callSid: call.sid,
        agentId: agentId,
        reason: reason,
        startTime: new Date()
      };

      console.log(`✅ Call initiated: ${call.sid}`);

      // Notify via Telegram
      await this.bot.api.sendMessage(
        this.userId,
        `📞 Calling you now...\n\nReason: ${reason}`
      );

      return call;

    } catch (error) {
      console.error('Error initiating call:', error);
      throw error;
    }
  }

  /**
   * Handle incoming call (user calls bot)
   */
  async handleIncomingCall(callSid, from) {
    try {
      console.log(`📞 Incoming call from: ${from}`);

      // Verify caller ID (security)
      // TODO: Add your phone number to .env and verify
      // if (from !== process.env.USER_PHONE_NUMBER) {
      //   console.log('❌ Unauthorized caller');
      //   return;
      // }

      // Create conversational agent
      const agentId = await this.createConversationalAgent();

      this.activeCall = {
        callSid: callSid,
        agentId: agentId,
        reason: 'User initiated',
        startTime: new Date()
      };

      console.log(`✅ Connected to conversational agent: ${agentId}`);

      return agentId;

    } catch (error) {
      console.error('Error handling incoming call:', error);
      throw error;
    }
  }

  /**
   * Handle call completion
   */
  async handleCallComplete(callSid, transcript) {
    try {
      console.log(`✅ Call completed: ${callSid}`);

      if (!this.activeCall || this.activeCall.callSid !== callSid) {
        console.log('⚠️  No active call found');
        return;
      }

      const duration = Math.floor((new Date() - this.activeCall.startTime) / 1000);
      console.log(`   Duration: ${duration}s`);

      // Store call transcript in memory
      await memorySystem.storeConversation(
        this.userId,
        'system',
        `Phone call (${duration}s): ${transcript || 'No transcript available'}`,
        'phone'
      );

      // Analyze call and extract action items
      const analysis = await this.analyzeCallTranscript(transcript);

      // Send summary to Telegram
      let summary = `📞 *Call Summary*\n\n`;
      summary += `Duration: ${duration}s\n`;
      summary += `Reason: ${this.activeCall.reason}\n\n`;

      if (analysis.actionItems.length > 0) {
        summary += `*Action Items:*\n`;
        analysis.actionItems.forEach((item, i) => {
          summary += `${i + 1}. ${item}\n`;
        });
      }

      await this.bot.api.sendMessage(this.userId, summary, { parse_mode: 'Markdown' });

      // Clear active call
      this.activeCall = null;

    } catch (error) {
      console.error('Error handling call completion:', error);
    }
  }

  /**
   * Analyze call transcript and extract action items
   */
  async analyzeCallTranscript(transcript) {
    if (!transcript) {
      return { actionItems: [], summary: '' };
    }

    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Analyze this phone call transcript and extract:
1. Action items (things the user asked the AI to do)
2. Brief summary

Transcript:
${transcript}

Output format:
SUMMARY: [brief summary]
ACTION_ITEMS:
- [action 1]
- [action 2]
etc.

If no action items, output "ACTION_ITEMS: None"`
        }]
      });

      const analysis = response.content[0].text;
      const summaryMatch = analysis.match(/SUMMARY:\s*(.+)/);
      const actionItemsMatch = analysis.match(/ACTION_ITEMS:\s*([\s\S]+)/);

      const actionItems = [];
      if (actionItemsMatch && !actionItemsMatch[1].includes('None')) {
        const items = actionItemsMatch[1].split('\n').filter(line => line.trim().startsWith('-'));
        items.forEach(item => {
          actionItems.push(item.replace(/^-\s*/, '').trim());
        });
      }

      return {
        summary: summaryMatch ? summaryMatch[1].trim() : '',
        actionItems: actionItems
      };

    } catch (error) {
      console.error('Error analyzing transcript:', error);
      return { actionItems: [], summary: '' };
    }
  }

  /**
   * Test voice call (for development)
   */
  async testCall() {
    console.log('🧪 Testing voice call system...');

    try {
      await this.callUser('Test call');
      console.log('✅ Test call initiated');
    } catch (error) {
      console.error('❌ Test call failed:', error);
    }
  }
}

module.exports = VoiceCallingSystem;
