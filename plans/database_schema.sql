


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."authenticate_user"("p_identifier" character varying, "p_secret_code" character varying) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Redirect to existing login_with_secret function
  RETURN login_with_secret(p_identifier, p_secret_code);
END;
$$;


ALTER FUNCTION "public"."authenticate_user"("p_identifier" character varying, "p_secret_code" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cast_vote"("p_voter_id" "uuid", "p_team_id" "uuid", "p_candidate_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_round RECORD;
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
        WHERE team_id = p_team_id AND profile_id = p_voter_id
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Only team members can vote');
    END IF;

    -- Check if candidate is team member
    IF NOT EXISTS (
        SELECT 1 FROM team_members
        WHERE team_id = p_team_id AND profile_id = p_candidate_id
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Candidate must be a team member');
    END IF;

    -- Cast or update vote
    INSERT INTO leader_votes (
        team_id,
        voting_round_id,
        voter_id,
        candidate_id
    ) VALUES (
        p_team_id,
        v_round.id,
        p_voter_id,
        p_candidate_id
    )
    ON CONFLICT (voting_round_id, voter_id)
    DO UPDATE SET
        candidate_id = EXCLUDED.candidate_id,
        created_at = NOW();

    -- Update vote count
    UPDATE voting_rounds
    SET total_votes = (
        SELECT COUNT(DISTINCT voter_id)
        FROM leader_votes
        WHERE voting_round_id = v_round.id
    )
    WHERE id = v_round.id;

    RETURN json_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."cast_vote"("p_voter_id" "uuid", "p_team_id" "uuid", "p_candidate_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_secret_code"("p_profile_id" "uuid", "p_old_code" character varying, "p_new_code" character varying) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Validate new code length
  IF length(p_new_code) < 6 THEN
    RETURN json_build_object('success', false, 'error', 'Secret code must be at least 6 characters');
  END IF;

  -- Verify old code matches (compare hashed versions)
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_profile_id
    AND secret_code = encode(digest(p_old_code, 'sha256'), 'hex')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Current secret code is incorrect');
  END IF;

  -- Update to new code (hash it)
  UPDATE profiles
  SET
    secret_code = encode(digest(p_new_code, 'sha256'), 'hex'),
    updated_at = NOW()
  WHERE id = p_profile_id;

  RETURN json_build_object('success', true, 'message', 'Secret code changed successfully');

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in change_secret_code: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', 'An error occurred while changing secret code');
END;
$$;


ALTER FUNCTION "public"."change_secret_code"("p_profile_id" "uuid", "p_old_code" character varying, "p_new_code" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."change_secret_code"("p_profile_id" "uuid", "p_old_code" character varying, "p_new_code" character varying) IS 'Securely changes user secret code with proper validation and hashing.';



CREATE OR REPLACE FUNCTION "public"."check_voting_complete"("p_team_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."check_voting_complete"("p_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_profile"("p_name" character varying, "p_email" character varying, "p_phone" character varying, "p_secret_code" character varying, "p_proficiencies" "text"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."create_profile"("p_name" character varying, "p_email" character varying, "p_phone" character varying, "p_secret_code" character varying, "p_proficiencies" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_team"("p_leader_id" "uuid", "p_name" character varying, "p_description" "text", "p_project_description" "text" DEFAULT NULL::"text", "p_skills_needed" "text"[] DEFAULT NULL::"text"[], "p_tech_stack" "text"[] DEFAULT NULL::"text"[], "p_looking_for_roles" "text"[] DEFAULT NULL::"text"[], "p_min_members" integer DEFAULT 2, "p_max_members" integer DEFAULT 8) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_team_id UUID;
    v_team_name VARCHAR;
BEGIN
    -- Check if leader already has a team
    IF EXISTS (
        SELECT 1 FROM teams WHERE leader_id = p_leader_id
    ) THEN
        RAISE EXCEPTION 'You are already leading a team';
    END IF;

    -- Check if user is already in a team
    IF EXISTS (
        SELECT 1 FROM team_members
        WHERE profile_id = p_leader_id
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'You are already in a team';
    END IF;

    -- Check if team name already exists
    IF EXISTS (
        SELECT 1 FROM teams WHERE LOWER(name) = LOWER(p_name)
    ) THEN
        RAISE EXCEPTION 'A team with this name already exists';
    END IF;

    -- Create the team (only use columns that actually exist)
    INSERT INTO teams (
        leader_id,
        name,
        description,
        looking_for_roles,
        tech_stack,
        min_members,
        max_members,
        status
    ) VALUES (
        p_leader_id,
        p_name,
        p_description,
        COALESCE(p_looking_for_roles, ARRAY[]::TEXT[]),
        COALESCE(p_tech_stack, ARRAY[]::TEXT[]),
        p_min_members,
        p_max_members,
        'recruiting'
    )
    RETURNING id, name INTO v_team_id, v_team_name;

    -- Add leader to team_members
    INSERT INTO team_members (
        team_id,
        profile_id,
        role,
        joined_at,
        status,
        presence
    ) VALUES (
        v_team_id,
        p_leader_id,
        'leader',
        NOW(),
        'active',
        'online'
    );

    -- Update profile
    UPDATE profiles
    SET
        current_team_id = v_team_id,
        profile_type = 'leader'
    WHERE id = p_leader_id;

    -- Return JSON object like the existing function does
    RETURN json_build_object(
        'success', true,
        'team_id', v_team_id,
        'team_name', v_team_name
    );
END;
$$;


ALTER FUNCTION "public"."create_team"("p_leader_id" "uuid", "p_name" character varying, "p_description" "text", "p_project_description" "text", "p_skills_needed" "text"[], "p_tech_stack" "text"[], "p_looking_for_roles" "text"[], "p_min_members" integer, "p_max_members" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_skill_data"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_debug JSON;
BEGIN
    SELECT json_build_object(
        'teams_looking_for', (
            SELECT json_agg(
                json_build_object(
                    'team_name', name,
                    'status', status,
                    'looking_for_roles', looking_for_roles
                )
            )
            FROM public.teams
            WHERE looking_for_roles IS NOT NULL
            AND jsonb_array_length(looking_for_roles) > 0
        ),
        'user_skills', (
            SELECT json_agg(
                json_build_object(
                    'name', name,
                    'proficiencies', proficiencies
                )
            )
            FROM public.profiles
            WHERE proficiencies IS NOT NULL
            AND jsonb_array_length(proficiencies) > 0
        ),
        'role_counts', (
            SELECT json_agg(
                json_build_object(
                    'role', role,
                    'count', count
                )
            )
            FROM (
                SELECT
                    jsonb_array_elements_text(looking_for_roles) as role,
                    COUNT(*) as count
                FROM public.teams
                WHERE looking_for_roles IS NOT NULL
                GROUP BY role
            ) rc
        ),
        'skill_counts', (
            SELECT json_agg(
                json_build_object(
                    'skill', skill,
                    'count', count
                )
            )
            FROM (
                SELECT
                    jsonb_array_elements_text(proficiencies) as skill,
                    COUNT(*) as count
                FROM public.profiles
                WHERE proficiencies IS NOT NULL
                GROUP BY skill
            ) sc
        )
    ) INTO v_debug;

    RETURN v_debug;
END;
$$;


ALTER FUNCTION "public"."debug_skill_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_comment"("p_comment_id" "uuid", "p_session_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_post_id UUID;
    v_deleted_count INTEGER;
BEGIN
    -- Check if the session owns this comment
    IF NOT EXISTS (
        SELECT 1 FROM public.post_comments
        WHERE id = p_comment_id
        AND session_id = p_session_id
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'You can only delete your own comments'
        );
    END IF;

    -- Get the post_id before deleting
    SELECT post_id INTO v_post_id
    FROM public.post_comments
    WHERE id = p_comment_id;

    -- Count how many comments will be deleted (including replies)
    WITH RECURSIVE comment_tree AS (
        SELECT id FROM public.post_comments WHERE id = p_comment_id
        UNION ALL
        SELECT pc.id
        FROM public.post_comments pc
        INNER JOIN comment_tree ct ON pc.parent_comment_id = ct.id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM comment_tree;

    -- Delete the comment (CASCADE will delete replies)
    DELETE FROM public.post_comments
    WHERE id = p_comment_id
    AND session_id = p_session_id;

    -- Update comment count by subtracting the number of deleted comments
    UPDATE public.team_posts
    SET comments_count = GREATEST(0, comments_count - v_deleted_count)
    WHERE id = v_post_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Comment deleted successfully',
        'deleted_count', v_deleted_count
    );
END;
$$;


ALTER FUNCTION "public"."delete_comment"("p_comment_id" "uuid", "p_session_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user"("p_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."delete_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."edit_comment"("p_comment_id" "uuid", "p_session_id" "text", "p_new_content" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Check if the session owns this comment
    IF NOT EXISTS (
        SELECT 1 FROM public.post_comments
        WHERE id = p_comment_id
        AND session_id = p_session_id
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'You can only edit your own comments'
        );
    END IF;

    -- Update the comment
    UPDATE public.post_comments
    SET
        content = p_new_content,
        edited_at = NOW(),
        is_edited = true
    WHERE id = p_comment_id
    AND session_id = p_session_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Comment updated successfully'
    );
END;
$$;


ALTER FUNCTION "public"."edit_comment"("p_comment_id" "uuid", "p_session_id" "text", "p_new_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_voting"("p_round_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_winner_id UUID;
    v_team_id UUID;
    v_round RECORD;
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

    -- Find winner (most votes)
    SELECT candidate_id INTO v_winner_id
    FROM leader_votes
    WHERE voting_round_id = p_round_id
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
    WHERE team_id = v_round.team_id;

    RETURN json_build_object(
        'success', true,
        'winner_id', v_winner_id
    );
END;
$$;


ALTER FUNCTION "public"."finalize_voting"("p_round_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_users"("p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_all_users"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_hackathon_statistics"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_stats JSON;
BEGIN
    WITH stats AS (
        SELECT
            -- Active teams count (exclude voting and disbanded)
            (SELECT COUNT(*) FROM public.teams WHERE status IN ('recruiting', 'full', 'closed')) as active_teams,

            -- Total hackers count (all profiles in the platform)
            (SELECT COUNT(*) FROM public.profiles) as total_members,

            -- Solo hackers count (profiles without active team membership)
            (SELECT COUNT(*) FROM public.profiles p
             WHERE NOT EXISTS (
                 SELECT 1 FROM public.team_members tm
                 WHERE tm.profile_id = p.id
                 AND tm.status = 'active'
             )) as solo_hackers,

            -- Teams by status
            (SELECT COUNT(*) FROM public.teams WHERE status = 'recruiting') as teams_recruiting,
            (SELECT COUNT(*) FROM public.teams WHERE status = 'full') as teams_locked, -- Only 'full' status counts as locked

            -- Top skills
            (SELECT json_agg(skill_count ORDER BY count DESC)
             FROM (
                 SELECT jsonb_array_elements_text(to_jsonb(proficiencies)) as skill,
                        COUNT(*) as count
                 FROM public.profiles
                 WHERE proficiencies IS NOT NULL
                 GROUP BY skill
                 ORDER BY count DESC
                 LIMIT 10
             ) skill_count) as top_skills,

            -- Recent activities
            (SELECT json_agg(activity ORDER BY created_at DESC)
             FROM (
                 SELECT 'team_created' as type,
                        name as details,
                        created_at
                 FROM public.teams
                 ORDER BY created_at DESC
                 LIMIT 5
             ) activity) as recent_activities
    )
    SELECT json_build_object(
        'active_teams', active_teams,
        'total_members', total_members,
        'solo_hackers', solo_hackers,
        'teams_recruiting', teams_recruiting,
        'teams_locked', teams_locked,
        'top_skills', COALESCE(top_skills, '[]'::json),
        'recent_activities', COALESCE(recent_activities, '[]'::json)
    ) INTO v_stats
    FROM stats;

    RETURN v_stats;
END;
$$;


ALTER FUNCTION "public"."get_hackathon_statistics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_live_activity_feed"("p_limit" integer DEFAULT 15) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_activities json;
BEGIN
    WITH all_activities AS (
        -- 1. Member signups (new profiles)
        SELECT
            'member_signup' as activity_type,
            p.created_at,
            json_build_object(
                'icon', '👤',
                'message', p.name || ' just joined TeamDock',
                'time_ago',
                CASE
                    WHEN p.created_at > NOW() - INTERVAL '1 minute' THEN 'just now'
                    WHEN p.created_at > NOW() - INTERVAL '1 hour' THEN
                        EXTRACT(MINUTE FROM NOW() - p.created_at)::text || 'm ago'
                    WHEN p.created_at > NOW() - INTERVAL '24 hours' THEN
                        EXTRACT(HOUR FROM NOW() - p.created_at)::text || 'h ago'
                    ELSE EXTRACT(DAY FROM NOW() - p.created_at)::text || 'd ago'
                END,
                'member_name', p.name,
                'skills', COALESCE(p.proficiencies, ARRAY[]::text[])
            ) as data
        FROM public.profiles p

        UNION ALL

        -- 2. Members joining teams
        SELECT
            'member_joined' as activity_type,
            tm.joined_at as created_at,
            json_build_object(
                'icon', '✅',
                'message', p.name || ' joined team ' || t.name,
                'time_ago',
                CASE
                    WHEN tm.joined_at > NOW() - INTERVAL '1 minute' THEN 'just now'
                    WHEN tm.joined_at > NOW() - INTERVAL '1 hour' THEN
                        EXTRACT(MINUTE FROM NOW() - tm.joined_at)::text || 'm ago'
                    WHEN tm.joined_at > NOW() - INTERVAL '24 hours' THEN
                        EXTRACT(HOUR FROM NOW() - tm.joined_at)::text || 'h ago'
                    ELSE EXTRACT(DAY FROM NOW() - tm.joined_at)::text || 'd ago'
                END,
                'member_name', p.name,
                'team_name', t.name,
                'role', tm.role
            ) as data
        FROM public.team_members tm
        JOIN public.profiles p ON p.id = tm.profile_id
        JOIN public.teams t ON t.id = tm.team_id
        WHERE tm.status = 'active' AND tm.joined_at IS NOT NULL

        UNION ALL

        -- 3. Members leaving teams (using updated_at since left_at doesn't exist)
        SELECT
            'member_left' as activity_type,
            tm.updated_at as created_at,
            json_build_object(
                'icon', '👋',
                'message', p.name || ' left team ' || t.name,
                'time_ago',
                CASE
                    WHEN tm.updated_at > NOW() - INTERVAL '1 minute' THEN 'just now'
                    WHEN tm.updated_at > NOW() - INTERVAL '1 hour' THEN
                        EXTRACT(MINUTE FROM NOW() - tm.updated_at)::text || 'm ago'
                    WHEN tm.updated_at > NOW() - INTERVAL '24 hours' THEN
                        EXTRACT(HOUR FROM NOW() - tm.updated_at)::text || 'h ago'
                    ELSE EXTRACT(DAY FROM NOW() - tm.updated_at)::text || 'd ago'
                END,
                'member_name', p.name,
                'team_name', t.name
            ) as data
        FROM public.team_members tm
        JOIN public.profiles p ON p.id = tm.profile_id
        JOIN public.teams t ON t.id = tm.team_id
        WHERE tm.status = 'inactive' AND tm.updated_at > tm.created_at

        UNION ALL

        -- 4. New teams created
        SELECT
            'team_created' as activity_type,
            t.created_at,
            json_build_object(
                'icon', '🚀',
                'message', 'Team ' || t.name || ' was created',
                'time_ago',
                CASE
                    WHEN t.created_at > NOW() - INTERVAL '1 minute' THEN 'just now'
                    WHEN t.created_at > NOW() - INTERVAL '1 hour' THEN
                        EXTRACT(MINUTE FROM NOW() - t.created_at)::text || 'm ago'
                    WHEN t.created_at > NOW() - INTERVAL '24 hours' THEN
                        EXTRACT(HOUR FROM NOW() - t.created_at)::text || 'h ago'
                    ELSE EXTRACT(DAY FROM NOW() - t.created_at)::text || 'd ago'
                END,
                'team_name', t.name,
                'looking_for', t.looking_for_roles
            ) as data
        FROM public.teams t

        UNION ALL

        -- 5. Team status changes to full or closed (both count as "locked")
        SELECT
            'team_locked' as activity_type,
            t.updated_at as created_at,
            json_build_object(
                'icon', '🔒',
                'message', 'Team ' || t.name || ' is now ' ||
                    CASE
                        WHEN t.status = 'full' THEN 'full'
                        WHEN t.status = 'closed' THEN 'closed'
                        ELSE t.status
                    END,
                'time_ago',
                CASE
                    WHEN t.updated_at > NOW() - INTERVAL '1 minute' THEN 'just now'
                    WHEN t.updated_at > NOW() - INTERVAL '1 hour' THEN
                        EXTRACT(MINUTE FROM NOW() - t.updated_at)::text || 'm ago'
                    WHEN t.updated_at > NOW() - INTERVAL '24 hours' THEN
                        EXTRACT(HOUR FROM NOW() - t.updated_at)::text || 'h ago'
                    ELSE EXTRACT(DAY FROM NOW() - t.updated_at)::text || 'd ago'
                END,
                'team_name', t.name,
                'member_count', (
                    SELECT COUNT(*)
                    FROM public.team_members tm
                    WHERE tm.team_id = t.id AND tm.status = 'active'
                )
            ) as data
        FROM public.teams t
        WHERE t.status IN ('full', 'closed') -- Show both full and closed as locked events
            AND t.updated_at > t.created_at -- Only show if it was updated after creation
    )
    SELECT json_agg(
        json_build_object(
            'type', activity_type,
            'created_at', created_at,
            'data', data
        ) ORDER BY created_at DESC
    ) INTO v_activities
    FROM (
        SELECT * FROM all_activities
        ORDER BY created_at DESC
        LIMIT p_limit
    ) limited_activities;

    RETURN COALESCE(v_activities, '[]'::json);
END;
$$;


ALTER FUNCTION "public"."get_live_activity_feed"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_skill_distribution"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_skills JSON;
BEGIN
    WITH skill_counts AS (
        SELECT
            skill,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
        FROM (
            SELECT jsonb_array_elements_text(proficiencies) as skill
            FROM public.profiles
            WHERE proficiencies IS NOT NULL
        ) skills
        GROUP BY skill
        ORDER BY count DESC
    )
    SELECT json_agg(
        jsonb_build_object(
            'skill', skill,
            'count', count,
            'percentage', percentage
        ) ORDER BY count DESC
    ) INTO v_skills
    FROM skill_counts;

    RETURN COALESCE(v_skills, '[]'::json);
END;
$$;


ALTER FUNCTION "public"."get_skill_distribution"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_skill_supply_demand"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_analysis JSON;
BEGIN
    WITH
    -- Skills that people have (supply)
    skills_supply AS (
        SELECT
            skill,
            COUNT(*) as supply_count
        FROM (
            SELECT jsonb_array_elements_text(to_jsonb(proficiencies)) as skill
            FROM public.profiles
            WHERE proficiencies IS NOT NULL
            AND array_length(proficiencies, 1) > 0
        ) user_skills
        GROUP BY skill
    ),
    -- Roles teams are looking for (demand)
    roles_demand AS (
        SELECT
            role,
            COUNT(*) as demand_count
        FROM (
            SELECT jsonb_array_elements_text(to_jsonb(looking_for_roles)) as role
            FROM public.teams
            WHERE looking_for_roles IS NOT NULL
            AND array_length(looking_for_roles, 1) > 0
            AND status = 'recruiting'  -- Fixed: removed 'forming' which doesn't exist
        ) team_needs
        GROUP BY role
    ),
    -- Map roles to skills for better matching
    skills_demand AS (
        SELECT
            CASE
                WHEN LOWER(role) LIKE '%frontend%' THEN 'Frontend'
                WHEN LOWER(role) LIKE '%backend%' THEN 'Backend'
                WHEN LOWER(role) LIKE '%full%stack%' OR LOWER(role) LIKE '%fullstack%' THEN 'Full Stack'
                WHEN LOWER(role) LIKE '%mobile%' THEN 'Mobile'
                WHEN LOWER(role) LIKE '%design%' OR LOWER(role) LIKE '%ui%' OR LOWER(role) LIKE '%ux%' THEN 'UI/UX'
                WHEN LOWER(role) LIKE '%data%' THEN 'Data Science'
                WHEN LOWER(role) LIKE '%ml%' OR LOWER(role) LIKE '%ai%' OR LOWER(role) LIKE '%machine%' THEN 'ML/AI'
                WHEN LOWER(role) LIKE '%devops%' OR LOWER(role) LIKE '%dev%ops%' THEN 'DevOps'
                WHEN LOWER(role) LIKE '%cloud%' THEN 'Cloud'
                WHEN LOWER(role) LIKE '%security%' OR LOWER(role) LIKE '%cyber%' THEN 'Security'
                WHEN LOWER(role) LIKE '%blockchain%' OR LOWER(role) LIKE '%web3%' OR LOWER(role) LIKE '%crypto%' THEN 'Blockchain'
                WHEN LOWER(role) LIKE '%game%' THEN 'Game Dev'
                WHEN LOWER(role) LIKE '%pitch%' OR LOWER(role) LIKE '%present%' OR LOWER(role) LIKE '%business%' THEN 'Pitch'
                WHEN LOWER(role) LIKE '%ar%' OR LOWER(role) LIKE '%vr%' OR LOWER(role) LIKE '%xr%' OR LOWER(role) LIKE '%augmented%' OR LOWER(role) LIKE '%virtual%' THEN 'AR/VR'
                WHEN LOWER(role) LIKE '%iot%' OR LOWER(role) LIKE '%embedded%' OR LOWER(role) LIKE '%hardware%' THEN 'IoT'
                ELSE role  -- Keep original if no match
            END as skill,
            SUM(demand_count) as demand_count
        FROM roles_demand
        GROUP BY skill
    ),
    -- Combined analysis
    supply_demand AS (
        SELECT
            COALESCE(s.skill, d.skill) as skill,
            COALESCE(s.supply_count, 0) as available,
            COALESCE(d.demand_count, 0) as needed,
            CASE
                WHEN COALESCE(d.demand_count, 0) = 0 THEN 999  -- No demand
                WHEN COALESCE(s.supply_count, 0) = 0 THEN -999  -- No supply but has demand
                ELSE ROUND((COALESCE(s.supply_count, 0)::NUMERIC / COALESCE(d.demand_count, 1)::NUMERIC), 2)
            END as supply_ratio,
            CASE
                WHEN COALESCE(s.supply_count, 0) = 0 AND COALESCE(d.demand_count, 0) > 0 THEN 'CRITICAL_NEED'
                WHEN COALESCE(d.demand_count, 0) > COALESCE(s.supply_count, 0) THEN 'HIGH_DEMAND'
                WHEN COALESCE(d.demand_count, 0) = 0 AND COALESCE(s.supply_count, 0) > 0 THEN 'OVERSUPPLY'
                ELSE 'BALANCED'
            END as status,
            COALESCE(d.demand_count, 0) - COALESCE(s.supply_count, 0) as gap
        FROM skills_supply s
        FULL OUTER JOIN skills_demand d ON LOWER(s.skill) = LOWER(d.skill)
    )
    SELECT json_build_object(
        'high_demand_skills', COALESCE((
            SELECT json_agg(
                jsonb_build_object(
                    'skill', skill,
                    'available', available,
                    'needed', needed,
                    'gap', gap,
                    'status', status
                ) ORDER BY gap ASC, needed DESC
            )
            FROM supply_demand
            WHERE status IN ('HIGH_DEMAND', 'CRITICAL_NEED')
            AND skill IS NOT NULL
            LIMIT 8
        ), '[]'::json),
        'oversupplied_skills', COALESCE((
            SELECT json_agg(
                jsonb_build_object(
                    'skill', skill,
                    'available', available,
                    'needed', needed,
                    'ratio', supply_ratio,
                    'status', status
                ) ORDER BY available DESC
            )
            FROM supply_demand
            WHERE status = 'OVERSUPPLY'
            AND skill IS NOT NULL
            LIMIT 5
        ), '[]'::json),
        'balanced_skills', COALESCE((
            SELECT json_agg(
                jsonb_build_object(
                    'skill', skill,
                    'available', available,
                    'needed', needed,
                    'ratio', supply_ratio,
                    'status', status
                ) ORDER BY needed DESC
            )
            FROM supply_demand
            WHERE status = 'BALANCED'
            AND skill IS NOT NULL
            LIMIT 5
        ), '[]'::json),
        'summary', json_build_object(
            'total_skills_in_demand', COALESCE((SELECT COUNT(DISTINCT skill) FROM skills_demand WHERE skill IS NOT NULL), 0),
            'total_skills_available', COALESCE((SELECT COUNT(DISTINCT skill) FROM skills_supply WHERE skill IS NOT NULL), 0),
            'critical_gaps', COALESCE((SELECT COUNT(*) FROM supply_demand WHERE status = 'CRITICAL_NEED'), 0),
            'high_demand_count', COALESCE((SELECT COUNT(*) FROM supply_demand WHERE status = 'HIGH_DEMAND'), 0)
        )
    ) INTO v_analysis;

    RETURN COALESCE(v_analysis, json_build_object(
        'high_demand_skills', '[]'::json,
        'oversupplied_skills', '[]'::json,
        'balanced_skills', '[]'::json,
        'summary', json_build_object(
            'total_skills_in_demand', 0,
            'total_skills_available', 0,
            'critical_gaps', 0,
            'high_demand_count', 0
        )
    ));
END;
$$;


ALTER FUNCTION "public"."get_skill_supply_demand"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_system_stats"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_system_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initiate_leader_vote"("p_team_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_round_id UUID;
    v_member_count INTEGER;
BEGIN
    -- Check if team has no leader
    IF EXISTS (SELECT 1 FROM teams WHERE id = p_team_id AND leader_id IS NOT NULL) THEN
        RETURN json_build_object('success', false, 'error', 'Team already has a leader');
    END IF;

    -- Check if there's already an active vote
    IF EXISTS (
        SELECT 1 FROM voting_rounds
        WHERE team_id = p_team_id
        AND status = 'active'
        AND ends_at > NOW()
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Voting already in progress');
    END IF;

    -- Get member count
    SELECT COUNT(*) INTO v_member_count
    FROM team_members
    WHERE team_id = p_team_id;

    IF v_member_count = 0 THEN
        RETURN json_build_object('success', false, 'error', 'No members to vote');
    END IF;

    -- Create voting round (1 hour duration)
    INSERT INTO voting_rounds (
        team_id,
        ends_at,
        status
    ) VALUES (
        p_team_id,
        NOW() + INTERVAL '1 hour',
        'active'
    )
    RETURNING id INTO v_round_id;

    -- Notify all team members
    INSERT INTO notifications (profile_id, type, title, message, team_id, priority)
    SELECT
        profile_id,
        'voting_started',
        '🗳️ Leader Election Started',
        'Vote for your team leader! Voting ends in 1 hour.',
        p_team_id,
        'urgent'
    FROM team_members
    WHERE team_id = p_team_id;

    RETURN json_build_object(
        'success', true,
        'voting_round_id', v_round_id,
        'ends_at', NOW() + INTERVAL '1 hour'
    );
END;
$$;


ALTER FUNCTION "public"."initiate_leader_vote"("p_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initiate_leader_voting"("p_team_id" "uuid", "p_leaving_leader_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."initiate_leader_voting"("p_team_id" "uuid", "p_leaving_leader_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_team"("p_profile_id" "uuid", "p_team_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."leave_team"("p_profile_id" "uuid", "p_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."login_with_secret"("p_identifier" character varying, "p_secret_code" character varying) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."login_with_secret"("p_identifier" character varying, "p_secret_code" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."modify_team_membership"("p_user_id" "uuid", "p_team_id" "uuid", "p_action" character varying, "p_role" character varying DEFAULT 'member'::character varying) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."modify_team_membership"("p_user_id" "uuid", "p_team_id" "uuid", "p_action" character varying, "p_role" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reply_to_comment"("p_parent_comment_id" "uuid", "p_post_id" "uuid", "p_content" "text", "p_author_name" "text", "p_session_id" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_comment_id UUID;
BEGIN
    -- Insert the reply (trigger will handle count update)
    INSERT INTO public.post_comments (
        post_id,
        content,
        author_name,
        session_id,
        parent_comment_id
    ) VALUES (
        p_post_id,
        p_content,
        p_author_name,
        p_session_id,
        p_parent_comment_id
    ) RETURNING id INTO v_comment_id;

    RETURN v_comment_id;
END;
$$;


ALTER FUNCTION "public"."reply_to_comment"("p_parent_comment_id" "uuid", "p_post_id" "uuid", "p_content" "text", "p_author_name" "text", "p_session_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_to_join"("p_team_id" "uuid", "p_profile_id" "uuid", "p_requested_role" character varying, "p_message" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."request_to_join"("p_team_id" "uuid", "p_profile_id" "uuid", "p_requested_role" character varying, "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_user_password"("p_identifier" character varying, "p_new_password" character varying) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."reset_user_password"("p_identifier" character varying, "p_new_password" character varying) OWNER TO "postgres";


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


ALTER FUNCTION "public"."respond_to_request"("p_request_id" "uuid", "p_leader_id" "uuid", "p_accept" boolean, "p_response_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."share_team_contacts"("p_team_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."share_team_contacts"("p_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_post_like"("p_post_id" "uuid", "p_profile_id" "uuid" DEFAULT NULL::"uuid", "p_session_id" character varying DEFAULT NULL::character varying) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_liked BOOLEAN;
  v_new_count INTEGER;
BEGIN
  -- Check if already liked
  IF p_profile_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM post_likes
      WHERE post_id = p_post_id AND profile_id = p_profile_id
    ) INTO v_liked;

    IF v_liked THEN
      DELETE FROM post_likes
      WHERE post_id = p_post_id AND profile_id = p_profile_id;
    ELSE
      INSERT INTO post_likes (post_id, profile_id)
      VALUES (p_post_id, p_profile_id);
    END IF;
  ELSIF p_session_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM post_likes
      WHERE post_id = p_post_id AND session_id = p_session_id
    ) INTO v_liked;

    IF v_liked THEN
      DELETE FROM post_likes
      WHERE post_id = p_post_id AND session_id = p_session_id;
    ELSE
      INSERT INTO post_likes (post_id, session_id)
      VALUES (p_post_id, p_session_id);
    END IF;
  END IF;

  -- Update likes count
  UPDATE team_posts
  SET likes_count = (
    SELECT COUNT(*) FROM post_likes WHERE post_id = p_post_id
  )
  WHERE id = p_post_id
  RETURNING likes_count INTO v_new_count;

  RETURN json_build_object(
    'liked', NOT v_liked,
    'likes_count', v_new_count
  );
END;
$$;


ALTER FUNCTION "public"."toggle_post_like"("p_post_id" "uuid", "p_profile_id" "uuid", "p_session_id" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_comment_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.team_posts
        SET comments_count = comments_count + 1
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.team_posts
        SET comments_count = GREATEST(0, comments_count - 1)
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
END;
$$;


ALTER FUNCTION "public"."update_comment_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_presence"("p_profile_id" "uuid", "p_team_id" "uuid", "p_status" character varying) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."update_presence"("p_profile_id" "uuid", "p_team_id" "uuid", "p_status" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_info"("p_profile_id" "uuid", "p_email" character varying, "p_phone" character varying, "p_secret_code" character varying, "p_proficiencies" "text"[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  phone_digits VARCHAR(20);
  formatted_phone VARCHAR(20);
BEGIN
  -- Validate that the profile exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Validate email format if provided
  IF p_email IS NOT NULL AND p_email != '' THEN
    IF NOT p_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$' THEN
      RETURN json_build_object('success', false, 'error', 'Invalid email format');
    END IF;
  END IF;

  -- Process phone number if provided
  IF p_phone IS NOT NULL AND p_phone != '' THEN
    -- Remove all non-digits (handles XXX-XXX-XXXX format from frontend)
    phone_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');

    -- Check if it's 10 digits (US number)
    IF length(phone_digits) = 10 THEN
      -- Format as international: +1 prefix for US numbers
      formatted_phone := '+1' || phone_digits;
    ELSIF length(phone_digits) = 11 AND substring(phone_digits, 1, 1) = '1' THEN
      -- Already has country code
      formatted_phone := '+' || phone_digits;
    ELSE
      RETURN json_build_object('success', false, 'error', 'Phone must be 10 digits');
    END IF;
  ELSE
    formatted_phone := NULL;
  END IF;

  -- IMPORTANT: We do NOT update secret_code here!
  -- The frontend sends the already-hashed value which would corrupt the password
  UPDATE profiles
  SET
    email = CASE
      WHEN p_email = '' THEN NULL
      ELSE p_email
    END,
    phone = CASE
      WHEN p_phone = '' THEN NULL
      ELSE formatted_phone  -- Use the formatted phone with +1
    END,
    -- DO NOT UPDATE secret_code! It would double-hash and corrupt it
    proficiencies = COALESCE(p_proficiencies, ARRAY[]::text[]),
    updated_at = NOW()
  WHERE id = p_profile_id;

  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Failed to update profile');
  END IF;

  -- Return success
  RETURN json_build_object('success', true, 'message', 'Profile updated successfully');

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE WARNING 'Error in update_profile_info: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$_$;


ALTER FUNCTION "public"."update_profile_info"("p_profile_id" "uuid", "p_email" character varying, "p_phone" character varying, "p_secret_code" character varying, "p_proficiencies" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_profile_info"("p_profile_id" "uuid", "p_email" character varying, "p_phone" character varying, "p_secret_code" character varying, "p_proficiencies" "text"[]) IS 'Updates user profile (email, phone, skills). Ignores secret_code to prevent corruption. Formats US phone numbers to international format.';



CREATE OR REPLACE FUNCTION "public"."update_secret_code"("p_profile_id" "uuid", "p_current_code" "text", "p_new_code" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."update_secret_code"("p_profile_id" "uuid", "p_current_code" "text", "p_new_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_status"("p_profile_id" "uuid", "p_status" character varying) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."update_user_status"("p_profile_id" "uuid", "p_status" character varying) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" character varying(50) NOT NULL,
    "actor_id" "uuid",
    "team_id" "uuid",
    "profile_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."activities" REPLICA IDENTITY FULL;


ALTER TABLE "public"."activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action" character varying(50) NOT NULL,
    "target_user_id" "uuid",
    "details" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."join_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "requested_role" character varying(50) NOT NULL,
    "message" "text",
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "responded_by" "uuid",
    "response_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "responded_at" timestamp with time zone,
    "withdrawn_at" timestamp with time zone,
    CONSTRAINT "join_requests_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'withdrawn'::character varying, 'expired'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."join_requests" REPLICA IDENTITY FULL;


ALTER TABLE "public"."join_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leader_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "voter_id" "uuid" NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "voting_round" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "voting_round_id" "uuid",
    CONSTRAINT "no_self_vote" CHECK (("voter_id" <> "candidate_id"))
);

ALTER TABLE ONLY "public"."leader_votes" REPLICA IDENTITY FULL;


ALTER TABLE "public"."leader_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "type" character varying(30) NOT NULL,
    "title" character varying(200) NOT NULL,
    "message" "text" NOT NULL,
    "team_id" "uuid",
    "related_profile_id" "uuid",
    "join_request_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "action_url" "text",
    "priority" character varying(10) DEFAULT 'normal'::character varying,
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    CONSTRAINT "notifications_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::"text"[]))),
    CONSTRAINT "notifications_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['join_request'::character varying, 'request_accepted'::character varying, 'request_rejected'::character varying, 'member_joined'::character varying, 'member_left'::character varying, 'team_disbanded'::character varying, 'voting_started'::character varying, 'voting_ended'::character varying, 'new_leader'::character varying, 'role_filled'::character varying, 'team_full'::character varying, 'team_contacts'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."notifications" REPLICA IDENTITY FULL;


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "author_name" character varying(100),
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "session_id" "text",
    "parent_comment_id" "uuid",
    "edited_at" timestamp with time zone,
    "is_edited" boolean DEFAULT false,
    CONSTRAINT "valid_comment_length" CHECK ((("char_length"("content") >= 1) AND ("char_length"("content") <= 500)))
);


ALTER TABLE "public"."post_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "profile_id" "uuid",
    "session_id" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255),
    "phone" character varying(20),
    "secret_code" character varying(64) NOT NULL,
    "name" character varying(100) NOT NULL,
    "proficiencies" "text"[] DEFAULT '{}'::"text"[],
    "other_proficiency" character varying(100),
    "discord_username" character varying(100),
    "slack_username" character varying(100),
    "github_username" character varying(100),
    "telegram_username" character varying(100),
    "whatsapp_number" character varying(20),
    "profile_type" character varying(20) DEFAULT 'looking'::character varying,
    "is_available" boolean DEFAULT true,
    "user_status" character varying(20) DEFAULT 'available'::character varying,
    "current_team_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_active_at" timestamp with time zone DEFAULT "now"(),
    "discord_id" character varying(100),
    "discord_avatar" character varying(255),
    "discord_email" character varying(255),
    "discord_discriminator" character varying(10),
    CONSTRAINT "auth_requirement" CHECK ((("email" IS NOT NULL) OR ("phone" IS NOT NULL) OR ("discord_id" IS NOT NULL))),
    CONSTRAINT "profiles_user_status_check" CHECK ((("user_status")::"text" = ANY ((ARRAY['available'::character varying, 'busy'::character varying, 'break'::character varying, 'offline'::character varying])::"text"[]))),
    CONSTRAINT "valid_email" CHECK (((("email")::"text" ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'::"text") OR ("email" IS NULL))),
    CONSTRAINT "valid_phone" CHECK (((("phone")::"text" ~ '^\+?[1-9]\d{1,14}$'::"text") OR ("phone" IS NULL))),
    CONSTRAINT "valid_secret_code" CHECK (("char_length"(("secret_code")::"text") >= 6))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "role" character varying(50) NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "status" character varying(20) DEFAULT 'active'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_seen" timestamp without time zone DEFAULT "now"(),
    "presence" character varying(20) DEFAULT 'offline'::character varying,
    CONSTRAINT "team_members_presence_check" CHECK ((("presence")::"text" = ANY ((ARRAY['online'::character varying, 'away'::character varying, 'busy'::character varying, 'offline'::character varying])::"text"[]))),
    CONSTRAINT "team_members_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'removed'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."team_members" REPLICA IDENTITY FULL;


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid",
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "post_type" character varying(20) DEFAULT 'update'::character varying,
    "likes_count" integer DEFAULT 0,
    "comments_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "team_posts_post_type_check" CHECK ((("post_type")::"text" = ANY ((ARRAY['update'::character varying, 'milestone'::character varying, 'looking_for'::character varying, 'announcement'::character varying, 'achievement'::character varying])::"text"[]))),
    CONSTRAINT "valid_content_length" CHECK ((("char_length"("content") >= 1) AND ("char_length"("content") <= 1000)))
);


ALTER TABLE "public"."team_posts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."team_posts"."team_id" IS 'Team ID - NULL for Solo Hacker posts';



CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text" NOT NULL,
    "leader_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'recruiting'::character varying,
    "voting_started_at" timestamp with time zone,
    "voting_ends_at" timestamp with time zone,
    "max_members" integer DEFAULT 8,
    "min_members" integer DEFAULT 2,
    "auto_accept_requests" boolean DEFAULT false,
    "looking_for_roles" "text"[] DEFAULT '{}'::"text"[],
    "tech_stack" "text"[] DEFAULT '{}'::"text"[],
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "disbanded_at" timestamp with time zone,
    CONSTRAINT "teams_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['recruiting'::character varying, 'closed'::character varying, 'full'::character varying, 'voting'::character varying, 'disbanded'::character varying])::"text"[]))),
    CONSTRAINT "valid_team_size" CHECK ((("max_members" >= "min_members") AND ("max_members" <= 10)))
);

ALTER TABLE ONLY "public"."teams" REPLICA IDENTITY FULL;


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."voting_rounds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "started_at" timestamp without time zone DEFAULT "now"(),
    "ends_at" timestamp without time zone NOT NULL,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "winner_id" "uuid",
    "total_votes" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "voting_rounds_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'completed'::character varying, 'failed'::character varying])::"text"[])))
);


ALTER TABLE "public"."voting_rounds" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_logs"
    ADD CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."join_requests"
    ADD CONSTRAINT "join_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leader_votes"
    ADD CONSTRAINT "leader_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leader_votes"
    ADD CONSTRAINT "leader_votes_voting_round_id_voter_id_key" UNIQUE ("voting_round_id", "voter_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_discord_id_key" UNIQUE ("discord_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_posts"
    ADD CONSTRAINT "team_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "unique_like_per_session" UNIQUE ("post_id", "session_id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "unique_like_per_user" UNIQUE ("post_id", "profile_id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "unique_member_per_team" UNIQUE ("team_id", "profile_id");



ALTER TABLE ONLY "public"."voting_rounds"
    ADD CONSTRAINT "voting_rounds_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activities_actor" ON "public"."activities" USING "btree" ("actor_id");



CREATE INDEX "idx_activities_created" ON "public"."activities" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activities_team" ON "public"."activities" USING "btree" ("team_id");



CREATE INDEX "idx_join_requests_pending" ON "public"."join_requests" USING "btree" ("status") WHERE (("status")::"text" = 'pending'::"text");



CREATE INDEX "idx_join_requests_pending_team" ON "public"."join_requests" USING "btree" ("team_id") WHERE (("status")::"text" = 'pending'::"text");



CREATE INDEX "idx_join_requests_profile" ON "public"."join_requests" USING "btree" ("profile_id");



CREATE INDEX "idx_join_requests_team" ON "public"."join_requests" USING "btree" ("team_id");



CREATE INDEX "idx_leader_votes_round" ON "public"."leader_votes" USING "btree" ("team_id", "voting_round");



CREATE INDEX "idx_leader_votes_team" ON "public"."leader_votes" USING "btree" ("team_id");



CREATE INDEX "idx_notifications_profile" ON "public"."notifications" USING "btree" ("profile_id", "is_read");



CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("profile_id") WHERE ("is_read" = false);



CREATE INDEX "idx_notifications_urgent" ON "public"."notifications" USING "btree" ("profile_id") WHERE ((("priority")::"text" = 'urgent'::"text") AND ("is_read" = false));



CREATE INDEX "idx_post_comments_parent" ON "public"."post_comments" USING "btree" ("parent_comment_id");



CREATE INDEX "idx_post_comments_post" ON "public"."post_comments" USING "btree" ("post_id");



CREATE INDEX "idx_post_comments_session" ON "public"."post_comments" USING "btree" ("session_id");



CREATE INDEX "idx_post_likes_post" ON "public"."post_likes" USING "btree" ("post_id");



CREATE INDEX "idx_profiles_available" ON "public"."profiles" USING "btree" ("is_available") WHERE ("is_available" = true);



CREATE INDEX "idx_profiles_discord_id" ON "public"."profiles" USING "btree" ("discord_id");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_phone" ON "public"."profiles" USING "btree" ("phone");



CREATE INDEX "idx_profiles_proficiencies" ON "public"."profiles" USING "gin" ("proficiencies");



CREATE INDEX "idx_profiles_status" ON "public"."profiles" USING "btree" ("user_status") WHERE (("user_status")::"text" <> 'offline'::"text");



CREATE INDEX "idx_profiles_team" ON "public"."profiles" USING "btree" ("current_team_id");



CREATE INDEX "idx_team_members_active" ON "public"."team_members" USING "btree" ("status") WHERE (("status")::"text" = 'active'::"text");



CREATE INDEX "idx_team_members_profile" ON "public"."team_members" USING "btree" ("profile_id");



CREATE INDEX "idx_team_members_team" ON "public"."team_members" USING "btree" ("team_id");



CREATE INDEX "idx_team_posts_created" ON "public"."team_posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_team_posts_team" ON "public"."team_posts" USING "btree" ("team_id");



CREATE INDEX "idx_teams_leader" ON "public"."teams" USING "btree" ("leader_id");



CREATE INDEX "idx_teams_recruiting" ON "public"."teams" USING "btree" ("status") WHERE (("status")::"text" = 'recruiting'::"text");



CREATE INDEX "idx_teams_recruiting_roles" ON "public"."teams" USING "gin" ("looking_for_roles") WHERE (("status")::"text" = 'recruiting'::"text");



CREATE INDEX "idx_teams_status" ON "public"."teams" USING "btree" ("status");



CREATE INDEX "idx_teams_voting" ON "public"."teams" USING "btree" ("status") WHERE (("status")::"text" = 'voting'::"text");



CREATE INDEX "idx_voting_active" ON "public"."teams" USING "btree" ("voting_ends_at") WHERE (("status")::"text" = 'voting'::"text");



CREATE UNIQUE INDEX "unique_pending_request" ON "public"."join_requests" USING "btree" ("team_id", "profile_id") WHERE (("status")::"text" = 'pending'::"text");



CREATE OR REPLACE TRIGGER "maintain_comment_count" AFTER INSERT OR DELETE ON "public"."post_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_comment_count"();



CREATE OR REPLACE TRIGGER "update_leader_votes_updated_at" BEFORE UPDATE ON "public"."leader_votes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_team_members_updated_at" BEFORE UPDATE ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_teams_updated_at" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "fk_current_team" FOREIGN KEY ("current_team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."join_requests"
    ADD CONSTRAINT "join_requests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."join_requests"
    ADD CONSTRAINT "join_requests_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."join_requests"
    ADD CONSTRAINT "join_requests_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leader_votes"
    ADD CONSTRAINT "leader_votes_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leader_votes"
    ADD CONSTRAINT "leader_votes_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leader_votes"
    ADD CONSTRAINT "leader_votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leader_votes"
    ADD CONSTRAINT "leader_votes_voting_round_id_fkey" FOREIGN KEY ("voting_round_id") REFERENCES "public"."voting_rounds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_join_request_id_fkey" FOREIGN KEY ("join_request_id") REFERENCES "public"."join_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_related_profile_id_fkey" FOREIGN KEY ("related_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."post_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."team_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."team_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_posts"
    ADD CONSTRAINT "team_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_posts"
    ADD CONSTRAINT "team_posts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."voting_rounds"
    ADD CONSTRAINT "voting_rounds_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voting_rounds"
    ADD CONSTRAINT "voting_rounds_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."profiles"("id");



CREATE POLICY "Activities are public" ON "public"."activities" FOR SELECT USING (true);



CREATE POLICY "Anyone can comment" ON "public"."post_comments" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can create profile" ON "public"."profiles" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can create requests" ON "public"."join_requests" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can create teams" ON "public"."teams" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can like posts" ON "public"."post_likes" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can read comments" ON "public"."post_comments" FOR SELECT USING (true);



CREATE POLICY "Anyone can read likes" ON "public"."post_likes" FOR SELECT USING (true);



CREATE POLICY "Anyone can read posts" ON "public"."team_posts" FOR SELECT USING (true);



CREATE POLICY "Authors can update their posts" ON "public"."team_posts" FOR UPDATE USING (true);



CREATE POLICY "Leaders can disband teams" ON "public"."teams" FOR DELETE USING (("leader_id" = ("current_setting"('app.current_user_id'::"text", true))::"uuid"));



CREATE POLICY "Leaders manage teams" ON "public"."teams" FOR UPDATE USING (("leader_id" = ("current_setting"('app.current_user_id'::"text", true))::"uuid"));



CREATE POLICY "Leaders see team requests" ON "public"."join_requests" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."teams"
  WHERE (("teams"."id" = "join_requests"."team_id") AND ("teams"."leader_id" = ("current_setting"('app.current_user_id'::"text", true))::"uuid")))) OR ("profile_id" = ("current_setting"('app.current_user_id'::"text", true))::"uuid")));



CREATE POLICY "Members create votes" ON "public"."leader_votes" FOR INSERT WITH CHECK (true);



CREATE POLICY "Members update votes" ON "public"."leader_votes" FOR UPDATE USING (("voter_id" = ("current_setting"('app.current_user_id'::"text", true))::"uuid"));



CREATE POLICY "Profiles are viewable" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "System creates activities" ON "public"."activities" FOR INSERT WITH CHECK (true);



CREATE POLICY "System creates notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "System manages team members" ON "public"."team_members" FOR INSERT WITH CHECK (true);



CREATE POLICY "System updates team members" ON "public"."team_members" FOR UPDATE USING (true);



CREATE POLICY "Team members are viewable" ON "public"."team_members" FOR SELECT USING (true);



CREATE POLICY "Team members can create posts" ON "public"."team_posts" FOR INSERT WITH CHECK (true);



CREATE POLICY "Team members can view votes" ON "public"."leader_votes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "leader_votes"."team_id") AND ("team_members"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Team members can view voting rounds" ON "public"."voting_rounds" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "voting_rounds"."team_id") AND ("team_members"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Team members can vote" ON "public"."leader_votes" FOR SELECT USING (true);



CREATE POLICY "Teams are public" ON "public"."teams" FOR SELECT USING (true);



CREATE POLICY "Users see own notifications" ON "public"."notifications" FOR SELECT USING (("profile_id" = ("current_setting"('app.current_user_id'::"text", true))::"uuid"));



CREATE POLICY "Users update own notifications" ON "public"."notifications" FOR UPDATE USING (("profile_id" = ("current_setting"('app.current_user_id'::"text", true))::"uuid"));



CREATE POLICY "Users update own profile" ON "public"."profiles" FOR UPDATE USING (("id" = ("current_setting"('app.current_user_id'::"text", true))::"uuid"));



CREATE POLICY "Users withdraw own requests" ON "public"."join_requests" FOR UPDATE USING (("profile_id" = ("current_setting"('app.current_user_id'::"text", true))::"uuid"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."activities";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."join_requests";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."leader_votes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."post_comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."post_likes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."team_members";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."team_posts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."teams";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."authenticate_user"("p_identifier" character varying, "p_secret_code" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."authenticate_user"("p_identifier" character varying, "p_secret_code" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."authenticate_user"("p_identifier" character varying, "p_secret_code" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."cast_vote"("p_voter_id" "uuid", "p_team_id" "uuid", "p_candidate_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cast_vote"("p_voter_id" "uuid", "p_team_id" "uuid", "p_candidate_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cast_vote"("p_voter_id" "uuid", "p_team_id" "uuid", "p_candidate_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."change_secret_code"("p_profile_id" "uuid", "p_old_code" character varying, "p_new_code" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."change_secret_code"("p_profile_id" "uuid", "p_old_code" character varying, "p_new_code" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."change_secret_code"("p_profile_id" "uuid", "p_old_code" character varying, "p_new_code" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_voting_complete"("p_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_voting_complete"("p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_voting_complete"("p_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_profile"("p_name" character varying, "p_email" character varying, "p_phone" character varying, "p_secret_code" character varying, "p_proficiencies" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_profile"("p_name" character varying, "p_email" character varying, "p_phone" character varying, "p_secret_code" character varying, "p_proficiencies" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_profile"("p_name" character varying, "p_email" character varying, "p_phone" character varying, "p_secret_code" character varying, "p_proficiencies" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_team"("p_leader_id" "uuid", "p_name" character varying, "p_description" "text", "p_project_description" "text", "p_skills_needed" "text"[], "p_tech_stack" "text"[], "p_looking_for_roles" "text"[], "p_min_members" integer, "p_max_members" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_team"("p_leader_id" "uuid", "p_name" character varying, "p_description" "text", "p_project_description" "text", "p_skills_needed" "text"[], "p_tech_stack" "text"[], "p_looking_for_roles" "text"[], "p_min_members" integer, "p_max_members" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_team"("p_leader_id" "uuid", "p_name" character varying, "p_description" "text", "p_project_description" "text", "p_skills_needed" "text"[], "p_tech_stack" "text"[], "p_looking_for_roles" "text"[], "p_min_members" integer, "p_max_members" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_skill_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."debug_skill_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_skill_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_comment"("p_comment_id" "uuid", "p_session_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_comment"("p_comment_id" "uuid", "p_session_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_comment"("p_comment_id" "uuid", "p_session_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."edit_comment"("p_comment_id" "uuid", "p_session_id" "text", "p_new_content" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."edit_comment"("p_comment_id" "uuid", "p_session_id" "text", "p_new_content" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."edit_comment"("p_comment_id" "uuid", "p_session_id" "text", "p_new_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."finalize_voting"("p_round_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."finalize_voting"("p_round_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalize_voting"("p_round_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_users"("p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_users"("p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_users"("p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_hackathon_statistics"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_hackathon_statistics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_hackathon_statistics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_live_activity_feed"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_live_activity_feed"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_live_activity_feed"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_skill_distribution"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_skill_distribution"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_skill_distribution"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_skill_supply_demand"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_skill_supply_demand"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_skill_supply_demand"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_system_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_system_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_system_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."initiate_leader_vote"("p_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."initiate_leader_vote"("p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initiate_leader_vote"("p_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."initiate_leader_voting"("p_team_id" "uuid", "p_leaving_leader_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."initiate_leader_voting"("p_team_id" "uuid", "p_leaving_leader_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initiate_leader_voting"("p_team_id" "uuid", "p_leaving_leader_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_team"("p_profile_id" "uuid", "p_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."leave_team"("p_profile_id" "uuid", "p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_team"("p_profile_id" "uuid", "p_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."login_with_secret"("p_identifier" character varying, "p_secret_code" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."login_with_secret"("p_identifier" character varying, "p_secret_code" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."login_with_secret"("p_identifier" character varying, "p_secret_code" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."modify_team_membership"("p_user_id" "uuid", "p_team_id" "uuid", "p_action" character varying, "p_role" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."modify_team_membership"("p_user_id" "uuid", "p_team_id" "uuid", "p_action" character varying, "p_role" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."modify_team_membership"("p_user_id" "uuid", "p_team_id" "uuid", "p_action" character varying, "p_role" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."reply_to_comment"("p_parent_comment_id" "uuid", "p_post_id" "uuid", "p_content" "text", "p_author_name" "text", "p_session_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reply_to_comment"("p_parent_comment_id" "uuid", "p_post_id" "uuid", "p_content" "text", "p_author_name" "text", "p_session_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reply_to_comment"("p_parent_comment_id" "uuid", "p_post_id" "uuid", "p_content" "text", "p_author_name" "text", "p_session_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."request_to_join"("p_team_id" "uuid", "p_profile_id" "uuid", "p_requested_role" character varying, "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."request_to_join"("p_team_id" "uuid", "p_profile_id" "uuid", "p_requested_role" character varying, "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_to_join"("p_team_id" "uuid", "p_profile_id" "uuid", "p_requested_role" character varying, "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_user_password"("p_identifier" character varying, "p_new_password" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."reset_user_password"("p_identifier" character varying, "p_new_password" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_user_password"("p_identifier" character varying, "p_new_password" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."respond_to_request"("p_request_id" "uuid", "p_leader_id" "uuid", "p_accept" boolean, "p_response_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."respond_to_request"("p_request_id" "uuid", "p_leader_id" "uuid", "p_accept" boolean, "p_response_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."respond_to_request"("p_request_id" "uuid", "p_leader_id" "uuid", "p_accept" boolean, "p_response_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."share_team_contacts"("p_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."share_team_contacts"("p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."share_team_contacts"("p_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_post_like"("p_post_id" "uuid", "p_profile_id" "uuid", "p_session_id" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_post_like"("p_post_id" "uuid", "p_profile_id" "uuid", "p_session_id" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_post_like"("p_post_id" "uuid", "p_profile_id" "uuid", "p_session_id" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_comment_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_comment_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_comment_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_presence"("p_profile_id" "uuid", "p_team_id" "uuid", "p_status" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."update_presence"("p_profile_id" "uuid", "p_team_id" "uuid", "p_status" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_presence"("p_profile_id" "uuid", "p_team_id" "uuid", "p_status" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_profile_info"("p_profile_id" "uuid", "p_email" character varying, "p_phone" character varying, "p_secret_code" character varying, "p_proficiencies" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_info"("p_profile_id" "uuid", "p_email" character varying, "p_phone" character varying, "p_secret_code" character varying, "p_proficiencies" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_info"("p_profile_id" "uuid", "p_email" character varying, "p_phone" character varying, "p_secret_code" character varying, "p_proficiencies" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_secret_code"("p_profile_id" "uuid", "p_current_code" "text", "p_new_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_secret_code"("p_profile_id" "uuid", "p_current_code" "text", "p_new_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_secret_code"("p_profile_id" "uuid", "p_current_code" "text", "p_new_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_status"("p_profile_id" "uuid", "p_status" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_status"("p_profile_id" "uuid", "p_status" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_status"("p_profile_id" "uuid", "p_status" character varying) TO "service_role";


















GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."admin_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_logs" TO "service_role";



GRANT ALL ON TABLE "public"."join_requests" TO "anon";
GRANT ALL ON TABLE "public"."join_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."join_requests" TO "service_role";



GRANT ALL ON TABLE "public"."leader_votes" TO "anon";
GRANT ALL ON TABLE "public"."leader_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."leader_votes" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."post_comments" TO "anon";
GRANT ALL ON TABLE "public"."post_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."post_comments" TO "service_role";



GRANT ALL ON TABLE "public"."post_likes" TO "anon";
GRANT ALL ON TABLE "public"."post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."team_posts" TO "anon";
GRANT ALL ON TABLE "public"."team_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."team_posts" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."voting_rounds" TO "anon";
GRANT ALL ON TABLE "public"."voting_rounds" TO "authenticated";
GRANT ALL ON TABLE "public"."voting_rounds" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;
