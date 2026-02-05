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

// Serve static audio files
app.use('/public', express.static('public'));

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

  const twiml = new VoiceResponse();

  try {
    // Connect directly to ElevenLabs Conversational AI agent
    const connect = twiml.connect();

    // Use the ElevenLabs Stream noun to connect to the agent
    connect.stream({
      url: `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_5201kgqb02jbf2w99y6xzhga3rmz`,
      parameters: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      }
    });

    console.log(`✅ Call connected to ElevenLabs agent`);

  } catch (error) {
    console.error('Error handling call:', error);
    twiml.say('Sorry, I had an error. Please try again.');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * WEBHOOK: Proactive Check-in Voice Call
 * Called when the check-in system needs to call the user about something urgent
 */
app.post('/voice/checkin', async (req, res) => {
  const from = req.body.From;
  const callSid = req.body.CallSid;
  const reason = req.query.reason || 'important update';

  console.log(`📞 Check-in call from: ${from}`);
  console.log(`   Reason: ${reason}`);
  console.log(`   Call SID: ${callSid}`);

  const twiml = new VoiceResponse();

  try {
    // Get context
    const context = await buildCallContext();

    // Use Claude to generate opening message based on reason
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `You're calling the user about this urgent matter: "${reason}".

Generate a brief, natural opening message in English (2 sentences max) explaining why you're calling.

Context about user:
${context}

Be direct but friendly. This is an urgent proactive check-in.`
      }]
    });

    const openingMessage = response.content[0].text;

    // Start conversation with Gather
    const gather = twiml.gather({
      input: 'speech',
      action: '/voice/checkin-response',
      method: 'POST',
      timeout: 5,
      language: 'en-US',
      speechTimeout: 'auto'
    });

    gather.say({
      voice: 'Polly.Joanna',
      language: 'en-US'
    }, openingMessage);

    // If no input
    twiml.say({
      voice: 'Polly.Joanna',
      language: 'en-US'
    }, 'I didn\'t hear you. I\'ll send you a text instead. Talk soon!');

    console.log(`✅ Check-in call started`);

  } catch (error) {
    console.error('Error handling check-in call:', error);
    twiml.say('Sorry, I had an error. I\'ll send you a text message instead.');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * WEBHOOK: Check-in Voice Response Handler
 * Processes speech input during check-in calls
 */
app.post('/voice/checkin-response', async (req, res) => {
  const speechResult = req.body.SpeechResult;
  const callSid = req.body.CallSid;

  console.log(`🎤 User said (check-in): ${speechResult}`);

  const twiml = new VoiceResponse();

  try {
    // Get context
    const context = await buildCallContext();

    // Call Claude to generate response
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Context: You called the user about an urgent matter and they just responded.

User said: "${speechResult}"

${context ? `Information about the user:\n${context}` : ''}

Respond naturally in English (2-3 sentences max). Continue the conversation or wrap up if they've addressed the urgent matter.`
      }]
    });

    const aiResponse = response.content[0].text;

    // Store conversation
    await memorySystem.storeConversation(userId, 'user', speechResult, 'phone');
    await memorySystem.storeConversation(userId, 'assistant', aiResponse, 'phone');

    // Continue or end conversation
    const gather = twiml.gather({
      input: 'speech',
      action: '/voice/checkin-response',
      method: 'POST',
      timeout: 5,
      language: 'en-US',
      speechTimeout: 'auto'
    });

    gather.say({
      voice: 'Polly.Joanna',
      language: 'en-US'
    }, aiResponse);

    // If no more input
    twiml.say({
      voice: 'Polly.Joanna',
      language: 'en-US'
    }, 'Alright, talk to you later!');

    console.log(`💬 AI responded: ${aiResponse}`);

  } catch (error) {
    console.error('Error processing check-in speech:', error);
    twiml.say({
      voice: 'Polly.Joanna',
      language: 'en-US'
    }, 'Sorry, I had a problem. I\'ll send you a text!');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * WEBHOOK: Voice Response Handler
 * Processes speech input and continues conversation
 */
app.post('/voice/response', async (req, res) => {
  const speechResult = req.body.SpeechResult;
  const callSid = req.body.CallSid;

  console.log(`🎤 User said: ${speechResult}`);

  const twiml = new VoiceResponse();

  try {
    // Get context
    const context = await buildCallContext();

    // Call Claude to generate response
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Contexto: Estás hablando por teléfono sobre planes de comida para el Super Bowl.

Usuario dijo: "${speechResult}"

${context ? `Información sobre el usuario:\n${context}` : ''}

Responde en español de manera breve y natural (máximo 2 frases). Haz una pregunta de seguimiento o sugiere opciones. Si ya tienen una idea clara, confirma y pregunta si necesitan ayuda con algo más.`
      }]
    });

    const aiResponse = response.content[0].text;

    // Store conversation
    await memorySystem.storeConversation(userId, 'user', speechResult, 'phone');
    await memorySystem.storeConversation(userId, 'assistant', aiResponse, 'phone');

    // Continue conversation
    const gather = twiml.gather({
      input: 'speech',
      action: '/voice/response',
      method: 'POST',
      timeout: 5,
      language: 'es-ES',
      speechTimeout: 'auto'
    });

    const responseUrl = await generateElevenLabsAudio(aiResponse, 'es');
    if (responseUrl) {
      gather.play(responseUrl);
    } else {
      gather.say({
        voice: 'Polly.Mia',
        language: 'es-ES'
      }, aiResponse);
    }

    // If no more input
    const finalUrl = await generateElevenLabsAudio('¡Perfecto! Disfruta el Super Bowl. ¡Hasta luego!', 'es');
    if (finalUrl) {
      twiml.play(finalUrl);
    } else {
      twiml.say({
        voice: 'Polly.Mia',
        language: 'es-ES'
      }, '¡Perfecto! Disfruta el Super Bowl. ¡Hasta luego!');
    }

    console.log(`💬 AI responded: ${aiResponse}`);

  } catch (error) {
    console.error('Error processing speech:', error);
    twiml.say({
      voice: 'Polly.Mia',
      language: 'es-ES'
    }, 'Lo siento, tuve un problema. ¡Hasta luego!');
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
 * Generate audio with ElevenLabs TTS
 */
async function generateElevenLabsAudio(text, language = 'es') {
  try {
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      console.error('ElevenLabs API error:', response.status);
      return null;
    }

    // Get audio data
    const audioBuffer = await response.arrayBuffer();
    const fs = require('fs');
    const path = require('path');

    // Save to temporary public directory
    const filename = `voice_${Date.now()}.mp3`;
    const filepath = path.join(__dirname, 'public', filename);

    // Create public directory if it doesn't exist
    const publicDir = path.join(__dirname, 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(filepath, Buffer.from(audioBuffer));

    // Return public URL
    const baseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/public/${filename}`;

  } catch (error) {
    console.error('Error generating ElevenLabs audio:', error);
    return null;
  }
}

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
            prompt: `Eres un asistente IA amable que ayuda a planificar comida para el Super Bowl este fin de semana.

${context}

TU OBJETIVO: Preguntarle a la persona qué quiere comer para el Super Bowl.

ESTILO:
- Habla en español (castellano neutro)
- Tono casual y amigable
- Sé breve (estás en una llamada telefónica)
- Haz preguntas simples sobre sus preferencias
- No uses jerga médica ni términos complicados

INFORMACIÓN:
- Es para el Super Bowl este fin de semana
- Quieres saber qué tipo de comida prefiere
- Opciones comunes: pizza, alitas, tacos, hamburguesas, snacks, etc.

Pregunta sobre sus planes de comida para el Super Bowl y ayúdale a decidir.`
          },
          first_message: "¡Hola! Te llamo para saber qué quieres comer para el Super Bowl este fin de semana. ¿Tienes alguna idea?",
          language: "es"
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
