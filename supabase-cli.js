#!/usr/bin/env node

// Supabase CLI Tool for TeamDock
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// Check credentials
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials!');
  console.log('\n1. Create a .env file in this directory');
  console.log('2. Add your Supabase credentials:');
  console.log('   SUPABASE_URL=your_project_url');
  console.log('   SUPABASE_ANON_KEY=your_anon_key\n');
  console.log('Get these from: https://app.supabase.com/project/YOUR_PROJECT/settings/api\n');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'teamdock> '
});

// Commands
const commands = {
  help: {
    description: 'Show available commands',
    usage: 'help',
    handler: async () => {
      console.log('\n📚 Available Commands:\n');
      Object.entries(commands).forEach(([cmd, info]) => {
        console.log(`  ${cmd.padEnd(15)} - ${info.description}`);
        console.log(`  ${''.padEnd(15)}   Usage: ${info.usage}\n`);
      });
    }
  },

  profiles: {
    description: 'List all profiles',
    usage: 'profiles',
    handler: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) {
        console.error('Error:', error.message);
      } else {
        console.log(`\n👥 Profiles (${data.length}):`);
        data.forEach(p => {
          console.log(`  - ${p.name} (${p.email || p.phone}) - ${p.profile_type} - ${p.user_status}`);
        });
        console.log();
      }
    }
  },

  teams: {
    description: 'List all teams',
    usage: 'teams',
    handler: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*');

      if (error) {
        console.error('Error:', error.message);
      } else {
        console.log(`\n🚀 Teams (${data.length}):`);
        data.forEach(t => {
          console.log(`  - ${t.name} - ${t.status} - Looking for: ${t.looking_for_roles.join(', ')}`);
        });
        console.log();
      }
    }
  },

  'create-profile': {
    description: 'Create a new profile',
    usage: 'create-profile <name> <email> <secret_code> <skills>',
    handler: async (args) => {
      if (args.length < 4) {
        console.log('Usage: create-profile "John Doe" john@email.com 123456 "frontend,backend"');
        return;
      }

      const [name, email, secret_code, skills] = args;
      const proficiencies = skills.split(',').map(s => s.trim());

      const { data, error } = await supabase.rpc('create_profile', {
        p_name: name,
        p_email: email,
        p_phone: null,
        p_secret_code: secret_code,
        p_proficiencies: proficiencies
      });

      if (error) {
        console.error('Error:', error.message);
      } else {
        console.log('✅ Profile created with ID:', data);
      }
    }
  },

  'create-team': {
    description: 'Create a new team',
    usage: 'create-team <leader_id> <name> <description> <roles>',
    handler: async (args) => {
      if (args.length < 4) {
        console.log('Usage: create-team <leader_id> "Team Name" "Description" "frontend,backend"');
        return;
      }

      const [leader_id, name, description, roles] = args;
      const looking_for = roles.split(',').map(r => r.trim());

      const { data, error } = await supabase.rpc('create_team', {
        p_leader_id: leader_id,
        p_name: name,
        p_description: description,
        p_looking_for_roles: looking_for,
        p_tech_stack: []
      });

      if (error) {
        console.error('Error:', error.message);
      } else {
        console.log('✅ Team created with ID:', data);
      }
    }
  },

  requests: {
    description: 'List join requests',
    usage: 'requests [team_id]',
    handler: async (args) => {
      let query = supabase.from('join_requests').select('*');

      if (args[0]) {
        query = query.eq('team_id', args[0]);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error:', error.message);
      } else {
        console.log(`\n📋 Join Requests (${data.length}):`);
        data.forEach(r => {
          console.log(`  - ${r.requested_role} - Status: ${r.status}`);
        });
        console.log();
      }
    }
  },

  stats: {
    description: 'Show database statistics',
    usage: 'stats',
    handler: async () => {
      const { count: profiles } = await supabase
        .from('profiles').select('*', { count: 'exact', head: true });

      const { count: teams } = await supabase
        .from('teams').select('*', { count: 'exact', head: true });

      const { count: members } = await supabase
        .from('team_members').select('*', { count: 'exact', head: true });

      const { count: requests } = await supabase
        .from('join_requests').select('*', { count: 'exact', head: true });

      console.log('\n📊 Database Statistics:');
      console.log(`  Profiles:      ${profiles || 0}`);
      console.log(`  Teams:         ${teams || 0}`);
      console.log(`  Team Members:  ${members || 0}`);
      console.log(`  Join Requests: ${requests || 0}\n`);
    }
  },

  'test-realtime': {
    description: 'Test realtime subscriptions',
    usage: 'test-realtime',
    handler: async () => {
      console.log('🔄 Listening for realtime updates (press Ctrl+C to stop)...\n');

      const channel = supabase
        .channel('db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'teams' },
          (payload) => {
            console.log('📡 Team change:', payload.eventType, payload.new?.name || payload.old?.name);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'join_requests' },
          (payload) => {
            console.log('📡 Join request change:', payload.eventType);
          }
        )
        .subscribe();

      console.log('Subscribed to teams and join_requests tables.');
      console.log('Make changes in another terminal or Supabase dashboard to see updates.\n');
    }
  },

  clear: {
    description: 'Clear the screen',
    usage: 'clear',
    handler: async () => {
      console.clear();
    }
  },

  exit: {
    description: 'Exit the CLI',
    usage: 'exit',
    handler: async () => {
      console.log('Goodbye! 👋');
      process.exit(0);
    }
  }
};

// Welcome message
console.log('\n🚢 TeamDock Supabase CLI');
console.log('Connected to:', process.env.SUPABASE_URL);
console.log('Type "help" for available commands\n');

// Command prompt
rl.prompt();

// Handle line input
rl.on('line', async (line) => {
  const [command, ...args] = line.trim().split(' ');

  if (commands[command]) {
    await commands[command].handler(args);
  } else if (command) {
    console.log(`Unknown command: ${command}. Type "help" for available commands.`);
  }

  rl.prompt();
}).on('close', () => {
  console.log('\nGoodbye! 👋');
  process.exit(0);
});