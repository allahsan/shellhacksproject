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
BEGIN
    -- Get team info
    SELECT * INTO v_team FROM teams WHERE id = p_team_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Team not found'
        );
    END IF;

    -- Check if user is team leader
    IF v_team.leader_id = p_profile_id THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Leader cannot leave team. Transfer leadership or disband the team first.'
        );
    END IF;

    -- Check if user is actually in the team
    IF NOT EXISTS (
        SELECT 1 FROM team_members
        WHERE team_id = p_team_id
        AND profile_id = p_profile_id
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'You are not a member of this team'
        );
    END IF;

    -- DELETE the member record (not UPDATE)
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

    RETURN json_build_object('success', true);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.leave_team TO anon;
GRANT EXECUTE ON FUNCTION public.leave_team TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_team TO service_role;