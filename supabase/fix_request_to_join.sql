-- Fix for request_to_join function
-- This ensures the function exists in the database

-- Drop the function if it exists with wrong signature
DROP FUNCTION IF EXISTS public.request_to_join(UUID, UUID, VARCHAR, TEXT);

-- Create or replace the function with correct signature
CREATE OR REPLACE FUNCTION public.request_to_join(
  p_team_id UUID,
  p_profile_id UUID,
  p_requested_role VARCHAR,
  p_message TEXT DEFAULT NULL
)
RETURNS JSON
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

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.request_to_join TO anon;
GRANT EXECUTE ON FUNCTION public.request_to_join TO authenticated;