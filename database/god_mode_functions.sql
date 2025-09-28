-- God Mode Admin Functions for ShellHack

-- 1. Reset User Password Function
CREATE OR REPLACE FUNCTION reset_user_password(
  p_identifier VARCHAR,
  p_new_password VARCHAR
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_hashed_password TEXT;
BEGIN
  -- Hash the new password
  v_hashed_password := encode(digest(p_new_password, 'sha256'), 'hex');

  -- Update user password
  UPDATE profiles
  SET
    secret_code = v_hashed_password,
    updated_at = NOW()
  WHERE email = p_identifier OR phone = p_identifier
  RETURNING * INTO v_user;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Log the reset action
  INSERT INTO admin_logs (action, target_user_id, details, created_at)
  VALUES ('password_reset', v_user.id,
    json_build_object('identifier', p_identifier)::text,
    NOW());

  RETURN json_build_object(
    'success', true,
    'user', json_build_object(
      'id', v_user.id,
      'name', v_user.name,
      'email', v_user.email,
      'phone', v_user.phone
    )
  );
END;
$$;

-- 2. Get All Users Function
CREATE OR REPLACE FUNCTION get_all_users(
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_users JSON;
  v_total INT;
BEGIN
  -- Get total count
  SELECT COUNT(*) INTO v_total FROM profiles;

  -- Get users
  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'name', p.name,
      'email', p.email,
      'phone', p.phone,
      'profile_type', p.profile_type,
      'created_at', p.created_at,
      'last_active_at', p.last_active_at,
      'team_name', t.name,
      'team_id', tm.team_id,
      'team_role', tm.role
    ) ORDER BY p.created_at DESC
  ) INTO v_users
  FROM profiles p
  LEFT JOIN team_members tm ON tm.profile_id = p.id
  LEFT JOIN teams t ON t.id = tm.team_id
  LIMIT p_limit
  OFFSET p_offset;

  RETURN json_build_object(
    'success', true,
    'total', v_total,
    'users', COALESCE(v_users, '[]'::json)
  );
END;
$$;

-- 3. Delete User Function
CREATE OR REPLACE FUNCTION delete_user(
  p_user_id UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
BEGIN
  -- Get user details before deletion
  SELECT * INTO v_user FROM profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Remove from team_members
  DELETE FROM team_members WHERE profile_id = p_user_id;

  -- Remove join requests
  DELETE FROM join_requests WHERE profile_id = p_user_id;

  -- Delete profile
  DELETE FROM profiles WHERE id = p_user_id;

  -- Log the action
  INSERT INTO admin_logs (action, target_user_id, details, created_at)
  VALUES ('user_deleted', p_user_id,
    json_build_object('user_name', v_user.name, 'email', v_user.email)::text,
    NOW());

  RETURN json_build_object(
    'success', true,
    'deleted_user', v_user.name
  );
END;
$$;

-- 4. Modify Team Membership
CREATE OR REPLACE FUNCTION modify_team_membership(
  p_user_id UUID,
  p_team_id UUID,
  p_action VARCHAR, -- 'add' or 'remove'
  p_role VARCHAR DEFAULT 'member'
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result RECORD;
BEGIN
  IF p_action = 'add' THEN
    -- Check if already member
    IF EXISTS (SELECT 1 FROM team_members WHERE profile_id = p_user_id AND team_id = p_team_id) THEN
      RETURN json_build_object(
        'success', false,
        'error', 'User already in team'
      );
    END IF;

    -- Add to team
    INSERT INTO team_members (team_id, profile_id, role, joined_at, status, presence)
    VALUES (p_team_id, p_user_id, p_role, NOW(), 'active', 'offline')
    RETURNING * INTO v_result;

    RETURN json_build_object(
      'success', true,
      'action', 'added',
      'team_member_id', v_result.id
    );

  ELSIF p_action = 'remove' THEN
    -- Remove from team
    DELETE FROM team_members
    WHERE profile_id = p_user_id AND team_id = p_team_id
    RETURNING * INTO v_result;

    IF NOT FOUND THEN
      RETURN json_build_object(
        'success', false,
        'error', 'User not in team'
      );
    END IF;

    RETURN json_build_object(
      'success', true,
      'action', 'removed'
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid action. Use "add" or "remove"'
    );
  END IF;
END;
$$;

-- 5. Get System Statistics
CREATE OR REPLACE FUNCTION get_system_stats() RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'total_teams', (SELECT COUNT(*) FROM teams WHERE status != 'disbanded'),
    'active_teams', (SELECT COUNT(*) FROM teams WHERE status = 'recruiting'),
    'total_join_requests', (SELECT COUNT(*) FROM join_requests WHERE status = 'pending'),
    'total_posts', (SELECT COUNT(*) FROM team_posts),
    'users_in_teams', (SELECT COUNT(DISTINCT profile_id) FROM team_members),
    'users_without_teams', (
      SELECT COUNT(*) FROM profiles p
      WHERE NOT EXISTS (SELECT 1 FROM team_members tm WHERE tm.profile_id = p.id)
    ),
    'recent_signups', (
      SELECT json_agg(
        json_build_object('name', name, 'email', email, 'created_at', created_at)
        ORDER BY created_at DESC
      ) FROM profiles
      WHERE created_at > NOW() - INTERVAL '24 hours'
      LIMIT 10
    )
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

-- Create admin logs table if not exists
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL,
  target_user_id UUID,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant permissions
GRANT EXECUTE ON FUNCTION reset_user_password TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_all_users TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION delete_user TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION modify_team_membership TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_system_stats TO anon, authenticated, service_role;

GRANT ALL ON TABLE admin_logs TO anon, authenticated, service_role;