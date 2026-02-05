require('dotenv').config();
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const memorySystem = require('./memory-system');

/**
 * Gmail Monitor - Checks inbox for urgent emails
 * Uses IMAP with app password (no OAuth needed)
 */

const GMAIL_ACCOUNTS = [
  {
    name: 'Carlos',
    user: process.env.CARLOS_EMAIL || 'cff@centremedicalfont.ca',
    password: (process.env.CARLOS_EMAIL_APP_PASSWORD || '').replace(/ /g, ''),
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  },
  {
    name: 'Info',
    user: process.env.INFO_EMAIL || 'info@centremedicalfont.ca',
    password: (process.env.INFO_EMAIL_APP_PASSWORD || '').replace(/ /g, ''),
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    connTimeout: 20000, // Increase timeout
    authTimeout: 20000
  }
];

class GmailMonitor {
  constructor() {
    this.lastChecked = new Date();
    this.urgentKeywords = [
      'urgent', 'importante', 'emergency', 'emergencia',
      'asap', 'deadline', 'overdue', 'payment due',
      'action required', 'acción requerida'
    ];
  }

  async checkNewEmails(config) {
    return new Promise((resolve, reject) => {
      const imap = new Imap(config);
      const emails = [];

      imap.once('ready', () => {
        console.log('📧 Connected to Gmail');

        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            reject(err);
            return;
          }

          // Search for unread emails since last check
          const searchCriteria = ['UNSEEN', ['SINCE', this.lastChecked]];

          imap.search(searchCriteria, (err, results) => {
            if (err) {
              reject(err);
              return;
            }

            if (results.length === 0) {
              console.log('   No new emails');
              imap.end();
              resolve([]);
              return;
            }

            console.log(`   Found ${results.length} new emails`);

            const fetch = imap.fetch(results, { bodies: '' });

            fetch.on('message', (msg) => {
              msg.on('body', (stream) => {
                simpleParser(stream, async (err, parsed) => {
                  if (err) return;

                  const email = {
                    from: parsed.from.text,
                    subject: parsed.subject,
                    date: parsed.date,
                    text: parsed.text?.substring(0, 500) || '', // First 500 chars
                    isUrgent: this.isUrgent(parsed)
                  };

                  emails.push(email);

                  // Store in memory if urgent
                  if (email.isUrgent) {
                    await memorySystem.addFact(
                      'urgent_email',
                      `From: ${email.from}\nSubject: ${email.subject}\nReceived: ${email.date}`,
                      'inbox'
                    );
                  }
                });
              });
            });

            fetch.once('end', () => {
              imap.end();
              this.lastChecked = new Date();
              resolve(emails);
            });

            fetch.once('error', reject);
          });
        });
      });

      imap.once('error', reject);
      imap.connect();
    });
  }

  isUrgent(email) {
    const subject = (email.subject || '').toLowerCase();
    const text = (email.text || '').toLowerCase();
    const combined = subject + ' ' + text;

    return this.urgentKeywords.some(keyword => combined.includes(keyword));
  }

  async getUrgentSummary() {
    try {
      const allUrgent = [];

      // Check all accounts
      for (const account of GMAIL_ACCOUNTS) {
        console.log(`\n📧 Checking ${account.name} (${account.user})...`);
        try {
          const emails = await this.checkNewEmails(account);
          const urgent = emails.filter(e => e.isUrgent);

          // Tag with account name
          urgent.forEach(e => e.account = account.name);
          allUrgent.push(...urgent);
        } catch (error) {
          console.error(`   Error checking ${account.name}:`, error.message);
        }
      }

      if (allUrgent.length === 0) {
        return null;
      }

      const summary = allUrgent
        .map(e => `• [${e.account}] ${e.from}: ${e.subject}`)
        .join('\n');

      return `📧 Tienes ${allUrgent.length} emails urgentes:\n${summary}`;

    } catch (error) {
      console.error('Error checking Gmail:', error.message);
      return null;
    }
  }
}

// Export singleton
const monitor = new GmailMonitor();
module.exports = monitor;

// Test if run directly
if (require.main === module) {
  (async () => {
    console.log('🔍 Testing Gmail monitor...\n');
    const summary = await monitor.getUrgentSummary();
    console.log('\n📊 Result:');
    console.log(summary || 'No urgent emails');
  })();
}
