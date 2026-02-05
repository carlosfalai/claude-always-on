require('dotenv').config();
const twilio = require('twilio');

/**
 * Configure Twilio number to accept incoming calls and connect to ElevenLabs agent
 */

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const WEBHOOK_URL = process.env.WEBHOOK_BASE_URL || 'https://claude-always-on-webhooks.onrender.com';
const PHONE_NUMBERS = [
  process.env.TWILIO_PHONE_US, // +18506168099
  process.env.TWILIO_PHONE_CA  // +14508001447
];

async function setupIncomingCalls() {
  console.log('🔧 Configuring Twilio numbers for incoming calls...\n');

  for (const phoneNumber of PHONE_NUMBERS) {
    if (!phoneNumber) continue;

    console.log(`📞 Setting up: ${phoneNumber}`);

    try {
      // Find the phone number resource
      const numbers = await client.incomingPhoneNumbers.list({
        phoneNumber: phoneNumber
      });

      if (numbers.length === 0) {
        console.log(`   ❌ Number not found in account`);
        continue;
      }

      const number = numbers[0];

      // Update to handle incoming voice calls
      await client.incomingPhoneNumbers(number.sid)
        .update({
          voiceUrl: `${WEBHOOK_URL}/voice/incoming`,
          voiceMethod: 'POST',
          statusCallback: `${WEBHOOK_URL}/voice/status`,
          statusCallbackMethod: 'POST'
        });

      console.log(`   ✅ Configured!`);
      console.log(`   📞 You can now call: ${phoneNumber}`);
      console.log(`   🔗 Webhook: ${WEBHOOK_URL}/voice/incoming\n`);

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}\n`);
    }
  }

  console.log('\n✅ Setup complete!');
  console.log('\n📱 To call your AI agent:');
  console.log(`   Dial: ${PHONE_NUMBERS[0] || PHONE_NUMBERS[1]}`);
  console.log(`   Your AI will answer with your cloned voice!`);
}

setupIncomingCalls().catch(console.error);
