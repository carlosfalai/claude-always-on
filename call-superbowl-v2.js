require('dotenv').config();
const twilio = require('twilio');

/**
 * Make Super Bowl call - simpler approach
 * Will connect through our webhook server
 */

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function makeCall() {
  console.log('📞 Making Super Bowl planning call...');
  console.log(`   To: ${process.env.USER_PHONE_NUMBER}`);
  console.log(`   From: ${process.env.TWILIO_PHONE_CA}`);

  try {
    const call = await twilioClient.calls.create({
      from: process.env.TWILIO_PHONE_CA,
      to: process.env.USER_PHONE_NUMBER,
      url: 'https://claude-always-on-webhooks.onrender.com/voice/incoming',
      method: 'POST',
      statusCallback: 'https://claude-always-on-webhooks.onrender.com/voice/status',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      timeout: 30
    });

    console.log(`✅ Call created: ${call.sid}`);
    console.log(`   Status: ${call.status}`);
    console.log('');
    console.log('📱 Your phone should be ringing!');
    console.log('🎤 The AI will ask about Super Bowl food in Spanish!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

makeCall();
