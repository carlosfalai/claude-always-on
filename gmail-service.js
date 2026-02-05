require('dotenv').config();
const { google } = require('googleapis');

/**
 * Gmail Service
 * Monitors Gmail for important emails
 */

class GmailService {
  constructor() {
    this.oauth2Client = null;
    this.gmail = null;
  }

  /**
   * Initialize Gmail API with OAuth2
   */
  async initialize() {
    // Check if we have Gmail credentials
    if (!process.env.GOOGLE_GMAIL_SPRUCE_CLIENT_ID || !process.env.GOOGLE_GMAIL_SPRUCE_SECRET) {
      console.log('⚠️  Gmail credentials not found in .env');
      return false;
    }

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_GMAIL_SPRUCE_CLIENT_ID,
      process.env.GOOGLE_GMAIL_SPRUCE_SECRET,
      'http://localhost:3000/oauth/gmail/callback'
    );

    // TODO: Implement OAuth flow to get refresh token
    // For now, this is a placeholder
    console.log('📧 Gmail service initialized (OAuth setup needed)');
    return false;
  }

  /**
   * Get recent emails (last 7 days)
   */
  async getRecentEmails(maxResults = 50) {
    if (!this.gmail) {
      return [];
    }

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const query = `after:${Math.floor(sevenDaysAgo.getTime() / 1000)}`;

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxResults
      });

      const messages = response.data.messages || [];

      // Get full message details
      const emails = [];
      for (const message of messages.slice(0, 20)) { // Limit to 20 most recent
        const detail = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date']
        });

        const headers = detail.data.payload.headers;
        const from = headers.find(h => h.name === 'From')?.value;
        const subject = headers.find(h => h.name === 'Subject')?.value;
        const date = headers.find(h => h.name === 'Date')?.value;

        emails.push({
          id: message.id,
          from,
          subject,
          date,
          snippet: detail.data.snippet
        });
      }

      return emails;
    } catch (error) {
      console.error('Error fetching emails:', error.message);
      return [];
    }
  }

  /**
   * Get important/urgent emails
   */
  async getUrgentEmails() {
    const emails = await this.getRecentEmails();

    // Filter for urgent/important keywords
    const urgentKeywords = [
      'urgent', 'asap', 'immediately', 'important', 'deadline',
      'action required', 'time sensitive', 'emergency', 'critical'
    ];

    return emails.filter(email => {
      const text = `${email.subject} ${email.snippet}`.toLowerCase();
      return urgentKeywords.some(keyword => text.includes(keyword));
    });
  }

  /**
   * Summarize recent email activity
   */
  async getSummary() {
    const emails = await this.getRecentEmails(20);

    if (emails.length === 0) {
      return 'No Gmail access configured.';
    }

    const urgent = await this.getUrgentEmails();
    const unread = emails; // TODO: Filter for unread only

    return `📧 Gmail (last 7 days):
- ${emails.length} recent emails
- ${urgent.length} urgent/important
- ${unread.length} unread

Recent subjects:
${emails.slice(0, 5).map(e => `  • ${e.subject}`).join('\n')}`;
  }
}

module.exports = new GmailService();
