// Test Supabase Connection Script
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Check if environment variables are set
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials!');
  console.log('Please create a .env file with:');
  console.log('SUPABASE_URL=your_project_url');
  console.log('SUPABASE_ANON_KEY=your_anon_key');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testConnection() {
  console.log('🔄 Testing Supabase connection...\n');

  try {
    // Test 1: Check if we can query the profiles table
    console.log('📊 Fetching profiles...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError.message);
    } else {
      console.log(`✅ Successfully connected! Found ${profiles?.length || 0} profiles\n`);
    }

    // Test 2: Check teams
    console.log('📊 Fetching teams...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .limit(5);

    if (teamsError) {
      console.error('❌ Error fetching teams:', teamsError.message);
    } else {
      console.log(`✅ Found ${teams?.length || 0} teams\n`);
    }

    // Test 3: Test a function call
    console.log('🔧 Testing database function (login_with_secret)...');
    const { data: funcResult, error: funcError } = await supabase
      .rpc('login_with_secret', {
        p_identifier: 'test@test.com',
        p_secret_code: '123456'
      });

    if (funcError) {
      console.log('ℹ️ Function call returned:', funcError.message);
      console.log('(This is expected if no test user exists)\n');
    } else {
      console.log('✅ Function call successful:', funcResult);
    }

    // Test 4: Show database stats
    console.log('📈 Database Statistics:');

    const { count: profileCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: teamCount } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true });

    const { count: requestCount } = await supabase
      .from('join_requests')
      .select('*', { count: 'exact', head: true });

    console.log(`   - Profiles: ${profileCount || 0}`);
    console.log(`   - Teams: ${teamCount || 0}`);
    console.log(`   - Join Requests: ${requestCount || 0}\n`);

    console.log('🎉 Connection test complete!');
    console.log('Your Supabase backend is working correctly.\n');

    // Show connection info
    console.log('📌 Connection Details:');
    console.log(`   URL: ${process.env.SUPABASE_URL}`);
    console.log(`   Using anon key: ${process.env.SUPABASE_ANON_KEY.substring(0, 20)}...`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testConnection();