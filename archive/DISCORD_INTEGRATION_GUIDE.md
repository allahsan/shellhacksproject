# Discord Integration Setup Guide for ShellHack

## What I (Claude) CAN Do For You ✅

### 1. Code Implementation
- ✅ Create all API routes for Discord OAuth
- ✅ Update AuthModal component with Discord login button
- ✅ Create Discord callback handler
- ✅ Update database functions for Discord auth
- ✅ Add Discord fields to profile management
- ✅ Create password reset flow with Discord
- ✅ Style Discord buttons and UI

### 2. Database Updates
- ✅ Create SQL migrations for new Discord columns
- ✅ Write stored procedures for Discord login/signup
- ✅ Update existing auth functions to support Discord

### 3. Frontend Components
- ✅ Discord login/signup buttons
- ✅ Account linking interface
- ✅ Discord profile display
- ✅ Password reset via Discord flow

---

## What YOU Need to Do Manually ⚠️

### Step 1: Create Discord Application (5 minutes)

1. **Go to Discord Developer Portal**
   - Navigate to: https://discord.com/developers/applications
   - Log in with your Discord account

2. **Create New Application**
   - Click "New Application" button
   - Name it: "ShellHack 2024" (or your preference)
   - Accept Terms of Service
   - Click "Create"

3. **Save These Credentials** (CRITICAL!)
   ```
   APPLICATION ID: [1420861634754379886]
   PUBLIC KEY: [b995fc456e2c69ca9699230f6a89f53a95fda4d27538b88f8f3b723cd6cbfe68]
   ```

### Step 2: Configure OAuth2 (3 minutes)

1. **In Discord Developer Portal:**
   - Click on your app → "OAuth2" in left sidebar
   - Click "General" under OAuth2

2. **Add Redirect URIs:**
   Add these EXACT URLs:
   ```
   http://localhost:3003/api/auth/discord/callback
   http://localhost:3000/api/auth/discord/callback
   http://localhost:3001/api/auth/discord/callback
   http://localhost:3002/api/auth/discord/callback
   ```

   For production (if you deploy):
   ```
   https://your-domain.com/api/auth/discord/callback
   ```

3. **Copy Client Secret:**
   - Click "Reset Secret" button
   - Copy the secret immediately (shown only once!)
   ```
   CLIENT SECRET: [Copy this value - KEEP IT SAFE!]
   ```

### Step 3: Bot Configuration (SKIP - No Server Needed)

**Note:** Since you don't have a Discord server, we'll skip the bot setup. The bot is only needed for sending DMs for password reset. Users can still:
- ✅ Login with Discord OAuth (works without server!)
- ✅ Sign up with Discord
- ✅ Link their Discord account
- ❌ Reset password via Discord DM (requires bot in shared server)

**Your Bot Token (saved for future use):**
```
BOT TOKEN: MTQyMDg2MTYzNDc1NDM3OTg4Ng.GfK6MQ.giZWQ80n1JFnARkZLIA5mVJeOjFGxCq4x4pKg4
```

**Bot Invite Link (if you create a server later):**
```
https://discord.com/oauth2/authorize?client_id=1420861634754379886&permissions=343597402112&integration_type=0&scope=applications.commands+bot
```

### Step 4: Environment Variables Setup

1. **Create `.env.local` file in your project root:**
   ```bash
   # Discord OAuth
   NEXT_PUBLIC_DISCORD_CLIENT_ID=1420861634754379886
   DISCORD_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
   NEXT_PUBLIC_DISCORD_REDIRECT_URI=http://localhost:3003/api/auth/discord/callback

   # Discord Bot (saved for future use - not active without server)
   # DISCORD_BOT_TOKEN=MTQyMDg2MTYzNDc1NDM3OTg4Ng.GfK6MQ.giZWQ80n1JFnARkZLIA5mVJeOjFGxCq4x4pKg4

   # Existing Supabase (keep these)
   NEXT_PUBLIC_SUPABASE_URL=your-existing-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-existing-key
   ```

   **⚠️ IMPORTANT: You still need to get the CLIENT_SECRET from Discord Developer Portal!**

### Step 5: Add Bot to Discord Server (SKIP - No Server Required)

**This step is not needed since you don't have a Discord server. OAuth login will work perfectly without it!**

### Step 6: Database Migration

Run this SQL in your Supabase Dashboard:

```sql
-- Add Discord columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS discord_id VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS discord_avatar VARCHAR(255),
ADD COLUMN IF NOT EXISTS discord_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS discord_discriminator VARCHAR(10);

-- Create index for faster Discord lookups
CREATE INDEX IF NOT EXISTS idx_profiles_discord_id ON profiles(discord_id);

-- Update the constraint to allow Discord-only auth
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS email_or_phone,
ADD CONSTRAINT auth_requirement CHECK (
  (email IS NOT NULL) OR
  (phone IS NOT NULL) OR
  (discord_id IS NOT NULL)
);
```

---

## Quick Setup Checklist ✓

- [✅] Created Discord Application
- [✅] Copied Application ID: `1420861634754379886`
- [ ] **Copied Client Secret** ⚠️ STILL NEEDED!
- [ ] Added all redirect URIs
- [✅] Created Bot (have token saved)
- [N/A] Added bot to server (skip - no server)
- [ ] Created `.env.local` with Client Secret
- [ ] Ran database migration SQL
- [ ] Ready for code implementation!

---

## After You Complete Above Steps:

Tell me: "Discord app is ready with env variables set" and I will:

1. Install required packages:
   ```bash
   npm install discord-oauth2 discord.js
   ```

2. Create these files:
   - `/app/api/auth/discord/route.ts` - OAuth handler
   - `/app/api/auth/discord/callback/route.ts` - Callback handler
   - `/lib/discord.ts` - Discord utilities
   - `/components/DiscordButton.tsx` - Login button

3. Update:
   - `AuthModal.tsx` - Add Discord login option
   - `god-mode/page.tsx` - Show Discord info
   - Database functions for Discord auth

---

## Security Notes 🔐

**NEVER commit these to git:**
- Discord Client Secret
- Bot Token
- Any tokens in `.env.local`

**Add to `.gitignore`:**
```
.env.local
.env
```

---

## Testing Flow

1. **Test OAuth Login:**
   - Click "Login with Discord"
   - Authorize app
   - Check profile creation

2. **Test Account Linking:**
   - Login with email/password
   - Link Discord account
   - Verify connection

3. **Test Password Reset:**
   - Request reset via Discord
   - Receive DM (if bot configured)
   - Reset password successfully

---

## Troubleshooting

**"Invalid redirect URI"**
- Ensure redirect URI matches EXACTLY (including http/https and port)

**"Bot can't send DMs"**
- User must share a server with the bot
- User's DMs must be open

**"Discord ID already exists"**
- User already has account with that Discord
- Implement account merge flow

---

## Time Estimate

**Your Part:** 15-20 minutes
**My Part:** 30-45 minutes of coding

Total: **Under 1 hour for full Discord integration!**

---

Ready? Complete the manual steps above and let me know when you're done! 🚀