-- Allow Solo Hackers to post (team_id can be NULL)
ALTER TABLE public.team_posts
ALTER COLUMN team_id DROP NOT NULL;

-- Update the constraint to allow NULL team_id
ALTER TABLE public.team_posts
DROP CONSTRAINT IF EXISTS team_posts_team_id_fkey;

ALTER TABLE public.team_posts
ADD CONSTRAINT team_posts_team_id_fkey
FOREIGN KEY (team_id)
REFERENCES public.teams(id)
ON DELETE CASCADE;

-- Add a comment to clarify
COMMENT ON COLUMN public.team_posts.team_id IS 'Team ID - NULL for Solo Hacker posts';