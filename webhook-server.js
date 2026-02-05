require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;
const MessagingResponse = twilio.twiml.MessagingResponse;
const memorySystem = require('./memory-system');
const Anthropic = require('@anthropic-ai/sdk');

/**
 * Webhook Server for Twilio
 *
 * Handles:
 * 1. Incoming phone calls → Connect to ElevenLabs conversational AI
 * 2. Incoming SMS → Process with Claude, reply via SMS
 * 3. Call status updates
 * 4. Voice recordings/transcripts
 */

const app = express();
const PORT = process.env.WEBHOOK_PORT || 3000;

// Parse URL-encoded bodies (Twilio sends data this way)
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const userId = parseInt(process.env.TELEGRAM_USER_ID);

// In-memory SMS conversation state
const smsConversations = new Map();

/**
 * WEBHOOK: Incoming Voice Call
 * Twilio calls this when someone dials your Twilio number
 */
app.post('/voice/incoming', async (req, res) => {
  const from = req.body.From;
  const callSid = req.body.CallSid;

  console.log(`📞 Incoming call from: ${from}`);
  console.log(`   Call SID: ${callSid}`);

  // TODO: Add caller ID verification for security
  // For now, accept all calls

  const twiml = new VoiceResponse();

  try {
    // Build context for the call
    const context = await buildCallContext();

    // Create ElevenLabs conversational AI agent
    const agentId = await createElevenLabsAgent(context);

    // Connect to ElevenLabs
    const connect = twiml.connect();
    connect.stream({
      url: `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`
    });

    console.log(`✅ Connected to ElevenLabs agent: ${agentId}`);

  } catch (error) {
    console.error('Error connecting to ElevenLabs:', error);
    twiml.say('Sorry, I encountered an error. Please try again later.');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * WEBHOOK: Call Status Updates
 * Twilio calls this when call status changes
 */
app.post('/voice/status', async (req, res) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  const callDuration = req.body.CallDuration;

  console.log(`📞 Call status update: ${callSid} → ${callStatus}`);

  if (callStatus === 'completed') {
    console.log(`   Duration: ${callDuration}s`);

    // TODO: Fetch call recording/transcript and process
    // Store in memory system
    // Send summary to Telegram
  }

  res.sendStatus(200);
});

/**
 * WEBHOOK: Incoming SMS
 * Twilio calls this when someone texts your Twilio number
 */
app.post('/sms/incoming', async (req, res) => {
  const from = req.body.From;
  const body = req.body.Body;
  const messageSid = req.body.MessageSid;

  console.log(`📱 SMS from ${from}: ${body}`);

  // TODO: Add phone number verification for security
  // For now, accept all messages

  try {
    // Get or create conversation history
    if (!smsConversations.has(from)) {
      smsConversations.set(from, []);
    }
    const history = smsConversations.get(from);

    // Add user message
    history.push({ role: 'user', content: body });

    // Keep last 20 messages
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

    // Get context from memory
    const memories = await memorySystem.getRelevantMemories(userId, body, 5);
    const goals = await memorySystem.getGoals(userId);

    let contextString = '';
    if (memories.length > 0) {
      contextString += 'Things I remember:\n';
      memories.forEach(m => contextString += `- ${m.content}\n`);
    }
    if (goals.length > 0) {
      contextString += '\nActive goals:\n';
      goals.forEach(g => contextString += `- ${g.goal}\n`);
    }

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 300,
      system: `You are Claude, accessible via SMS. Keep responses VERY SHORT (under 160 chars if possible). Be helpful but concise.

${contextString}

Remember: This is SMS, so be brief!`,
      messages: history,
    });

    const replyText = response.content[0].text;

    // Add assistant response to history
    history.push({ role: 'assistant', content: replyText });

    // Store in memory
    await memorySystem.storeConversation(userId, 'user', body, 'sms');
    await memorySystem.storeConversation(userId, 'assistant', replyText, 'sms');

    console.log(`📱 Replying: ${replyText.substring(0, 50)}...`);

    // Send TwiML response
    const twiml = new MessagingResponse();
    twiml.message(replyText);

    res.type('text/xml');
    res.send(twiml.toString());

  } catch (error) {
    console.error('Error processing SMS:', error);

    const twiml = new MessagingResponse();
    twiml.message('Sorry, I encountered an error. Please try again.');

    res.type('text/xml');
    res.send(twiml.toString());
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Build call context from memory
 */
async function buildCallContext() {
  const [memories, goals, recentConversations] = await Promise.all([
    memorySystem.getRelevantMemories(userId, '', 5),
    memorySystem.getGoals(userId),
    memorySystem.getRecentConversations(userId, 10)
  ]);

  let context = 'Context about the user:\n\n';

  if (memories.length > 0) {
    context += 'Things I remember:\n';
    memories.forEach(m => context += `- ${m.content}\n`);
    context += '\n';
  }

  if (goals.length > 0) {
    context += 'Active goals:\n';
    goals.forEach(g => context += `- ${g.goal} (${g.progress})\n`);
    context += '\n';
  }

  if (recentConversations.length > 0) {
    context += 'Recent conversation:\n';
    recentConversations.slice(-5).forEach(c => {
      context += `${c.role}: ${c.content.substring(0, 100)}...\n`;
    });
  }

  return context;
}

/**
 * Create ElevenLabs Conversational AI Agent
 */
async function createElevenLabsAgent(context) {
  const response = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Claude Always-On Assistant',
      conversation_config: {
        agent: {
          prompt: {
            prompt: `You are Claude, a helpful AI assistant speaking to the user via phone call.

${context}

Keep responses concise (this is a phone call). Be helpful and natural.`
          },
          first_message: "Hey! What's up?",
          language: "en"
        }
      },
      tts: {
        voice_id: process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
        model_id: "eleven_turbo_v2",
        optimize_streaming_latency: 3
      }
    })
  });

  const data = await response.json();
  return data.agent_id;
}

// Start server
app.listen(PORT, () => {
  console.log(`🌐 Webhook server running on port ${PORT}`);
  console.log(`   Voice webhook: http://localhost:${PORT}/voice/incoming`);
  console.log(`   SMS webhook: http://localhost:${PORT}/sms/incoming`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('📱 Ready to receive calls and SMS!');
  console.log('');
  console.log('⚠️  Remember to expose this with ngrok:');
  console.log('   npx ngrok http 3000');
});
