// Add this to webhook-server.js after the /voice/incoming endpoint

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

    gather.say({
      voice: 'Polly.Mia',
      language: 'es-ES'
    }, aiResponse);

    // If no more input
    twiml.say({
      voice: 'Polly.Mia',
      language: 'es-ES'
    }, '¡Perfecto! Disfruta el Super Bowl. ¡Hasta luego!');

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
