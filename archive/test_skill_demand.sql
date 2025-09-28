-- Test query to see what roles teams are looking for
SELECT
    t.name as team_name,
    t.looking_for_roles,
    t.status
FROM public.teams t
WHERE t.looking_for_roles IS NOT NULL
AND jsonb_array_length(t.looking_for_roles) > 0
ORDER BY t.created_at DESC;

-- Check individual roles being demanded
SELECT
    jsonb_array_elements_text(looking_for_roles) as role,
    COUNT(*) as demand_count
FROM public.teams
WHERE looking_for_roles IS NOT NULL
AND status IN ('recruiting', 'forming')
GROUP BY role
ORDER BY demand_count DESC;

-- Check what skills people have
SELECT
    jsonb_array_elements_text(proficiencies) as skill,
    COUNT(*) as supply_count
FROM public.profiles
WHERE proficiencies IS NOT NULL
GROUP BY skill
ORDER BY supply_count DESC;