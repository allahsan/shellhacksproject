-- Fix live activity feed: Remove team posts and keep only user/team activities
CREATE OR REPLACE FUNCTION public.get_live_activity_feed(p_limit integer DEFAULT 15)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_live_activity_feed TO anon, authenticated;