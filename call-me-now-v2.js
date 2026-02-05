require('dotenv').config();
const twilio = require('twilio');
const axios = require('axios');

/**
 * Make a FULL conversational AI call (v2 - fixed API)
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

  console.log('📞 Creating conversational AI call...');
  console.log(`   To: ${userPhone}`);
  console.log(`   Voice: ${voiceId}`);

  try {
    // Use ElevenLabs signed URL for conversational AI
    const signedUrlResponse = await axios.post(
      'https://api.elevenlabs.io/v1/convai/conversation/get_signed_url',
      {},
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        params: {
          agent_id: voiceId // Use voice ID as agent
        }
      }
    );

    const signedUrl = signedUrlResponse.data.signed_url;
    console.log(`✅ Got signed URL`);

    console.log('📞 Calling your phone...');

    // Make the call with conversational AI
    const call = await twilioClient.calls.create({
      from: process.env.TWILIO_PHONE_CA,
      to: userPhone,
      twiml: `<Response>
        <Say voice="Polly.Matthew">Connecting you to A I assistant. Please wait.</Say>
        <Connect>
          <Stream url="${signedUrl}" />
        </Connect>
      </Response>`
    });

    console.log(`✅ Call created: ${call.sid}`);
    console.log('');
    console.log('📱 Your phone is ringing!');
    console.log('🎤 Answer and start talking!');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);

    // Try simpler approach - just use TTS
    console.log('');
    console.log('⚠️  Falling back to simple TTS...');

    try {
      const fallbackCall = await twilioClient.calls.create({
        from: process.env.TWILIO_PHONE_CA,
        to: userPhone,
        twiml: `<Response>
          <Gather input="speech" action="http://example.com/process" method="POST" timeout="30">
            <Say voice="Polly.Matthew">
              Hey! This is your A I assistant.
              This is a test of the conversational system.
              Try saying something, and I'll respond.
              What would you like to talk about?
            </Say>
          </Gather>
        </Response>`
      });

      console.log(`✅ Fallback call created: ${fallbackCall.sid}`);
      console.log('📱 Answer to hear the AI!');

    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError.message);
      process.exit(1);
    }
  }
}

makeConversationalCall();
