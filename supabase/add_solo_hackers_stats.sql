-- Add Solo Hackers count to statistics
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_hackathon_statistics TO anon, authenticated;