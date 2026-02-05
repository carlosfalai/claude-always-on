require('dotenv').config();
const twilio = require('twilio');
const axios = require('axios');

/**
 * Make a Super Bowl food planning call in SPANISH
 */

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function makeSuperbowlCall() {
  const userPhone = process.env.USER_PHONE_NUMBER;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  console.log('📞 Creating Super Bowl call agent (SPANISH)...');

  try {
    // Create ElevenLabs agent for Super Bowl planning
    const agentResponse = await axios.post(
      'https://api.elevenlabs.io/v1/convai/conversation',
      {
        agent_config: {
          conversation_config: {
            agent: {
              prompt: {
                prompt: `Eres un asistente IA amable que ayuda a planificar comida para el Super Bowl este fin de semana.

TU OBJETIVO: Preguntarle a la persona qué quiere comer para el Super Bowl.

ESTILO:
- Habla en español
- Tono casual y amigable
- Sé breve (estás en una llamada telefónica)
- Haz preguntas simples sobre sus preferencias

INFORMACIÓN DEL CONTEXTO:
- Es para el Super Bowl este fin de semana
- Quieres saber qué tipo de comida prefiere
- Opciones comunes: pizza, alitas, tacos, hamburguesas, snacks, etc.

Empieza saludando y preguntando sobre sus planes de comida para el Super Bowl.`
              },
              first_message: "¡Hola! Te llamo para saber qué quieres comer para el Super Bowl este fin de semana. ¿Tienes alguna idea?",
              language: "es"
            }
          },
          tts: {
            voice_id: voiceId,
            model_id: "eleven_turbo_v2_5",
            optimize_streaming_latency: 3
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

    const conversationId = agentResponse.data.conversation_id;
    console.log(`✅ Agent created: ${conversationId}`);

    console.log('📞 Calling user now...');

    // Make the call
    const call = await twilioClient.calls.create({
      from: process.env.TWILIO_PHONE_CA,
      to: userPhone,
      twiml: `<Response>
        <Connect>
          <Stream url="wss://api.elevenlabs.io/v1/convai/conversation?conversation_id=${conversationId}" />
        </Connect>
      </Response>`
    });

    console.log(`✅ Call initiated: ${call.sid}`);
    console.log('📱 Phone ringing! Answer to discuss Super Bowl food plans!');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

makeSuperbowlCall();
