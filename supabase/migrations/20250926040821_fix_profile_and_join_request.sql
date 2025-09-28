-- Fix for profile update and join request acceptance issues
-- Date: 2025-01-25

-- 1. Create update_profile_info function with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION "public"."update_profile_info"(
  "p_profile_id" "uuid",
  "p_email" VARCHAR(255),
  "p_phone" VARCHAR(20),
  "p_secret_code" VARCHAR(64),
  "p_proficiencies" TEXT[]
) RETURNS json
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
  -- Validate email format if provided
  IF p_email IS NOT NULL AND p_email != '' THEN
    IF NOT p_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$' THEN
      RETURN json_build_object('success', false, 'error', 'Invalid email format');
    END IF;
  END IF;

  -- Validate phone format if provided
  IF p_phone IS NOT NULL AND p_phone != '' THEN
    -- Remove formatting characters for validation
    DECLARE
      phone_digits VARCHAR(20);
    BEGIN
      phone_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');
      IF length(phone_digits) != 10 THEN
        RETURN json_build_object('success', false, 'error', 'Phone must be 10 digits');
      END IF;
    END;
  END IF;

  -- Validate secret code length
  IF p_secret_code IS NOT NULL AND length(p_secret_code) < 6 THEN
    RETURN json_build_object('success', false, 'error', 'Secret code must be at least 6 characters');
  END IF;

  -- Update the profile
  UPDATE profiles
  SET
    email = NULLIF(p_email, ''),
    phone = NULLIF(p_phone, ''),
    secret_code = p_secret_code,
    proficiencies = p_proficiencies,
    updated_at = NOW()
  WHERE id = p_profile_id;

  IF FOUND THEN
    RETURN json_build_object('success', true);
  ELSE
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;
END;
$$;

-- Grant permissions for the new function
GRANT ALL ON FUNCTION "public"."update_profile_info"("uuid", VARCHAR, VARCHAR, VARCHAR, TEXT[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_info"("uuid", VARCHAR, VARCHAR, VARCHAR, TEXT[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_info"("uuid", VARCHAR, VARCHAR, VARCHAR, TEXT[]) TO "service_role";

-- 2. Fix respond_to_request function - RETURNING COUNT(*) syntax error
CREATE OR REPLACE FUNCTION "public"."respond_to_request"("p_request_id" "uuid", "p_leader_id" "uuid", "p_accept" boolean, "p_response_message" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_request RECORD;
    v_team RECORD;
    v_member_count INTEGER;
    v_withdrawn_count INTEGER;
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
            ELSE status  -- Keep current status
        END,
        updated_at = NOW()
        WHERE id = v_request.team_id;

        -- Update request status to accepted
        UPDATE join_requests
        SET status = 'accepted',
            responded_by = p_leader_id,
            response_message = p_response_message,
            responded_at = NOW()
        WHERE id = p_request_id;

        -- FIX: Count withdrawn requests first, then update them (correct syntax)
        SELECT COUNT(*) INTO v_withdrawn_count
        FROM join_requests
        WHERE profile_id = v_request.profile_id
          AND team_id != v_request.team_id
          AND status = 'pending';

        -- AUTO-WITHDRAW: Withdraw all other pending requests from this user
        UPDATE join_requests
        SET status = 'withdrawn',
            withdrawn_at = NOW()
        WHERE profile_id = v_request.profile_id
          AND team_id != v_request.team_id
          AND status = 'pending';

        -- Create notification for the accepted user
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

        -- If any requests were auto-withdrawn, notify those team leaders
        IF v_withdrawn_count > 0 THEN
            -- Notify team leaders whose pending requests were auto-withdrawn
            INSERT INTO notifications (
                profile_id, type, title, message, team_id, priority
            )
            SELECT
                t.leader_id,
                'request_withdrawn',
                'Request Auto-Withdrawn',
                (SELECT name FROM profiles WHERE id = v_request.profile_id) ||
                ' has joined another team. Their request has been automatically withdrawn.',
                jr.team_id,
                'normal'
            FROM join_requests jr
            INNER JOIN teams t ON t.id = jr.team_id
            WHERE jr.profile_id = v_request.profile_id
              AND jr.team_id != v_request.team_id
              AND jr.status = 'withdrawn'
              AND jr.withdrawn_at >= NOW() - INTERVAL '1 minute';
        END IF;

    ELSE
        -- Reject request
        UPDATE join_requests
        SET status = 'rejected',
            responded_by = p_leader_id,
            response_message = p_response_message,
            responded_at = NOW()
        WHERE id = p_request_id;

        -- Create notification for rejected user
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
        'accepted', p_accept,
        'auto_withdrawn', COALESCE(v_withdrawn_count, 0)
    );
END;
$$;