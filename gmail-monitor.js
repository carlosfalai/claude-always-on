require('dotenv').config();
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const memorySystem = require('./memory-system');

/**
 * Gmail Monitor - Checks inbox for urgent emails
 * Uses IMAP with app password (no OAuth needed)
 */

const GMAIL_CONFIG = {
  user: 'instanthpi@gmail.com',
  password: process.env.INSTANTHPI_NOREPLY_APP_PASSWORD.replace(/ /g, ''), // Remove spaces
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
};

class GmailMonitor {
  constructor() {
    this.lastChecked = new Date();
    this.urgentKeywords = [
      'urgent', 'importante', 'emergency', 'emergencia',
      'asap', 'deadline', 'overdue', 'payment due',
      'action required', 'acción requerida'
    ];
  }

  async checkNewEmails() {
    return new Promise((resolve, reject) => {
      const imap = new Imap(GMAIL_CONFIG);
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
      const emails = await this.checkNewEmails();
      const urgent = emails.filter(e => e.isUrgent);

      if (urgent.length === 0) {
        return null;
      }

      const summary = urgent.map(e => `• ${e.from}: ${e.subject}`).join('\n');
      return `📧 Tienes ${urgent.length} emails urgentes:\n${summary}`;

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
