-- Drop the old version of create_team function with the exact signature
DROP FUNCTION IF EXISTS public.create_team(uuid, character varying, text, text, text[], text[], text[], integer, integer);

-- Create or replace the create_team function with correct signature and return type
CREATE OR REPLACE FUNCTION public.create_team(
    p_leader_id UUID,
    p_name character varying,
    p_description TEXT,
    p_project_description TEXT DEFAULT NULL,  -- Keep for compatibility but ignore
    p_skills_needed TEXT[] DEFAULT NULL,      -- Keep for compatibility but ignore
    p_tech_stack TEXT[] DEFAULT NULL,
    p_looking_for_roles TEXT[] DEFAULT NULL,
    p_min_members integer DEFAULT 2,
    p_max_members integer DEFAULT 8
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_team TO anon;
GRANT EXECUTE ON FUNCTION public.create_team TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_team TO service_role;