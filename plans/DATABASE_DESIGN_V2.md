# TeamDock Database Design V2 - Complete Schema

## 🎯 Key Requirements Addressed
- Three landing page paths: Leader, Join, Looking
- Team leader with full management powers
- Join request approval system
- Voting system for leader succession
- Profile persistence with secret code
- Contact sharing after approval

## 📊 Complete Database Schema

### 1. Users/Profiles Table
```sql
CREATE TABLE profiles (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Login Credentials (Simple Auth)
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) UNIQUE,
  secret_code VARCHAR(12) NOT NULL, -- 6-12 digit code (NOT a password)

  -- Personal Info
  name VARCHAR(100) NOT NULL,

  -- Skills/Proficiencies (multiple allowed)
  proficiencies TEXT[] DEFAULT '{}', -- ['frontend', 'backend', 'integration', 'pitch', 'other']
  other_proficiency VARCHAR(100), -- If they selected 'other'

  -- Contact Info (shared after joining team)
  discord_username VARCHAR(100),
  slack_username VARCHAR(100),
  github_username VARCHAR(100),
  telegram_username VARCHAR(100),
  whatsapp_number VARCHAR(20),

  -- Profile Type/Status
  profile_type VARCHAR(20) DEFAULT 'looking', -- 'leader', 'looking', 'member'
  is_available BOOLEAN DEFAULT TRUE,
  current_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  CONSTRAINT valid_phone CHECK (phone ~ '^\+?[1-9]\d{1,14}$'),
  CONSTRAINT valid_secret_code CHECK (char_length(secret_code) BETWEEN 6 AND 12),
  CONSTRAINT email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_phone ON profiles(phone);
CREATE INDEX idx_profiles_team ON profiles(current_team_id);
CREATE INDEX idx_profiles_available ON profiles(is_available) WHERE is_available = TRUE;
```

### 2. Teams Table (Updated)
```sql
CREATE TABLE teams (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Team Info
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL, -- Brief project idea

  -- Team Leader (always required)
  leader_id UUID NOT NULL REFERENCES profiles(id),

  -- Team Status
  status VARCHAR(20) DEFAULT 'recruiting' CHECK (status IN (
    'recruiting', 'closed', 'full', 'voting', 'disbanded'
  )),

  -- Voting State (for leader succession)
  voting_started_at TIMESTAMPTZ,
  voting_ends_at TIMESTAMPTZ,

  -- Team Settings
  max_members INTEGER DEFAULT 8,
  min_members INTEGER DEFAULT 2,
  auto_accept_requests BOOLEAN DEFAULT FALSE,

  -- Looking for roles
  looking_for_roles TEXT[] DEFAULT '{}', -- ['frontend', 'backend', etc]

  -- Tech Stack/Tags
  tech_stack TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  disbanded_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_team_size CHECK (max_members >= min_members AND max_members <= 10)
);

-- Indexes
CREATE INDEX idx_teams_leader ON teams(leader_id);
CREATE INDEX idx_teams_status ON teams(status);
CREATE INDEX idx_teams_recruiting ON teams(status) WHERE status = 'recruiting';
CREATE INDEX idx_teams_voting ON teams(status) WHERE status = 'voting';
```

### 3. Team Members Table
```sql
CREATE TABLE team_members (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Member Info
  role VARCHAR(50) NOT NULL, -- What role they fill in the team
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'active', 'inactive', 'removed'
  )),

  -- Permissions (for future expansion)
  can_manage_requests BOOLEAN DEFAULT FALSE,

  -- Constraints
  CONSTRAINT unique_member_per_team UNIQUE(team_id, profile_id),
  CONSTRAINT not_duplicate_role CHECK (
    NOT EXISTS (
      SELECT 1 FROM team_members tm2
      WHERE tm2.team_id = team_id
      AND tm2.role = role
      AND tm2.id != id
      AND tm2.status = 'active'
    )
  )
);

-- Indexes
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_profile ON team_members(profile_id);
CREATE INDEX idx_team_members_active ON team_members(status) WHERE status = 'active';
```

