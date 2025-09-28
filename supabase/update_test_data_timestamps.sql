-- Update existing test data with recent timestamps to make it appear in live activity feed

-- Update some profiles to have recent created_at times (member signups)
UPDATE public.profiles
SET created_at = NOW() - INTERVAL '2 minutes'
WHERE id IN (SELECT id FROM public.profiles ORDER BY created_at DESC LIMIT 1);

UPDATE public.profiles
SET created_at = NOW() - INTERVAL '8 minutes'
WHERE id IN (SELECT id FROM public.profiles ORDER BY created_at DESC LIMIT 1 OFFSET 1);

UPDATE public.profiles
SET created_at = NOW() - INTERVAL '25 minutes'
WHERE id IN (SELECT id FROM public.profiles ORDER BY created_at DESC LIMIT 1 OFFSET 2);

-- Update team creation times
UPDATE public.teams
SET created_at = NOW() - INTERVAL '5 minutes'
WHERE id IN (SELECT id FROM public.teams WHERE status = 'recruiting' ORDER BY created_at DESC LIMIT 1);

UPDATE public.teams
SET created_at = NOW() - INTERVAL '15 minutes'
WHERE id IN (SELECT id FROM public.teams WHERE status = 'recruiting' ORDER BY created_at DESC LIMIT 1 OFFSET 1);

-- Update team member join times
UPDATE public.team_members
SET joined_at = NOW() - INTERVAL '3 minutes'
WHERE id IN (
    SELECT id FROM public.team_members
    WHERE status = 'active' AND joined_at IS NOT NULL
    ORDER BY joined_at DESC LIMIT 1
);

UPDATE public.team_members
SET joined_at = NOW() - INTERVAL '12 minutes'
WHERE id IN (
    SELECT id FROM public.team_members
    WHERE status = 'active' AND joined_at IS NOT NULL
    ORDER BY joined_at DESC LIMIT 1 OFFSET 1
);

-- Update some team members to have left recently (using updated_at since left_at doesn't exist)
UPDATE public.team_members
SET
    status = 'inactive',
    updated_at = NOW() - INTERVAL '7 minutes'
WHERE id IN (
    SELECT id FROM public.team_members
    WHERE status = 'active'
    ORDER BY joined_at DESC LIMIT 1 OFFSET 2
);

-- Update a team to be full (locked) recently
UPDATE public.teams
SET
    status = 'full',
    updated_at = NOW() - INTERVAL '10 minutes'
WHERE id IN (
    SELECT id FROM public.teams
    WHERE status = 'recruiting'
    AND (SELECT COUNT(*) FROM public.team_members tm WHERE tm.team_id = teams.id AND tm.status = 'active') >= 2
    ORDER BY created_at DESC LIMIT 1
);