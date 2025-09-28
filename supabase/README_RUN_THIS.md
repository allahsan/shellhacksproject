# Supabase SQL Functions to Execute

## IMPORTANT: Run the following SQL in your Supabase SQL Editor

### 1. Secret Code Update Function

This function needs to be executed in Supabase to enable secret code updates:

```sql
-- Function to update user's secret code
CREATE OR REPLACE FUNCTION update_secret_code(
  p_profile_id UUID,
  p_current_code TEXT,
  p_new_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the current secret code matches (compare hashed versions)
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_profile_id
    AND secret_code = encode(digest(p_current_code, 'sha256'), 'hex')
  ) THEN
    RAISE EXCEPTION 'Current secret code is incorrect';
  END IF;

  -- Update the secret code (store as hashed)
  UPDATE profiles
  SET secret_code = encode(digest(p_new_code, 'sha256'), 'hex')
  WHERE id = p_profile_id;

  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_secret_code TO authenticated;
GRANT EXECUTE ON FUNCTION update_secret_code TO anon;
```

### How to Execute:

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the above SQL
4. Click "Run" to execute
5. The function will be created and ready to use

### Testing:
After creating the function, the secret code update feature in the Settings tab should work properly.

---

### 2. Leave Team Function (Updated - Handles Leaders)

This function handles both team members AND leaders leaving a team:

```sql
-- Create the leave_team function for members to leave a team
CREATE OR REPLACE FUNCTION public.leave_team(
    p_profile_id UUID,
    p_team_id UUID
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member_count INTEGER;
    v_team RECORD;
    v_voting_result json;
BEGIN
    -- Get team info
    SELECT * INTO v_team FROM teams WHERE id = p_team_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Team not found'
        );
    END IF;

    -- Check if user is actually in the team OR is the leader
    IF NOT EXISTS (
        SELECT 1 FROM team_members
        WHERE team_id = p_team_id
        AND profile_id = p_profile_id
    ) AND v_team.leader_id != p_profile_id THEN
        RETURN json_build_object(
            'success', false,
            'error', 'You are not a member of this team'
        );
    END IF;

    -- Check if user is team leader
    IF v_team.leader_id = p_profile_id THEN
        -- Leader is leaving - count other active members
        SELECT COUNT(*) INTO v_member_count
        FROM team_members
        WHERE team_id = p_team_id
        AND status = 'active'
        AND profile_id != p_profile_id;

        IF v_member_count = 0 THEN
            -- Leader is the only member - delete the team and all related data

            -- Delete all related records first (to handle foreign key constraints)
            DELETE FROM join_requests WHERE team_id = p_team_id;
            DELETE FROM notifications WHERE team_id = p_team_id;
            DELETE FROM team_posts WHERE team_id = p_team_id;
            DELETE FROM leader_votes WHERE team_id = p_team_id;
            DELETE FROM team_members WHERE team_id = p_team_id;

            -- Now delete the team itself
            DELETE FROM teams WHERE id = p_team_id;

            -- Update leader's profile
            UPDATE profiles
            SET
                current_team_id = NULL,
                profile_type = 'looking'
            WHERE id = p_profile_id;

            RETURN json_build_object(
                'success', true,
                'action', 'team_disbanded',
                'message', 'Team has been disbanded as you were the only member'
            );
        ELSE
            -- There are other members - initiate voting or auto-promote
            SELECT initiate_leader_voting(p_team_id, p_profile_id) INTO v_voting_result;

            -- Update leader's profile
            UPDATE profiles
            SET
                current_team_id = NULL,
                profile_type = 'looking'
            WHERE id = p_profile_id;

            RETURN json_build_object(
                'success', true,
                'action', 'leadership_transfer',
                'voting_result', v_voting_result
            );
        END IF;
    ELSE
        -- Regular member leaving
        DELETE FROM team_members
        WHERE team_id = p_team_id AND profile_id = p_profile_id;

        -- Update profile to set as looking for team
        UPDATE profiles
        SET
            current_team_id = NULL,
            profile_type = 'looking'
        WHERE id = p_profile_id;

        -- Get updated member count
        SELECT COUNT(*) INTO v_member_count
        FROM team_members
        WHERE team_id = p_team_id
        AND status = 'active';

        -- Update team status automatically based on member count
        UPDATE teams
        SET
            status = CASE
                WHEN v_member_count >= max_members THEN 'full'
                WHEN v_member_count > 0 THEN 'recruiting'
                ELSE 'closed'
            END,
            updated_at = NOW()
        WHERE id = p_team_id;

        -- Create notification for team leader
        INSERT INTO notifications (
            profile_id, type, title, message, team_id, priority
        ) VALUES (
            v_team.leader_id,
            'member_left',
            'Member Left Team',
            (SELECT name FROM profiles WHERE id = p_profile_id) || ' has left the team',
            p_team_id,
            'normal'
        );

        RETURN json_build_object('success', true, 'action', 'member_left');
    END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.leave_team TO anon;
GRANT EXECUTE ON FUNCTION public.leave_team TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_team TO service_role;
```

### How to Execute:
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the above SQL
4. Click "Run" to execute
5. The function will be created and ready to use

### Testing:
After creating the function, team members should be able to leave their teams properly by typing the team name to confirm.

---

### 3. Leader Voting Function

This function handles leadership transitions when a leader leaves:

```sql
-- Function to initiate leader voting when a leader leaves the team
CREATE OR REPLACE FUNCTION public.initiate_leader_voting(
    p_team_id UUID,
    p_leaving_leader_id UUID
) RETURNS json
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

    -- Update the new leader's role in team_members
    UPDATE team_members
    SET role = 'leader'
    WHERE team_id = p_team_id
      AND profile_id = (
        SELECT leader_id FROM teams WHERE id = p_team_id
      );

    -- Update the new leader's profile
    UPDATE profiles
    SET profile_type = 'leader'
    WHERE id = (
      SELECT leader_id FROM teams WHERE id = p_team_id
    );

    -- Notify the new leader
    INSERT INTO notifications (profile_id, type, title, message, team_id, priority)
    VALUES (
      (SELECT leader_id FROM teams WHERE id = p_team_id),
      'promoted_to_leader',
      '👑 You are now the team leader!',
      'You have been automatically promoted to team leader.',
      p_team_id,
      'high'
    );

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
    '🗳️ Leader Election Started!',
    'Team leader left. Vote for new leader within 5 minutes!',
    p_team_id,
    'urgent'
  FROM team_members
  WHERE team_id = p_team_id
    AND status = 'active'
    AND profile_id != p_leaving_leader_id;

  -- Remove leaving leader from team_members
  DELETE FROM team_members
  WHERE team_id = p_team_id
    AND profile_id = p_leaving_leader_id;

  RETURN json_build_object('success', true, 'action', 'voting_started');
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.initiate_leader_voting TO anon;
GRANT EXECUTE ON FUNCTION public.initiate_leader_voting TO authenticated;
GRANT EXECUTE ON FUNCTION public.initiate_leader_voting TO service_role;
```

### How to Execute ALL Functions:
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste EACH function above (one at a time)
4. Click "Run" to execute each function
5. All functions will be created and ready to use

### Important: Execute Order
Execute the functions in this order:
1. First: `initiate_leader_voting` (required by leave_team)
2. Second: `leave_team` (depends on initiate_leader_voting)
3. Third: `update_secret_code` (independent)

### Testing:
- Leaders can now leave teams and the system will handle leadership transition automatically
- If leader is alone, team is disbanded
- If one member remains, they become leader
- If multiple members remain, voting starts