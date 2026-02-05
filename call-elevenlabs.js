require('dotenv').config();
const fetch = require('node-fetch');

/**
 * Make outbound call using ElevenLabs Conversational AI
 * This uses your cloned voice and handles the full conversation
 */

const AGENT_ID = 'agent_5201kgqb02jbf2w99y6xzhga3rmz';
const PHONE_NUMBER_ID = 'phnum_4401kgqb1zgzfbj921brbgr4cxdk';
const TO_NUMBER = '+15142693231'; // Carlos' phone

async function makeCall(topic = '¡Hola! Te llamo para saber qué quieres comer para el Super Bowl este fin de semana.') {
  try {
    console.log('📞 Making call with ElevenLabs...');
    console.log(`   Topic: ${topic}`);

    const response = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        agent_phone_number_id: PHONE_NUMBER_ID,
        to_number: TO_NUMBER,
        conversation_initiation_client_data: {
          conversation_config_override: {
            agent: {
              first_message: topic,
              prompt: {
                prompt: `You are Carlos' personal AI assistant speaking in Spanish. You just said: "${topic}". Continue the conversation naturally. Listen to his response and engage in a friendly back-and-forth dialogue. Keep responses SHORT (1-2 sentences). Wait for his reply after each response. DO NOT end the call unless he says goodbye or indicates he's done.`
              }
            }
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ ElevenLabs API error:', response.status, errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Call initiated!');
    console.log('   Conversation ID:', result.conversation_id);
    console.log('   Twilio Call SID:', result.callSid);
    console.log('\n🎤 Your phone should ring now with YOUR VOICE speaking!');

  } catch (error) {
    console.error('❌ Error making call:', error);
  }
}

// Get topic from command line or use default
const topic = process.argv[2] || '¡Hola! Te llamo para saber qué quieres comer para el Super Bowl este fin de semana.';
makeCall(topic);
