-- TeamDock Database Schema for Supabase
-- Version: 1.0.0
-- Description: Complete database schema for hackathon team formation platform

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABLE: profiles
-- Description: User profiles with secret code authentication
-- =====================================================
CREATE TABLE profiles (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Login Credentials (Simple Auth)
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) UNIQUE,
  secret_code VARCHAR(64) NOT NULL, -- Will store hashed code

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
  user_status VARCHAR(20) DEFAULT 'available' CHECK (user_status IN ('available', 'busy', 'break', 'offline')),
  current_team_id UUID, -- Will add FK after teams table

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$' OR email IS NULL),
  CONSTRAINT valid_phone CHECK (phone ~ '^\+?[1-9]\d{1,14}$' OR phone IS NULL),
  CONSTRAINT valid_secret_code CHECK (char_length(secret_code) >= 6),
  CONSTRAINT email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- =====================================================
-- TABLE: teams
-- Description: Teams with leader management
-- =====================================================
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

-- Add foreign key for current_team_id
ALTER TABLE profiles ADD CONSTRAINT fk_current_team
  FOREIGN KEY (current_team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- =====================================================
-- TABLE: team_members
-- Description: Team membership and roles
-- =====================================================
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
  CONSTRAINT unique_member_per_team UNIQUE(team_id, profile_id)
);

-- =====================================================
-- TABLE: join_requests
-- Description: Join request management system
-- =====================================================
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
  withdrawn_at TIMESTAMPTZ
);

-- Partial unique constraint for pending requests
CREATE UNIQUE INDEX unique_pending_request
  ON join_requests(team_id, profile_id)
  WHERE status = 'pending';

-- =====================================================
-- TABLE: leader_votes
-- Description: Voting system for leader succession
-- =====================================================
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
  CONSTRAINT no_self_vote CHECK (voter_id != candidate_id)
);

-- =====================================================
-- TABLE: notifications
-- Description: Notification system with priority
-- =====================================================
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
    'role_filled', 'team_full', 'team_contacts'
  )),

  -- Content
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,

  -- Related Entities
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  related_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  join_request_id UUID REFERENCES join_requests(id) ON DELETE CASCADE,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  action_url TEXT,
  priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- =====================================================
-- TABLE: activities
-- Description: Audit log for all system events
-- =====================================================
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

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Profiles indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_phone ON profiles(phone);
CREATE INDEX idx_profiles_team ON profiles(current_team_id);
CREATE INDEX idx_profiles_available ON profiles(is_available) WHERE is_available = TRUE;
CREATE INDEX idx_profiles_proficiencies ON profiles USING GIN(proficiencies);
CREATE INDEX idx_profiles_status ON profiles(user_status) WHERE user_status != 'offline';

-- Teams indexes
CREATE INDEX idx_teams_leader ON teams(leader_id);
CREATE INDEX idx_teams_status ON teams(status);
CREATE INDEX idx_teams_recruiting ON teams(status) WHERE status = 'recruiting';
CREATE INDEX idx_teams_voting ON teams(status) WHERE status = 'voting';
CREATE INDEX idx_teams_recruiting_roles ON teams USING GIN(looking_for_roles) WHERE status = 'recruiting';
CREATE INDEX idx_voting_active ON teams(voting_ends_at) WHERE status = 'voting';

-- Team members indexes
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_profile ON team_members(profile_id);
CREATE INDEX idx_team_members_active ON team_members(status) WHERE status = 'active';

-- Join requests indexes
CREATE INDEX idx_join_requests_team ON join_requests(team_id);
CREATE INDEX idx_join_requests_profile ON join_requests(profile_id);
CREATE INDEX idx_join_requests_pending ON join_requests(status) WHERE status = 'pending';
CREATE INDEX idx_join_requests_pending_team ON join_requests(team_id) WHERE status = 'pending';

-- Leader votes indexes
CREATE INDEX idx_leader_votes_team ON leader_votes(team_id);
CREATE INDEX idx_leader_votes_round ON leader_votes(team_id, voting_round);

-- Notifications indexes
CREATE INDEX idx_notifications_profile ON notifications(profile_id, is_read);
CREATE INDEX idx_notifications_unread ON notifications(profile_id) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_urgent ON notifications(profile_id) WHERE priority = 'urgent' AND is_read = FALSE;

-- Activities indexes
CREATE INDEX idx_activities_team ON activities(team_id);
CREATE INDEX idx_activities_actor ON activities(actor_id);
CREATE INDEX idx_activities_created ON activities(created_at DESC);

-- =====================================================
-- DATABASE FUNCTIONS
-- =====================================================

