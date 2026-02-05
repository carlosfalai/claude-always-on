require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(process.env.SUPABASE_URL, serviceRoleKey);

async function setupTables() {
  console.log('🔧 Creating Supabase tables...');

  // Create tables by inserting dummy data (will trigger table creation)
  // This is a workaround since Supabase REST API doesn't support DDL directly

  try {
    // Test if tables already exist
    const { data: existing, error: testError } = await supabase
      .from('conversations')
      .select('id')
      .limit(1);

    if (!testError) {
      console.log('✅ Tables already exist!');
      return;
    }

    console.log('❌ Tables don\'t exist. Please run this SQL in Supabase Dashboard:');
    console.log('');
    console.log('https://supabase.com/dashboard/project/gbxksgxezbljwlnlpkpz/sql/new');
    console.log('');
    console.log('Copy and paste the contents of setup-supabase.sql');
    console.log('');
    console.log('Once done, restart the bot with: npm run start:bot');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

setupTables();
