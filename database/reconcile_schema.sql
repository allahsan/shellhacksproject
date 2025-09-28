-- RECONCILIATION SCRIPT TO ALIGN WITH database_schema.sql
-- This fixes discrepancies between our migration and the actual schema

-- 1. Fix team_members table status constraint
ALTER TABLE team_members
DROP CONSTRAINT IF EXISTS team_members_status_check;

-- Update the status column to match schema (different from our migration)
-- Schema has 'active', 'inactive', 'removed' for team membership status
-- We added 'online', 'away', 'busy', 'offline' for presence status
-- Need to separate these concerns

-- Add presence column for online status (separate from membership status)
ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS presence VARCHAR(20) DEFAULT 'offline'
CHECK (presence IN ('online', 'away', 'busy', 'offline'));

-- Fix status column to match schema
ALTER TABLE team_members
ALTER COLUMN status TYPE VARCHAR(20),
ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE team_members
ADD CONSTRAINT team_members_status_check
CHECK (status IN ('active', 'inactive', 'removed'));

-- 2. Fix leader_votes table structure to match schema
ALTER TABLE leader_votes
DROP COLUMN IF EXISTS voting_round_id;

ALTER TABLE leader_votes
ADD COLUMN IF NOT EXISTS voting_round INTEGER DEFAULT 1;

ALTER TABLE leader_votes
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add the no self-vote constraint from schema
ALTER TABLE leader_votes
DROP CONSTRAINT IF EXISTS no_self_vote;

ALTER TABLE leader_votes
ADD CONSTRAINT no_self_vote CHECK (voter_id <> candidate_id);

-- Remove unique constraint that references voting_round_id
ALTER TABLE leader_votes
DROP CONSTRAINT IF EXISTS leader_votes_voting_round_id_voter_id_key;

-- 3. Update the update_presence function to use the new presence column
CREATE OR REPLACE FUNCTION update_presence(
    p_profile_id UUID,
    p_team_id UUID,
    p_status VARCHAR
) RETURNS JSON AS $$
BEGIN
    -- Validate status
    IF p_status NOT IN ('online', 'away', 'busy', 'offline') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid status');
    END IF;

    -- Update presence (not status)
    UPDATE team_members
    SET presence = p_status,
        last_seen = NOW()
    WHERE profile_id = p_profile_id AND team_id = p_team_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Not a team member');
    END IF;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update cast_vote to work with voting_round column instead of voting_round_id
CREATE OR REPLACE FUNCTION cast_vote(
    p_voter_id UUID,
    p_team_id UUID,
    p_candidate_id UUID
) RETURNS JSON AS $$
DECLARE
    v_round RECORD;
    v_round_number INTEGER;
