const { createClient } = require('@supabase/supabase-js');

const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdieGtzZ3hlemJsandsbmxwa3B6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODc1MTU4OSwiZXhwIjoyMDY0MzI3NTg5fQ.o9R4Z9_p3CEnOzcJ66_zn0Fg0vdauHoSt-cM3KiGXdo';
const supabase = createClient('https://gbxksgxezbljwlnlpkpz.supabase.co', serviceKey);

async function createTables() {
  console.log('Creating conversations table...');
  const { error: error1 } = await supabase.rpc('exec_sql', {
    query: `
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id BIGINT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        platform TEXT DEFAULT 'telegram',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, created_at DESC);
    `
  });

  if (error1) {
    console.log('Using alternative method...');
    // Tables might already exist or we need dashboard access
    console.log('\n⚠️  Unable to create tables via API');
    console.log('Please run setup-supabase.sql in Supabase Dashboard:');
    console.log('https://supabase.com/dashboard/project/gbxksgxezbljwlnlpkpz/sql/new');
  } else {
    console.log('✅ Tables created successfully');
  }
}

createTables();
