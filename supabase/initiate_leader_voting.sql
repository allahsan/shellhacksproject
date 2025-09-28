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