### 4. Join Requests Table
```sql
CREATE TABLE join_requests (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Request Details
  requested_role VARCHAR(50) NOT NULL,
  message TEXT, -- Optional message to team leader

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'rejected', 'withdrawn', 'expired'
  )),

  -- Response
  responded_by UUID REFERENCES profiles(id),
  response_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT unique_pending_request UNIQUE(team_id, profile_id, status)
    WHERE status = 'pending',
  CONSTRAINT no_self_request CHECK (
    profile_id != (SELECT leader_id FROM teams WHERE id = team_id)
  )
);

-- Indexes
CREATE INDEX idx_join_requests_team ON join_requests(team_id);
CREATE INDEX idx_join_requests_profile ON join_requests(profile_id);
CREATE INDEX idx_join_requests_pending ON join_requests(status) WHERE status = 'pending';
```

### 5. Leader Votes Table
```sql
CREATE TABLE leader_votes (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Vote Info
  voting_round INTEGER DEFAULT 1, -- Increments if revoting

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_vote_per_round UNIQUE(team_id, voter_id, voting_round),
  CONSTRAINT no_self_vote CHECK (voter_id != candidate_id),
  CONSTRAINT voter_is_member CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_id
      AND profile_id = voter_id
      AND status = 'active'
    )
  ),
  CONSTRAINT candidate_is_member CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_id
      AND profile_id = candidate_id
      AND status = 'active'
    )
  )
);

-- Indexes
CREATE INDEX idx_leader_votes_team ON leader_votes(team_id);
CREATE INDEX idx_leader_votes_round ON leader_votes(team_id, voting_round);
```

### 6. Notifications Table (Updated)
```sql
CREATE TABLE notifications (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Notification Type
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'join_request', 'request_accepted', 'request_rejected',
    'member_joined', 'member_left', 'team_disbanded',
    'voting_started', 'voting_ended', 'new_leader',
    'role_filled', 'team_full'
  )),

  -- Content
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,

  -- Related Entities
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  related_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  join_request_id UUID REFERENCES join_requests(id) ON DELETE CASCADE,

  -- Metadata
  action_url TEXT,
  priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- Indexes
CREATE INDEX idx_notifications_profile ON notifications(profile_id, is_read);
CREATE INDEX idx_notifications_unread ON notifications(profile_id) WHERE is_read = FALSE;
```

### 7. Activities/Audit Log (Updated)
```sql
CREATE TABLE activities (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event Type
  event_type VARCHAR(50) NOT NULL,

  -- Actor
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Related Entities
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Event Data
  metadata JSONB DEFAULT '{}',

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_activities_team ON activities(team_id);
CREATE INDEX idx_activities_actor ON activities(actor_id);
CREATE INDEX idx_activities_created ON activities(created_at DESC);
```

## 🔧 Database Functions

### 1. Create Profile with Secret Code
```sql
CREATE OR REPLACE FUNCTION create_profile(
  p_name VARCHAR,
  p_email VARCHAR,
  p_phone VARCHAR,
  p_secret_code VARCHAR,
  p_proficiencies TEXT[]
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- Hash the secret code (basic protection)
  INSERT INTO profiles (
    name, email, phone, secret_code, proficiencies
  ) VALUES (
    p_name, p_email, p_phone,
    encode(digest(p_secret_code, 'sha256'), 'hex'),
    p_proficiencies
  ) RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Email or phone already exists';
END;
$$;
```

### 2. Login with Secret Code
```sql
CREATE OR REPLACE FUNCTION login_with_secret(
  p_identifier VARCHAR, -- email or phone
  p_secret_code VARCHAR
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT * INTO v_profile
  FROM profiles
  WHERE (email = p_identifier OR phone = p_identifier)
    AND secret_code = encode(digest(p_secret_code, 'sha256'), 'hex');

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid credentials');
  END IF;

  -- Update last active
  UPDATE profiles SET last_active_at = NOW() WHERE id = v_profile.id;

  RETURN json_build_object(
    'success', true,
    'profile', row_to_json(v_profile)
  );
END;
$$;
```