BEGIN
    -- Get active voting round
    SELECT * INTO v_round
    FROM voting_rounds
    WHERE team_id = p_team_id
    AND status = 'active'
    AND ends_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'No active voting round');
    END IF;

    -- Check if voter is team member
    IF NOT EXISTS (
        SELECT 1 FROM team_members
        WHERE team_id = p_team_id
        AND profile_id = p_voter_id
        AND status = 'active'
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Only active team members can vote');
    END IF;

    -- Check if candidate is team member
    IF NOT EXISTS (
        SELECT 1 FROM team_members
        WHERE team_id = p_team_id
        AND profile_id = p_candidate_id
        AND status = 'active'
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Candidate must be an active team member');
    END IF;

    -- Get the voting round number
    SELECT COUNT(*) + 1 INTO v_round_number
    FROM voting_rounds
    WHERE team_id = p_team_id
    AND created_at < v_round.created_at;

    -- Cast or update vote
    INSERT INTO leader_votes (
        team_id,
        voter_id,
        candidate_id,
        voting_round
    ) VALUES (
        p_team_id,
        p_voter_id,
        p_candidate_id,
        v_round_number
    )
    ON CONFLICT (team_id, voter_id, voting_round)
    DO UPDATE SET
        candidate_id = EXCLUDED.candidate_id,
        updated_at = NOW();

    -- Update vote count
    UPDATE voting_rounds
    SET total_votes = (
        SELECT COUNT(DISTINCT voter_id)
        FROM leader_votes
        WHERE team_id = p_team_id
        AND voting_round = v_round_number
    )
    WHERE id = v_round.id;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update finalize_voting to work with voting_round column
CREATE OR REPLACE FUNCTION finalize_voting(p_round_id UUID)
RETURNS JSON AS $$
DECLARE
    v_winner_id UUID;
    v_team_id UUID;
    v_round RECORD;
    v_round_number INTEGER;
BEGIN
    -- Get voting round
    SELECT * INTO v_round FROM voting_rounds WHERE id = p_round_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Voting round not found');
    END IF;

    -- Check if voting has ended
    IF v_round.ends_at > NOW() THEN
        RETURN json_build_object('success', false, 'error', 'Voting still in progress');
    END IF;

    -- Get the voting round number
    SELECT COUNT(*) + 1 INTO v_round_number
    FROM voting_rounds
    WHERE team_id = v_round.team_id
    AND created_at < v_round.created_at;

    -- Find winner (most votes)
    SELECT candidate_id INTO v_winner_id
    FROM leader_votes
    WHERE team_id = v_round.team_id
    AND voting_round = v_round_number
    GROUP BY candidate_id
    ORDER BY COUNT(*) DESC
    LIMIT 1;

    IF v_winner_id IS NULL THEN
        -- No votes cast
        UPDATE voting_rounds
        SET status = 'failed'
        WHERE id = p_round_id;

        RETURN json_build_object('success', false, 'error', 'No votes were cast');
    END IF;

    -- Update voting round
    UPDATE voting_rounds
    SET status = 'completed',
        winner_id = v_winner_id
    WHERE id = p_round_id;

    -- Update team leader
    UPDATE teams
    SET leader_id = v_winner_id
    WHERE id = v_round.team_id;

    -- Update team member role
    UPDATE team_members
    SET role = 'leader'
    WHERE team_id = v_round.team_id AND profile_id = v_winner_id;

    -- Update profile
    UPDATE profiles
    SET profile_type = 'leader'
    WHERE id = v_winner_id;

    -- Notify all team members
    INSERT INTO notifications (profile_id, type, title, message, team_id, priority)
    SELECT
        profile_id,
        'new_leader',
        '👑 New Team Leader',
        (SELECT name FROM profiles WHERE id = v_winner_id) || ' is now the team leader!',
        v_round.team_id,
        'high'
    FROM team_members
    WHERE team_id = v_round.team_id
    AND status = 'active';

    RETURN json_build_object(
        'success', true,
        'winner_id', v_winner_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Add unique constraint for leader_votes with voting_round
ALTER TABLE leader_votes
DROP CONSTRAINT IF EXISTS unique_vote_per_round;

ALTER TABLE leader_votes
ADD CONSTRAINT unique_vote_per_round
UNIQUE (team_id, voter_id, voting_round);

-- 7. Update create_team to use correct presence column
CREATE OR REPLACE FUNCTION create_team(
    p_leader_id UUID,
    p_name VARCHAR,
    p_description TEXT,
    p_project_description TEXT DEFAULT NULL,
    p_skills_needed TEXT[] DEFAULT NULL,
    p_tech_stack TEXT[] DEFAULT NULL,
    p_looking_for_roles TEXT[] DEFAULT NULL,
    p_min_members INT DEFAULT 2,
    p_max_members INT DEFAULT 8
) RETURNS JSON AS $$
DECLARE
    v_team_id UUID;
    v_team_name VARCHAR;
BEGIN
    -- Create the team
    INSERT INTO teams (
        leader_id, name, description, project_description,
        skills_needed, tech_stack, looking_for_roles,
        min_members, max_members, status
    ) VALUES (
        p_leader_id, p_name, p_description, p_project_description,
        p_skills_needed, p_tech_stack, p_looking_for_roles,
        p_min_members, p_max_members, 'recruiting'
    )
    RETURNING id, name INTO v_team_id, v_team_name;

    -- Add leader to team_members with active status and online presence
    INSERT INTO team_members (
        team_id, profile_id, role, joined_at, status, presence
    ) VALUES (
        v_team_id, p_leader_id, 'leader', NOW(), 'active', 'online'
    );

    -- Update profile
    UPDATE profiles
    SET current_team_id = v_team_id, profile_type = 'leader'
    WHERE id = p_leader_id;

    RETURN json_build_object(
        'success', true,
        'team_id', v_team_id,
        'team_name', v_team_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Update respond_to_request to use correct status
CREATE OR REPLACE FUNCTION respond_to_request(
    p_request_id UUID,
    p_leader_id UUID,
    p_accept BOOLEAN,
    p_response_message TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_request RECORD;
    v_team RECORD;
    v_member_count INTEGER;
BEGIN
    -- Get request details
    SELECT * INTO v_request FROM join_requests WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Request not found');
    END IF;

    -- Check if request is still pending
    IF v_request.status != 'pending' THEN
        RETURN json_build_object('success', false, 'error', 'Request already processed');
    END IF;

    -- Get team details
    SELECT * INTO v_team FROM teams WHERE id = v_request.team_id;

    -- Check authorization - ONLY team leader can respond
    IF v_team.leader_id != p_leader_id THEN
        RETURN json_build_object('success', false, 'error', 'Only team leader can manage join requests');
    END IF;

    IF p_accept THEN
        -- Get current member count (only active members)
        SELECT COUNT(*) INTO v_member_count
        FROM team_members
        WHERE team_id = v_request.team_id
        AND status = 'active';

        -- Check if team is full
        IF v_member_count >= v_team.max_members THEN
            RETURN json_build_object('success', false, 'error', 'Team is full');
        END IF;

        -- Delete any existing member records (to handle rejoin)
        DELETE FROM team_members
        WHERE team_id = v_request.team_id
        AND profile_id = v_request.profile_id;

        -- Add to team with active status and offline presence
        INSERT INTO team_members (
            team_id, profile_id, role, joined_at, status, presence
        ) VALUES (
            v_request.team_id,
            v_request.profile_id,
            COALESCE(v_request.requested_role, 'member'),
            NOW(),
            'active',
            'offline'
        );

        -- Update profile
        UPDATE profiles
        SET current_team_id = v_request.team_id, profile_type = 'member'
        WHERE id = v_request.profile_id;

        -- Update team status automatically based on member count
        UPDATE teams
        SET status = CASE
            WHEN v_member_count + 1 >= max_members THEN 'full'
            ELSE 'recruiting'
        END,
        updated_at = NOW()
        WHERE id = v_request.team_id;

        -- Update request status
        UPDATE join_requests
        SET status = 'accepted',
            responded_by = p_leader_id,
            response_message = p_response_message,
            responded_at = NOW()
        WHERE id = p_request_id;

        -- Create notification
        INSERT INTO notifications (
            profile_id, type, title, message, team_id, priority
        ) VALUES (
            v_request.profile_id,
            'request_accepted',
            '🎉 Request Accepted!',
            'You are now part of ' || v_team.name || '!',
            v_request.team_id,
            'high'
        );
    ELSE
        -- Reject request
        UPDATE join_requests
        SET status = 'rejected',
            responded_by = p_leader_id,
            response_message = p_response_message,
            responded_at = NOW()
        WHERE id = p_request_id;

        -- Create notification
        INSERT INTO notifications (
            profile_id, type, title, message, team_id
        ) VALUES (
            v_request.profile_id,
            'request_rejected',
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success
SELECT 'Schema reconciliation complete!' AS status;