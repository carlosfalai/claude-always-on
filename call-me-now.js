require('dotenv').config();
const twilio = require('twilio');
const axios = require('axios');

/**
 * Make a FULL conversational AI call
 * This connects to ElevenLabs so you can talk back and forth
 */

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function makeConversationalCall() {
  const userPhone = process.env.USER_PHONE_NUMBER;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!userPhone) {
    console.error('❌ USER_PHONE_NUMBER not set');
    process.exit(1);
  }

  console.log('📞 Creating ElevenLabs conversational agent...');

  try {
    // Create ElevenLabs conversational AI agent
    const agentResponse = await axios.post(
      'https://api.elevenlabs.io/v1/convai/conversation',
      {
        agent_id: null, // Will create a new agent
        agent_config: {
          agent: {
            prompt: {
              prompt: `You are Claude, a helpful AI assistant. You're speaking to the user via phone call. Keep responses concise (you're on a phone). Be friendly and natural. This is a test call to make sure the system works.`
            },
            first_message: "Hey! Can you hear me? This is your AI assistant. We're testing the conversational system. Try saying something!",
            language: "en"
          }
        },
        tts: {
          voice_id: voiceId,
          model_id: "eleven_turbo_v2",
          optimize_streaming_latency: 3
        }
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const conversationId = agentResponse.data.conversation_id;
    console.log(`✅ Agent created: ${conversationId}`);

    console.log('📞 Making call to your phone...');

    // Make the call and connect to ElevenLabs
    const call = await twilioClient.calls.create({
      from: process.env.TWILIO_PHONE_CA,
      to: userPhone,
      twiml: `<Response>
        <Connect>
          <Stream url="wss://api.elevenlabs.io/v1/convai/conversation/${conversationId}" />
        </Connect>
      </Response>`
    });

    console.log(`✅ Call created: ${call.sid}`);
    console.log('');
    console.log('📱 Your phone should be ringing!');
    console.log('🎤 When you answer, you can talk to the AI!');
    console.log('💬 Try saying: "Can you hear me?"');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

makeConversationalCall();
