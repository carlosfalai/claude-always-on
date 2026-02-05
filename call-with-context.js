require('dotenv').config();
const fetch = require('node-fetch');
const gmailMonitor = require('./gmail-monitor');

/**
 * Make call with full Gmail context
 */

async function makeCallWithContext(initialMessage = 'I have some updates for you.') {
  console.log('📧 Fetching email context...');

  // Get all email context
  const allEmails = [];

  // Check both inboxes
  const carlosEmails = await gmailMonitor.checkNewEmails({
    user: process.env.CARLOS_EMAIL,
    password: (process.env.CARLOS_EMAIL_APP_PASSWORD || '').replace(/ /g, ''),
    host: 'imap.gmail.com',
    port: 993,
    tls: true
  });

  const infoEmails = await gmailMonitor.checkNewEmails({
    user: process.env.INFO_EMAIL,
    password: (process.env.INFO_EMAIL_APP_PASSWORD || '').replace(/ /g, ''),
    host: 'imap.gmail.com',
    port: 993,
    tls: true
  });

  allEmails.push(...carlosEmails.map(e => ({ ...e, account: 'Carlos' })));
  allEmails.push(...infoEmails.map(e => ({ ...e, account: 'Info' })));

  const urgentEmails = allEmails.filter(e => e.isUrgent);
  const recentEmails = allEmails.slice(0, 10);

  console.log(`   Found ${allEmails.length} total emails`);
  console.log(`   ${urgentEmails.length} urgent emails`);

  // Build context
  const emailContext = `
URGENT EMAILS (${urgentEmails.length}):
${urgentEmails.length > 0 ? urgentEmails.map(e => `- [${e.account}] From: ${e.from}, Subject: "${e.subject}"`).join('\n') : 'None'}

RECENT EMAILS (${recentEmails.length}):
${recentEmails.map(e => `- [${e.account}] From: ${e.from}, Subject: "${e.subject}"`).join('\n')}
`;

  console.log('\n📞 Making call with email context...');

  const response = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      agent_id: 'agent_5201kgqb02jbf2w99y6xzhga3rmz',
      agent_phone_number_id: 'phnum_4401kgqb1zgzfbj921brbgr4cxdk',
      to_number: process.env.USER_PHONE_NUMBER,
      conversation_initiation_client_data: {
        conversation_config_override: {
          agent: {
            first_message: `Hello Carlos! ${initialMessage}`,
            prompt: {
              prompt: `You are Carlos' personal AI assistant with access to his email inboxes.

EMAIL CONTEXT:
${emailContext}

During this call:
- If Carlos asks "what emails do I have" or "any urgent emails", tell him about them
- Reference specific emails by sender and subject when relevant
- You can see emails from both his Carlos and Info inboxes
- Keep responses SHORT (1-2 sentences)
- Wait for his reply after each response
- Be conversational and natural
- DO NOT end call unless he says goodbye

Start the conversation naturally. You just told him: "${initialMessage}"`
            }
          }
        }
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Call failed: ${error}`);
  }

  const result = await response.json();
  console.log('\n✅ Call initiated!');
  console.log(`   Conversation ID: ${result.conversation_id}`);
  console.log(`   Call SID: ${result.callSid}`);
  console.log('\n🎤 Your phone should ring now!');
  console.log('💡 Try asking: "What emails do I have?" or "Any urgent emails?"');
}

// Get message from command line or use default
const message = process.argv[2] || 'I have some updates for you about your emails.';
makeCallWithContext(message).catch(console.error);
