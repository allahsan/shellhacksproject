# Database Cleanup Analysis

## Tables Analysis

### CURRENTLY USED Tables:
1. **profiles** - User profiles (actively used)
2. **teams** - Team information (actively used)
3. **team_members** - Team membership (actively used)
4. **team_posts** - Posts in team feeds (actively used)
5. **post_comments** - Comments on posts (actively used)
6. **post_likes** - Likes on posts (actively used)
7. **join_requests** - Team join requests (used in TeamDashboard)

### POTENTIALLY UNUSED Tables:
1. **activities** - Only used in ActivityFeed.tsx component (which might be deprecated)
2. **notifications** - NOT FOUND in codebase
3. **leader_votes** - Only used in VotingModal.tsx (voting feature might not be active)

## Functions Analysis

### ACTIVELY USED Functions:
1. **create_profile** - User registration
2. **login_with_secret** - User login
3. **create_team** - Team creation
4. **request_to_join** - Join team requests
5. **respond_to_request** - Handle join requests
6. **toggle_post_like** - Like/unlike posts
7. **delete_comment** - Delete comments
8. **edit_comment** - Edit comments
9. **reply_to_comment** - Reply to comments
10. **get_hackathon_statistics** - Statistics page
11. **get_live_activity_feed** - Live activity feed
12. **get_skill_supply_demand** - Skill market board

### POTENTIALLY UNUSED Functions:
1. **cast_vote** - Leader voting system (not actively used)
2. **check_voting_complete** - Leader voting system
3. **finalize_voting** - Leader voting system
4. **initiate_leader_voting** - Leader voting system
5. **leave_team** - Team leaving functionality (might not be implemented in UI)
6. **share_team_contacts** - Contact sharing (not found in UI)
7. **update_user_status** - Status updates (not found in UI)
8. **update_secret_code** - Password change (not implemented in UI)
9. **debug_skill_data** - Debug function (can be removed in production)
10. **get_skill_distribution** - Might be replaced by get_skill_supply_demand

## Recommended Cleanup Actions

### Tables to REMOVE:
1. **notifications** - Not used anywhere
2. **activities** - Replaced by live activity feed function

### Tables to CONSIDER REMOVING (if features not needed):
1. **leader_votes** - If voting feature not needed

### Functions to REMOVE:
1. **debug_skill_data** - Debug function
2. **share_team_contacts** - Not implemented
3. **update_user_status** - Not implemented
4. **get_skill_distribution** - Redundant with get_skill_supply_demand

### Functions to CONSIDER REMOVING (if features not needed):
1. **cast_vote**
2. **check_voting_complete**
3. **finalize_voting**
4. **initiate_leader_voting**
5. **leave_team** (unless you plan to implement team leaving)
6. **update_secret_code** (unless you plan to add password change)

## SQL Script to Clean Database

```sql
-- Drop unused tables
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;

-- Drop unused functions
DROP FUNCTION IF EXISTS public.debug_skill_data();
DROP FUNCTION IF EXISTS public.share_team_contacts(uuid);
DROP FUNCTION IF EXISTS public.update_user_status(uuid, varchar);
DROP FUNCTION IF EXISTS public.get_skill_distribution();

-- Optional: Drop voting-related items if not needed
-- DROP TABLE IF EXISTS public.leader_votes CASCADE;
-- DROP FUNCTION IF EXISTS public.cast_vote(uuid, uuid, uuid);
-- DROP FUNCTION IF EXISTS public.check_voting_complete(uuid);
-- DROP FUNCTION IF EXISTS public.finalize_voting(uuid);
-- DROP FUNCTION IF EXISTS public.initiate_leader_voting(uuid, uuid);

-- Optional: Drop if team leaving not needed
-- DROP FUNCTION IF EXISTS public.leave_team(uuid, uuid);

-- Optional: Drop if password change not needed
-- DROP FUNCTION IF EXISTS public.update_secret_code(uuid, text, text);
```

## Impact Assessment

### Safe to Remove (No Impact):
- notifications table
- activities table
- debug_skill_data function
- share_team_contacts function
- update_user_status function
- get_skill_distribution function

### Requires Feature Decision:
- Voting system (leader_votes table and related functions)
- Team leaving functionality
- Password change functionality

## Next Steps

1. Run the cleanup SQL script in Supabase
2. Remove unused components:
   - ActivityFeed.tsx (if not needed)
   - VotingModal.tsx (if voting not needed)
3. Update any remaining references in code