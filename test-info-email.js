require('dotenv').config();
const Imap = require('node-imap');

const config = {
  user: 'info@centremedicalfont.ca',
  password: process.env.INFO_EMAIL_APP_PASSWORD.replace(/ /g, ''),
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
  connTimeout: 20000,
  authTimeout: 20000,
  debug: console.log // Enable debug logging
};

console.log('🔍 Testing info@centremedicalfont.ca connection...\n');
console.log('User:', config.user);
console.log('Password length:', config.password.length);
console.log('Host:', config.host);
console.log('\n---\n');

const imap = new Imap(config);

imap.once('ready', () => {
  console.log('✅ SUCCESS! IMAP connection established!');
  imap.end();
});

imap.once('error', (err) => {
  console.error('❌ ERROR:', err.message);
  console.error('Error code:', err.code);
  console.error('Full error:', err);
});

imap.once('end', () => {
  console.log('\n🔌 Connection closed');
});

imap.connect();
