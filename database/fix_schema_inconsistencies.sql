-- FIX ALL DATABASE SCHEMA INCONSISTENCIES
-- This aligns the database with the functions in database_schema.sql

-- =====================================================
-- STEP 1: FIX TEAM_MEMBERS TABLE
-- =====================================================

-- Add presence column for online/away/busy/offline status
ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS presence VARCHAR(20) DEFAULT 'offline'
CHECK (presence IN ('online', 'away', 'busy', 'offline'));

-- The status column already has the correct constraint for membership
-- ('active', 'inactive', 'removed')

-- =====================================================
-- STEP 2: FIX VOTING SYSTEM
-- =====================================================

-- Add voting_round_id column that functions are expecting
ALTER TABLE leader_votes
ADD COLUMN IF NOT EXISTS voting_round_id UUID;

-- Add foreign key to voting_rounds
ALTER TABLE leader_votes
ADD CONSTRAINT leader_votes_voting_round_id_fkey
FOREIGN KEY (voting_round_id) REFERENCES voting_rounds(id) ON DELETE CASCADE;

-- Drop the old unique constraint if it exists
ALTER TABLE leader_votes
DROP CONSTRAINT IF EXISTS unique_vote_per_round;

-- Add new unique constraint with voting_round_id
ALTER TABLE leader_votes
DROP CONSTRAINT IF EXISTS leader_votes_voting_round_id_voter_id_key;

ALTER TABLE leader_votes
ADD CONSTRAINT leader_votes_voting_round_id_voter_id_key
UNIQUE (voting_round_id, voter_id);

-- =====================================================
-- STEP 3: UPDATE FUNCTIONS TO USE CORRECT COLUMNS
-- =====================================================

-- Fix create_team function
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

    -- Add leader to team_members with correct status and presence
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

-- Fix respond_to_request function
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
        -- Get current member count
        SELECT COUNT(*) INTO v_member_count
        FROM team_members
        WHERE team_id = v_request.team_id;

        -- Check if team is full
        IF v_member_count >= v_team.max_members THEN
            RETURN json_build_object('success', false, 'error', 'Team is full');
        END IF;

        -- Delete any existing member records (to handle rejoin)
        DELETE FROM team_members
        WHERE team_id = v_request.team_id
        AND profile_id = v_request.profile_id;

        -- Add to team with correct status and presence
        INSERT INTO team_members (
            team_id, profile_id, role, joined_at, status, presence
        ) VALUES (
            v_request.team_id,
            v_request.profile_id,
            COALESCE(v_request.requested_role, 'member'),
            NOW(),
            'active',  -- Correct membership status
            'offline'  -- Default presence
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

-- Fix update_presence to use presence column
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

    -- Update presence column (not status)
    UPDATE team_members
    SET presence = p_status,  -- Changed from status to presence
        last_seen = NOW()
    WHERE profile_id = p_profile_id AND team_id = p_team_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Not a team member');
    END IF;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The cast_vote and finalize_voting functions already use voting_round_id correctly
-- No changes needed for them

-- =====================================================
-- STEP 4: DATA MIGRATION
-- =====================================================

-- Set default presence for existing team members
UPDATE team_members
SET presence = 'offline'
WHERE presence IS NULL;

-- If there are existing votes with voting_round but no voting_round_id,
-- we need to populate voting_round_id from the voting_rounds table
UPDATE leader_votes lv
SET voting_round_id = vr.id
FROM voting_rounds vr
WHERE lv.team_id = vr.team_id
AND lv.voting_round_id IS NULL
AND vr.status = 'active';

-- If there are completed rounds, match them by order
WITH numbered_rounds AS (
    SELECT id, team_id,
           ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY created_at) as round_num
    FROM voting_rounds
)
UPDATE leader_votes lv
SET voting_round_id = nr.id
FROM numbered_rounds nr
WHERE lv.team_id = nr.team_id
AND lv.voting_round = nr.round_num
AND lv.voting_round_id IS NULL;

-- =====================================================
-- STEP 5: CLEANUP (OPTIONAL - RUN CAREFULLY)
-- =====================================================

-- After verifying voting_round_id is populated, you can drop the old column
-- ALTER TABLE leader_votes DROP COLUMN IF EXISTS voting_round;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

SELECT 'Schema inconsistencies fixed successfully!' AS status,
       COUNT(*) AS team_members_count,
       COUNT(DISTINCT presence) AS presence_values
FROM team_members;