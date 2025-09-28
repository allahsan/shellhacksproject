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