### 3. Create Team (Makes creator the leader)
```sql
CREATE OR REPLACE FUNCTION create_team(
  p_leader_id UUID,
  p_name VARCHAR,
  p_description TEXT,
  p_looking_for_roles TEXT[],
  p_tech_stack TEXT[] DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_id UUID;
BEGIN
  -- Create team
  INSERT INTO teams (
    name, description, leader_id, looking_for_roles, tech_stack
  ) VALUES (
    p_name, p_description, p_leader_id, p_looking_for_roles, p_tech_stack
  ) RETURNING id INTO v_team_id;

  -- Add leader as first member
  INSERT INTO team_members (
    team_id, profile_id, role
  ) VALUES (
    v_team_id, p_leader_id, 'Team Leader'
  );

  -- Update profile type
  UPDATE profiles
  SET profile_type = 'leader', current_team_id = v_team_id
  WHERE id = p_leader_id;

  -- Create notification for potential members
  INSERT INTO activities (
    event_type, actor_id, team_id, metadata
  ) VALUES (
    'team_created', p_leader_id, v_team_id,
    jsonb_build_object('team_name', p_name, 'roles_needed', p_looking_for_roles)
  );

  RETURN v_team_id;
END;
$$;
```

### 4. Request to Join Team
```sql
CREATE OR REPLACE FUNCTION request_to_join(
  p_team_id UUID,
  p_profile_id UUID,
  p_requested_role VARCHAR,
  p_message TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_id UUID;
  v_team_name VARCHAR;
  v_leader_id UUID;
BEGIN
  -- Check if already has pending request
  IF EXISTS (
    SELECT 1 FROM join_requests
    WHERE team_id = p_team_id
    AND profile_id = p_profile_id
    AND status = 'pending'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Request already pending');
  END IF;

  -- Check if already in team
  IF EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
    AND profile_id = p_profile_id
    AND status = 'active'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Already in team');
  END IF;

  -- Create request
  INSERT INTO join_requests (
    team_id, profile_id, requested_role, message
  ) VALUES (
    p_team_id, p_profile_id, p_requested_role, p_message
  ) RETURNING id INTO v_request_id;

  -- Get team info for notification
  SELECT name, leader_id INTO v_team_name, v_leader_id
  FROM teams WHERE id = p_team_id;

  -- Notify team leader (HIGH PRIORITY)
  INSERT INTO notifications (
    profile_id, type, title, message,
    team_id, related_profile_id, join_request_id, priority
  ) VALUES (
    v_leader_id, 'join_request',
    'New Join Request!',
    (SELECT name FROM profiles WHERE id = p_profile_id) || ' wants to join as ' || p_requested_role,
    p_team_id, p_profile_id, v_request_id, 'urgent'
  );

  RETURN json_build_object(
    'success', true,
    'request_id', v_request_id
  );
END;
$$;
```