-- Helper function to check if voting is complete
CREATE OR REPLACE FUNCTION check_voting_complete(p_team_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_members INTEGER;
  v_total_votes INTEGER;
BEGIN
  -- Get total active members
  SELECT COUNT(*) INTO v_total_members
  FROM team_members
  WHERE team_id = p_team_id AND status = 'active';

  -- Get total votes cast
  SELECT COUNT(*) INTO v_total_votes
  FROM leader_votes
  WHERE team_id = p_team_id
    AND voting_round = (
      SELECT MAX(voting_round) FROM leader_votes WHERE team_id = p_team_id
    );

  -- If all members have voted, finalize
  IF v_total_votes >= v_total_members AND v_total_members > 0 THEN
    PERFORM finalize_voting(p_team_id);
  END IF;
END;
$$;

-- 1. Create Profile with Secret Code
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

-- 2. Login with Secret Code
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

-- 3. Create Team (Makes creator the leader)
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

-- 4. Request to Join Team
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

-- 5. Accept/Reject Join Request
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

-- 6. Leave Team (Member removes self)
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
    UPDATE teams SET status = 'disbanded', disbanded_at = NOW() WHERE id = p_team_id;
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- 7. Initiate Leader Voting
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

-- 8. Cast/Update Vote
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
  SELECT COALESCE(MAX(voting_round), 0) INTO v_current_round
  FROM leader_votes
  WHERE team_id = p_team_id;

  -- If no votes yet, start at round 1
  IF v_current_round = 0 THEN
    v_current_round := 1;
  END IF;

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

-- 9. Finalize Voting
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

-- 10. Update User Status
CREATE OR REPLACE FUNCTION update_user_status(
  p_profile_id UUID,
  p_status VARCHAR
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET user_status = p_status,
      last_active_at = NOW()
  WHERE id = p_profile_id;

  IF FOUND THEN
    -- Log activity
    INSERT INTO activities (
      event_type, actor_id, profile_id, metadata
    ) VALUES (
      'status_changed', p_profile_id, p_profile_id,
      jsonb_build_object('new_status', p_status)
    );

    RETURN json_build_object('success', true, 'status', p_status);
  ELSE
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;
END;
$$;

-- 11. Share Team Contacts
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
            'telegram', p.telegram_username,
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

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Anyone can create profile"
  ON profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Profiles are viewable"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (id = current_setting('app.current_user_id', true)::UUID);

-- Teams policies
CREATE POLICY "Teams are public"
  ON teams FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create teams"
  ON teams FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Leaders manage teams"
  ON teams FOR UPDATE
  USING (leader_id = current_setting('app.current_user_id', true)::UUID);

CREATE POLICY "Leaders can disband teams"
  ON teams FOR DELETE
  USING (leader_id = current_setting('app.current_user_id', true)::UUID);

-- Team members policies
CREATE POLICY "Team members are viewable"
  ON team_members FOR SELECT
  USING (true);

CREATE POLICY "System manages team members"
  ON team_members FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System updates team members"
  ON team_members FOR UPDATE
  USING (true);

-- Join requests policies
CREATE POLICY "Leaders see team requests"
  ON join_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_id
      AND teams.leader_id = current_setting('app.current_user_id', true)::UUID
    ) OR profile_id = current_setting('app.current_user_id', true)::UUID
  );

CREATE POLICY "Anyone can create requests"
  ON join_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users withdraw own requests"
  ON join_requests FOR UPDATE
  USING (profile_id = current_setting('app.current_user_id', true)::UUID);

-- Leader votes policies
CREATE POLICY "Team members can vote"
  ON leader_votes FOR SELECT
  USING (true);

CREATE POLICY "Members create votes"
  ON leader_votes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Members update votes"
  ON leader_votes FOR UPDATE
  USING (voter_id = current_setting('app.current_user_id', true)::UUID);

-- Notifications policies
CREATE POLICY "Users see own notifications"
  ON notifications FOR SELECT
  USING (profile_id = current_setting('app.current_user_id', true)::UUID);

CREATE POLICY "System creates notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (profile_id = current_setting('app.current_user_id', true)::UUID);

-- Activities policies
CREATE POLICY "Activities are public"
  ON activities FOR SELECT
  USING (true);

CREATE POLICY "System creates activities"
  ON activities FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- =====================================================

-- Enable realtime on critical tables
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE join_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE leader_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE activities;

-- Set replica identity for better change tracking
ALTER TABLE teams REPLICA IDENTITY FULL;
ALTER TABLE team_members REPLICA IDENTITY FULL;
ALTER TABLE join_requests REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE leader_votes REPLICA IDENTITY FULL;
ALTER TABLE activities REPLICA IDENTITY FULL;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leader_votes_updated_at
  BEFORE UPDATE ON leader_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- END OF SCHEMA
-- =====================================================