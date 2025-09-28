const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://cqaxhavuuzwxhjdlhcpo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxYXhoYXZ1dXp3eGhqZGxoY3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjcyMzQ3NDksImV4cCI6MjA0MjgxMDc0OX0.XiVhqV0PnJ0R0cg0p1mJLnTMQ0W8KnGiH7PWBYvQyng'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testLiveActivity() {
  try {
    console.log('Testing get_live_activity_feed function...')
    const { data, error } = await supabase.rpc('get_live_activity_feed', { p_limit: 15 })

    if (error) {
      console.error('Error:', error)
    } else {
      console.log('Result:', JSON.stringify(data, null, 2))
      console.log('Number of items:', data ? data.length : 0)
    }
  } catch (err) {
    console.error('Caught error:', err)
  }
}

testLiveActivity()