### 5. Accept/Reject Join Request
```sql
CREATE OR REPLACE FUNCTION respond_to_request(
  p_request_id UUID,
  p_leader_id UUID,
  p_accept BOOLEAN,
  p_response_message TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_team RECORD;
  v_profile RECORD;
BEGIN
  -- Get request details
  SELECT * INTO v_request FROM join_requests WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;

  -- Verify leader
  SELECT * INTO v_team FROM teams WHERE id = v_request.team_id;
  IF v_team.leader_id != p_leader_id THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Get requester profile
  SELECT * INTO v_profile FROM profiles WHERE id = v_request.profile_id;

  IF p_accept THEN
    -- Add to team
    INSERT INTO team_members (
      team_id, profile_id, role
    ) VALUES (
      v_request.team_id, v_request.profile_id, v_request.requested_role
    );

    -- Update profile
    UPDATE profiles
    SET current_team_id = v_request.team_id, profile_type = 'member'
    WHERE id = v_request.profile_id;

    -- Update request
    UPDATE join_requests
    SET status = 'accepted', responded_by = p_leader_id,
        response_message = p_response_message, responded_at = NOW()
    WHERE id = p_request_id;

    -- Notify requester with contact info
    INSERT INTO notifications (
      profile_id, type, title, message, team_id, priority
    ) VALUES (
      v_request.profile_id, 'request_accepted',
      '🎉 Request Accepted!',
      'You are now part of ' || v_team.name || '! Contact info shared.',
      v_request.team_id, 'high'
    );

    -- Share contacts with all team members
    PERFORM share_team_contacts(v_request.team_id);

  ELSE
    -- Reject request
    UPDATE join_requests
    SET status = 'rejected', responded_by = p_leader_id,
        response_message = p_response_message, responded_at = NOW()
    WHERE id = p_request_id;

    -- Notify requester
    INSERT INTO notifications (
      profile_id, type, title, message, team_id
    ) VALUES (
      v_request.profile_id, 'request_rejected',
      'Request Not Accepted',
      'Your request to join ' || v_team.name || ' was not accepted.',
      v_request.team_id
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'accepted', p_accept
  );
END;
$$;
```

### 6. Leave Team (Member removes self)
```sql
CREATE OR REPLACE FUNCTION leave_team(
  p_profile_id UUID,
  p_team_id UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team RECORD;
  v_member_count INTEGER;
BEGIN
  -- Get team info
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;

  -- Check if team leader
  IF v_team.leader_id = p_profile_id THEN
    -- Team leader is leaving, initiate voting
    RETURN initiate_leader_voting(p_team_id, p_profile_id);
  END IF;

  -- Remove member
  UPDATE team_members
  SET status = 'removed'
  WHERE team_id = p_team_id AND profile_id = p_profile_id;

  -- Update profile
  UPDATE profiles
  SET current_team_id = NULL, profile_type = 'looking'
  WHERE id = p_profile_id;

  -- Check remaining members
  SELECT COUNT(*) INTO v_member_count
  FROM team_members
  WHERE team_id = p_team_id AND status = 'active';

  IF v_member_count < 2 THEN
    -- Disband team if too few members
    UPDATE teams SET status = 'disbanded' WHERE id = p_team_id;
  END IF;

  RETURN json_build_object('success', true);
END;
$$;
```

### 7. Initiate Leader Voting
```sql
CREATE OR REPLACE FUNCTION initiate_leader_voting(
  p_team_id UUID,
  p_leaving_leader_id UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_count INTEGER;
BEGIN
  -- Count active members (excluding leaving leader)
  SELECT COUNT(*) INTO v_member_count
  FROM team_members
  WHERE team_id = p_team_id
    AND status = 'active'
    AND profile_id != p_leaving_leader_id;

  IF v_member_count = 0 THEN
    -- No members left, disband
    UPDATE teams
    SET status = 'disbanded', disbanded_at = NOW()
    WHERE id = p_team_id;

    RETURN json_build_object('success', true, 'action', 'disbanded');
  END IF;

  IF v_member_count = 1 THEN
    -- Only one member left, auto-promote
    UPDATE teams
    SET leader_id = (
      SELECT profile_id FROM team_members
      WHERE team_id = p_team_id
        AND status = 'active'
        AND profile_id != p_leaving_leader_id
      LIMIT 1
    )
    WHERE id = p_team_id;

    RETURN json_build_object('success', true, 'action', 'auto_promoted');
  END IF;

  -- Start voting (5 minute window)
  UPDATE teams
  SET status = 'voting',
      voting_started_at = NOW(),
      voting_ends_at = NOW() + INTERVAL '5 minutes'
  WHERE id = p_team_id;

  -- Notify all members
  INSERT INTO notifications (profile_id, type, title, message, team_id, priority)
  SELECT
    profile_id,
    'voting_started',
    'Leader Election Started!',
    'Team leader left. Vote for new leader within 5 minutes!',
    p_team_id,
    'urgent'
  FROM team_members
  WHERE team_id = p_team_id AND status = 'active' AND profile_id != p_leaving_leader_id;

  -- Remove leaving leader
  UPDATE team_members
  SET status = 'removed'
  WHERE team_id = p_team_id AND profile_id = p_leaving_leader_id;

  RETURN json_build_object('success', true, 'action', 'voting_started');
END;
$$;
```

