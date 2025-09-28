-- Fix team status counts based on correct business logic
-- Teams Locked = only 'full' status
-- Active Teams = 'recruiting', 'full', or 'closed' (exclude 'voting' and 'disbanded')
-- Voting is internal-only status when leader leaves

CREATE OR REPLACE FUNCTION public.get_hackathon_statistics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
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
        'teams_recruiting', teams_recruiting,
        'teams_locked', teams_locked,
        'top_skills', COALESCE(top_skills, '[]'::json),
        'recent_activities', COALESCE(recent_activities, '[]'::json)
    ) INTO v_stats
    FROM stats;

    RETURN v_stats;
END;
$$;

-- Also fix the live activity feed function to show both 'full' and 'closed' as locked events
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

        -- 3. Members leaving teams
        SELECT
            'member_left' as activity_type,
            tm.left_at as created_at,
            json_build_object(
                'icon', '👋',
                'message', p.name || ' left team ' || t.name,
                'time_ago',
                CASE
                    WHEN tm.left_at > NOW() - INTERVAL '1 minute' THEN 'just now'
                    WHEN tm.left_at > NOW() - INTERVAL '1 hour' THEN
                        EXTRACT(MINUTE FROM NOW() - tm.left_at)::text || 'm ago'
                    WHEN tm.left_at > NOW() - INTERVAL '24 hours' THEN
                        EXTRACT(HOUR FROM NOW() - tm.left_at)::text || 'h ago'
                    ELSE EXTRACT(DAY FROM NOW() - tm.left_at)::text || 'd ago'
                END,
                'member_name', p.name,
                'team_name', t.name
            ) as data
        FROM public.team_members tm
        JOIN public.profiles p ON p.id = tm.profile_id
        JOIN public.teams t ON t.id = tm.team_id
        WHERE tm.status = 'inactive' AND tm.left_at IS NOT NULL

        UNION ALL

        -- 4. Team posts
        SELECT
            'team_post' as activity_type,
            tp.created_at,
            json_build_object(
                'icon', '📢',
                'message', t.name || ' posted an update',
                'time_ago',
                CASE
                    WHEN tp.created_at > NOW() - INTERVAL '1 minute' THEN 'just now'
                    WHEN tp.created_at > NOW() - INTERVAL '1 hour' THEN
                        EXTRACT(MINUTE FROM NOW() - tp.created_at)::text || 'm ago'
                    WHEN tp.created_at > NOW() - INTERVAL '24 hours' THEN
                        EXTRACT(HOUR FROM NOW() - tp.created_at)::text || 'h ago'
                    ELSE EXTRACT(DAY FROM NOW() - tp.created_at)::text || 'd ago'
                END,
                'team_name', t.name,
                'content_preview', LEFT(tp.content, 100),
                'author_name', p.name
            ) as data
        FROM public.team_posts tp
        JOIN public.teams t ON t.id = tp.team_id
        LEFT JOIN public.profiles p ON p.id = tp.author_id

        UNION ALL

        -- 5. New teams created
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

        -- 6. Team status changes to full or closed (both count as "locked")
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
GRANT EXECUTE ON FUNCTION public.get_hackathon_statistics TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_activity_feed TO anon, authenticated;