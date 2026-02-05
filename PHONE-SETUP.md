# 📞 Phone Calling & SMS Setup

This guide shows you how to enable phone calling and SMS with your bot.

---

## What You'll Get

- 📞 **Call the bot** - Dial your Twilio number, talk to AI with your voice
- 📱 **Text the bot** - Send SMS to your Twilio number, get AI replies
- 🎙️ **Voice AI** - Uses ElevenLabs conversational AI (with your cloned voice option)
- 🧠 **Memory** - Bot remembers who you are across calls/texts

---

## Setup Steps

### 1. Start Webhook Server (1 minute)

Open a **second terminal**:

```bash
cd "C:\Users\Carlos Faviel Font\claude-always-on"
node webhook-server.js
```

You should see:
```
🌐 Webhook server running on port 3000
   Voice webhook: http://localhost:3000/voice/incoming
   SMS webhook: http://localhost:3000/sms/incoming
📱 Ready to receive calls and SMS!
```

### 2. Expose with ngrok (2 minutes)

Open a **third terminal**:

```bash
npx ngrok http 3000
```

You'll get a URL like: `https://abc123.ngrok.io`

**Copy this URL!** You'll need it for Twilio.

### 3. Configure Twilio (3 minutes)

#### For Voice Calls:

1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click your **Canadian number**: `+14508001447`
3. Scroll to **Voice Configuration**
4. Under "A CALL COMES IN":
   - **Webhook URL:** `https://abc123.ngrok.io/voice/incoming` (your ngrok URL)
   - **HTTP Method:** POST
5. Under "CALL STATUS CHANGES":
   - **Webhook URL:** `https://abc123.ngrok.io/voice/status`
   - **HTTP Method:** POST
6. Click **Save**

#### For SMS:

1. Same page, scroll to **Messaging Configuration**
2. Under "A MESSAGE COMES IN":
   - **Webhook URL:** `https://abc123.ngrok.io/sms/incoming`
   - **HTTP Method:** POST
3. Click **Save**

---

## Test It!

### Test Phone Call:

1. Call: **+1-450-800-1447** (your Twilio Canadian number)
2. You should hear: "Hey! What's up?"
3. Start talking!
4. The AI will respond using ElevenLabs voice

### Test SMS:

1. Text to: **+1-450-800-1447**
2. Send: "Hello!"
3. You should get an AI reply within seconds

---

## How It Works

### Voice Calls:

```
You dial Twilio number
  ↓
Twilio → Your webhook (/voice/incoming)
  ↓
Webhook creates ElevenLabs agent (with context from memory)
  ↓
Twilio connects to ElevenLabs WebSocket
  ↓
You talk ←→ AI responds (using your cloned voice if configured)
  ↓
Call ends → Transcript stored in memory
```

### SMS:

```
You send SMS to Twilio number
  ↓
Twilio → Your webhook (/sms/incoming)
  ↓
Webhook gets context from memory
  ↓
Calls Claude API
  ↓
Claude responds (keeps it under 160 chars)
  ↓
SMS sent back to you
  ↓
Conversation stored in memory
```

---

## Important Notes

### Security (TODO):

Right now, ANYONE can call/text your number. You should add:

```javascript
// In webhook-server.js, add caller verification:
const AUTHORIZED_PHONE = process.env.USER_PHONE_NUMBER;

if (from !== AUTHORIZED_PHONE) {
  console.log('❌ Unauthorized caller');
  return res.sendStatus(403);
}
```

Add to `.env`:
```
USER_PHONE_NUMBER=+1234567890  # Your actual phone number
```

### Costs:

- **Incoming calls:** $0.0085/min
- **Incoming SMS:** $0.0075/message
- **Outgoing SMS:** $0.0075/message
- **ElevenLabs:** ~$0.10/min of conversation

Example: 10 calls × 5 min = $0.425
Very affordable for personal use!

### Using Your Cloned Voice:

In `.env`, uncomment your voice ID:
```bash
# Change from:
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Default AI voice

# To:
ELEVENLABS_VOICE_ID=8iTUHWF6x9Ury8ytOqQH  # Your cloned voice
```

Restart webhook server.

---

## Running Everything

You need **3 terminals**:

**Terminal 1 - Main Bot:**
```bash
node bot-v2.js
```

**Terminal 2 - Webhook Server:**
```bash
node webhook-server.js
```

**Terminal 3 - ngrok:**
```bash
npx ngrok http 3000
```

---

## Troubleshooting

### "Cannot connect to ElevenLabs"
- Check ELEVENLABS_API_KEY in `.env`
- Ensure you have credits in ElevenLabs account

### "Webhook not receiving calls/SMS"
- Check ngrok is running
- Verify Twilio webhooks point to correct ngrok URL
- Check webhook-server.js is running on port 3000

### "Call connects but no audio"
- ElevenLabs agent creation might have failed
- Check webhook-server.js logs for errors

---

## 🎉 You're Ready!

**Call:** +1-450-800-1447
**Text:** +1-450-800-1447

Your AI assistant is now accessible via phone! 📞