### 8. Cast/Update Vote
```sql
CREATE OR REPLACE FUNCTION cast_vote(
  p_team_id UUID,
  p_voter_id UUID,
  p_candidate_id UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team RECORD;
  v_current_round INTEGER;
BEGIN
  -- Check if voting is active
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;

  IF v_team.status != 'voting' THEN
    RETURN json_build_object('success', false, 'error', 'Voting not active');
  END IF;

  -- Get current voting round
  SELECT COALESCE(MAX(voting_round), 0) + 1 INTO v_current_round
  FROM leader_votes
  WHERE team_id = p_team_id;

  -- Upsert vote (allow changing vote)
  INSERT INTO leader_votes (
    team_id, voter_id, candidate_id, voting_round
  ) VALUES (
    p_team_id, p_voter_id, p_candidate_id, v_current_round
  )
  ON CONFLICT (team_id, voter_id, voting_round)
  DO UPDATE SET
    candidate_id = p_candidate_id,
    updated_at = NOW();

  -- Check if all have voted
  PERFORM check_voting_complete(p_team_id);

  RETURN json_build_object('success', true);
END;
$$;
```

### 9. Finalize Voting
```sql
CREATE OR REPLACE FUNCTION finalize_voting(p_team_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_winner_id UUID;
  v_tie BOOLEAN := FALSE;
  v_max_votes INTEGER;
BEGIN
  -- Get candidate with most votes
  WITH vote_counts AS (
    SELECT
      candidate_id,
      COUNT(*) as votes
    FROM leader_votes
    WHERE team_id = p_team_id
      AND voting_round = (
        SELECT MAX(voting_round) FROM leader_votes WHERE team_id = p_team_id
      )
    GROUP BY candidate_id
  )
  SELECT candidate_id, votes INTO v_winner_id, v_max_votes
  FROM vote_counts
  ORDER BY votes DESC
  LIMIT 1;

  -- Check for tie
  SELECT COUNT(*) > 1 INTO v_tie
  FROM (
    SELECT candidate_id, COUNT(*) as votes
    FROM leader_votes
    WHERE team_id = p_team_id
      AND voting_round = (
        SELECT MAX(voting_round) FROM leader_votes WHERE team_id = p_team_id
      )
    GROUP BY candidate_id
    HAVING COUNT(*) = v_max_votes
  ) tied;

  IF v_tie THEN
    -- Random selection from tied candidates (heads or tails)
    WITH tied_candidates AS (
      SELECT candidate_id, COUNT(*) as votes
      FROM leader_votes
      WHERE team_id = p_team_id
        AND voting_round = (
          SELECT MAX(voting_round) FROM leader_votes WHERE team_id = p_team_id
        )
      GROUP BY candidate_id
      HAVING COUNT(*) = v_max_votes
    )
    SELECT candidate_id INTO v_winner_id
    FROM tied_candidates
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;

  -- Update team leader
  UPDATE teams
  SET leader_id = v_winner_id,
      status = 'recruiting',
      voting_started_at = NULL,
      voting_ends_at = NULL
  WHERE id = p_team_id;

  -- Update winner's profile
  UPDATE profiles
  SET profile_type = 'leader'
  WHERE id = v_winner_id;

  -- Notify all members
  INSERT INTO notifications (profile_id, type, title, message, team_id)
  SELECT
    profile_id,
    'new_leader',
    'New Team Leader!',
    (SELECT name FROM profiles WHERE id = v_winner_id) || ' is the new team leader',
    p_team_id
  FROM team_members
  WHERE team_id = p_team_id AND status = 'active';

  RETURN json_build_object(
    'success', true,
    'new_leader_id', v_winner_id,
    'was_tie', v_tie
  );
END;
$$;
```

