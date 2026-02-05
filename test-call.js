require('dotenv').config();
const twilio = require('twilio');

/**
 * Quick Test: Make a call to your phone
 *
 * This is a simple test to verify Twilio works.
 * The call will just say a message and hang up.
 */

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function testCall() {
  const userPhone = process.env.USER_PHONE_NUMBER;

  if (!userPhone) {
    console.error('❌ USER_PHONE_NUMBER not set in .env');
    process.exit(1);
  }

  console.log(`📞 Making test call to: ${userPhone}`);
  console.log(`   From: ${process.env.TWILIO_PHONE_CA}`);

  try {
    const call = await twilioClient.calls.create({
      from: process.env.TWILIO_PHONE_CA,
      to: userPhone,
      twiml: `<Response>
        <Say voice="Polly.Matthew">
          Hey! This is your A I assistant.
          This is a test call to make sure everything works.
          If you can hear this, it's working!
          Talk to you soon.
        </Say>
      </Response>`
    });

    console.log(`✅ Call created!`);
    console.log(`   Call SID: ${call.sid}`);
    console.log(`   Status: ${call.status}`);
    console.log('');
    console.log('📱 Your phone should be ringing now!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testCall();
