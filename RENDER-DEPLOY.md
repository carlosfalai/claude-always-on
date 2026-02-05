# Deploy to Render

## Step 1: Create GitHub Repo (2 minutes)

```bash
cd "C:\Users\Carlos Faviel Font\claude-always-on"

# Initialize git if not already
git init

# Add files
git add .
git commit -m "Initial commit - Claude Always-On webhook server"

# Create repo on GitHub and push
# Go to: https://github.com/new
# Name: claude-always-on
# Push code:
git remote add origin https://github.com/YOUR_USERNAME/claude-always-on.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Render (3 minutes)

1. Go to: https://dashboard.render.com/
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account
4. Select the `claude-always-on` repository
5. Configure:
   - **Name:** `claude-always-on-webhooks`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node webhook-server.js`
   - **Instance Type:** Free

## Step 3: Add Environment Variables

In Render dashboard, add these environment variables (copy from your local `.env` file):

```
ANTHROPIC_API_KEY=<your_key>
TELEGRAM_BOT_TOKEN=<your_token>
TELEGRAM_USER_ID=<your_id>
USER_PHONE_NUMBER=<your_phone>
TWILIO_ACCOUNT_SID=<your_sid>
TWILIO_AUTH_TOKEN=<your_token>
TWILIO_PHONE_US=<your_us_number>
TWILIO_PHONE_CA=<your_ca_number>
ELEVENLABS_API_KEY=<your_key>
ELEVENLABS_VOICE_ID=<your_voice_id>
SUPABASE_URL=<your_url>
SUPABASE_ANON_KEY=<your_key>
NODE_ENV=production
WEBHOOK_PORT=10000
```

## Step 4: Get Your Webhook URL

After deployment, you'll get a URL like:
```
https://claude-always-on-webhooks.onrender.com
```

Copy this URL!

## Step 5: Configure Twilio

1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click your number: `+14508001447`
3. Set webhooks:
   - **Voice URL:** `https://your-render-url.onrender.com/voice/incoming`
   - **SMS URL:** `https://your-render-url.onrender.com/sms/incoming`
   - **Status Callback:** `https://your-render-url.onrender.com/voice/status`
4. Save

## Step 6: Test!

Call: **+1-450-800-1447**

You should get a full conversational AI experience!

---

## Troubleshooting

**"Application failed to respond"**
- Check Render logs
- Ensure all env vars are set
- Health check at: `https://your-url.onrender.com/health`

**"No audio on call"**
- Check ElevenLabs API key
- Verify voice ID is correct

---

## Cost

**Render Free Tier:**
- 750 hours/month free
- Spins down after 15 min of inactivity
- First request wakes it up (~30 sec)

**Upgrade to Paid ($7/mo):**
- Always on
- No spin down
- Faster