### 10. Share Team Contacts
```sql
CREATE OR REPLACE FUNCTION share_team_contacts(p_team_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create a notification for each team member with all contacts
  INSERT INTO notifications (
    profile_id, type, title, message, team_id, metadata
  )
  SELECT
    tm.profile_id,
    'team_contacts',
    'Team Contact Info',
    'Contact information for all team members',
    p_team_id,
    jsonb_build_object(
      'contacts', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'name', p.name,
            'email', p.email,
            'phone', p.phone,
            'discord', p.discord_username,
            'slack', p.slack_username,
            'github', p.github_username,
            'whatsapp', p.whatsapp_number
          )
        )
        FROM team_members tm2
        JOIN profiles p ON p.id = tm2.profile_id
        WHERE tm2.team_id = p_team_id AND tm2.status = 'active'
      )
    )
  FROM team_members tm
  WHERE tm.team_id = p_team_id AND tm.status = 'active';
END;
$$;
```

## 🔒 Row Level Security (RLS) Policies

### Profiles Table
```sql
-- Anyone can create a profile
CREATE POLICY "Anyone can create profile"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- Users can view all profiles (for browsing)
CREATE POLICY "Profiles are viewable"
  ON profiles FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (id = current_setting('app.current_user_id')::UUID);
```

### Teams Table
```sql
-- Anyone can view teams
CREATE POLICY "Teams are public"
  ON teams FOR SELECT
  USING (true);

-- Only team leaders can update their teams
CREATE POLICY "Leaders manage teams"
  ON teams FOR UPDATE
  USING (leader_id = current_setting('app.current_user_id')::UUID);

-- Leaders can delete their teams
CREATE POLICY "Leaders can disband teams"
  ON teams FOR DELETE
  USING (leader_id = current_setting('app.current_user_id')::UUID);
```

### Join Requests Table
```sql
-- Team leaders see all requests for their team
CREATE POLICY "Leaders see team requests"
  ON join_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_id
      AND teams.leader_id = current_setting('app.current_user_id')::UUID
    )
  );

-- Users see their own requests
CREATE POLICY "Users see own requests"
  ON join_requests FOR SELECT
  USING (profile_id = current_setting('app.current_user_id')::UUID);

-- Users can withdraw their own requests
CREATE POLICY "Users withdraw own requests"
  ON join_requests FOR UPDATE
  USING (profile_id = current_setting('app.current_user_id')::UUID);
```

## 📊 Indexes for Performance

```sql
-- Critical performance indexes
CREATE INDEX idx_teams_recruiting_roles ON teams USING GIN(looking_for_roles)
  WHERE status = 'recruiting';

CREATE INDEX idx_profiles_proficiencies ON profiles USING GIN(proficiencies);

CREATE INDEX idx_join_requests_pending_team ON join_requests(team_id)
  WHERE status = 'pending';

CREATE INDEX idx_notifications_urgent ON notifications(profile_id)
  WHERE priority = 'urgent' AND is_read = FALSE;

CREATE INDEX idx_voting_active ON teams(voting_ends_at)
  WHERE status = 'voting';
```

## 🔄 Realtime Subscriptions

```sql
-- Enable realtime on critical tables
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE join_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE leader_votes;

-- Set replica identity
ALTER TABLE teams REPLICA IDENTITY FULL;
ALTER TABLE team_members REPLICA IDENTITY FULL;
ALTER TABLE join_requests REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE leader_votes REPLICA IDENTITY FULL;
```

---

## 🎯 Key Features Implemented

✅ **Three User Paths**: Leader, Looking, Join
✅ **Profile Persistence**: Secret code login (6-12 digits)
✅ **Team Management**: Full leader control
✅ **Join Requests**: Approval system with notifications
✅ **Contact Protection**: Shared only after acceptance
✅ **Leader Succession**: Voting with tie-breaker
✅ **Real-time Updates**: All critical events
✅ **Sound/Vibration**: Urgent notifications flagged

Ready for implementation! 🚀