# TeamDock - Complete Implementation TODO List
## 🎯 Project: Real-time Hackathon Team Formation Platform

---

## ✅ COMPLETED TASKS

### Backend Infrastructure
- [x] Database schema created (7 tables)
- [x] All 11 database functions implemented
- [x] RLS policies configured
- [x] Realtime subscriptions enabled
- [x] Supabase project connected
- [x] GitHub repository setup
- [x] Test connection scripts created

---

## 📋 REMAINING TASKS

### 🏗️ PHASE 0: Project Setup (30 mins)

#### Next.js & Dependencies Setup
- [ ] Initialize Next.js 14 with TypeScript
  - [ ] Run `npx create-next-app@latest teamdock-frontend --typescript --tailwind --app`
  - [ ] Configure TypeScript strict mode
  - [ ] Setup path aliases (@/components, @/lib, etc.)

#### Install Core Dependencies
- [ ] Supabase client: `@supabase/supabase-js` `@supabase/ssr`
- [ ] UI Components: `shadcn/ui` setup
- [ ] Animation: `framer-motion`
- [ ] Notifications: `react-hot-toast` `sonner`
- [ ] Sound: `howler`
- [ ] Forms: `react-hook-form` `zod`
- [ ] Data fetching: `@tanstack/react-query`
- [ ] QR Code: `qrcode` `react-qr-code`
- [ ] Icons: `lucide-react`
- [ ] Date handling: `date-fns`

#### Environment Configuration
- [ ] Create `.env.local` with Supabase credentials
- [ ] Setup Supabase client files (client.ts, server.ts)
- [ ] Configure middleware for auth (later phase)

#### Folder Structure Setup
- [ ] Create folder structure as per plan:
  ```
  app/
    ├── (auth)/
    │   └── login/
    ├── (main)/
    │   ├── profile/
    │   ├── teams/
    │   └── dashboard/
    └── api/
  components/
    ├── landing/
    ├── auth/
    ├── teams/
    ├── requests/
    ├── voting/
    ├── notifications/
    └── ui/
  lib/
    ├── supabase/
    ├── hooks/
    └── utils/
  ```

---

### 🎨 PHASE 1: Core UI Components (2 hours)

#### Landing Page Components
- [ ] Create main landing page layout
- [ ] PathSelector component with 3 options:
  - [ ] "Start a New Team" card
  - [ ] "Join a Team" card
  - [ ] "Manage My Team" card
- [ ] Live stats display component
- [ ] Animated hero section
- [ ] Responsive mobile layout

#### Authentication Components
- [ ] SecretCodeLogin component
  - [ ] Email/phone input field
  - [ ] Secret code input (6-12 digits)
  - [ ] Validation logic
  - [ ] Error handling
- [ ] ProfileCreationForm component
  - [ ] Name input
  - [ ] Email input (optional if phone provided)
  - [ ] Phone input (optional if email provided)
  - [ ] Skills multi-select (Frontend, Backend, Integration, Pitch, Other)
  - [ ] Additional contacts (Discord, Slack, GitHub, Telegram, WhatsApp)
  - [ ] Secret code creation with confirmation
  - [ ] Form validation with Zod

#### Shared UI Components
- [ ] Button variants (primary, secondary, ghost, danger)
- [ ] Card component with hover effects
- [ ] Badge components for skills/status
- [ ] Modal/Dialog component
- [ ] Loading skeletons
- [ ] Error boundary components
- [ ] Toast notification setup

---

### 👥 PHASE 2: Profile & Auth System (1.5 hours)

#### Profile Creation Flow
- [ ] Create profile page (`/profile/create`)
- [ ] Implement `create_profile` function call
- [ ] Hash secret code before storing
- [ ] Handle duplicate email/phone errors
- [ ] Success redirect logic

#### Login System
- [ ] Login page (`/auth/login`)
- [ ] Implement `login_with_secret` function
- [ ] Session management (localStorage/cookies)
- [ ] Auth context provider
- [ ] Protected route wrapper
- [ ] Logout functionality

#### Profile Management
- [ ] Profile view page
- [ ] Edit profile functionality
- [ ] Update user status (Available/Busy/Break/Offline)
- [ ] Contact information management
- [ ] Skills update

---

### 🚀 PHASE 3: Team Creation (Leader Flow) (2 hours)

#### Create Team Page
- [ ] Team creation form (`/teams/create`)
  - [ ] Team name input (unique validation)
  - [ ] Project description textarea (max 500 chars)
  - [ ] Looking for roles (multi-select)
  - [ ] Tech stack tags
  - [ ] Max members setting (2-10)
  - [ ] Auto-accept requests toggle

#### Role Management
- [ ] RoleBuilder component
  - [ ] Preset roles selection
  - [ ] Custom role input
  - [ ] Role badges with emojis
- [ ] Role slot display
- [ ] Available roles counter

#### Team Creation Logic
- [ ] Call `create_team` function
- [ ] Add leader as first member
- [ ] Update profile to leader type
- [ ] Redirect to team dashboard
- [ ] Error handling for duplicate names

#### Leader Dashboard
- [ ] Team management page (`/teams/[id]/manage`)
- [ ] Display team info (editable)
- [ ] Current members list
  - [ ] Member cards with contact info
  - [ ] Remove member button
  - [ ] Status indicators
- [ ] Open roles section
- [ ] Team status toggle (recruiting/closed)
- [ ] Share team link/QR code generator
- [ ] Disband team option

---

### 🔍 PHASE 4: Browse & Join Teams (Member Flow) (2 hours)

#### Teams Browse Page
- [ ] Teams list page (`/teams`)
- [ ] TeamCard component
  - [ ] Team name & description
  - [ ] Open roles display
  - [ ] Member count
  - [ ] Tech stack tags
  - [ ] Status indicator (recruiting/full/closed)
  - [ ] Visual glow for recruiting teams

#### Filtering & Search
- [ ] Filter by role needed
- [ ] Filter by team status
- [ ] Search by team name/description
- [ ] Sort options (newest, most open roles, etc.)
- [ ] Pagination or infinite scroll

#### Join Request Flow
- [ ] Join request modal
  - [ ] Select role dropdown
  - [ ] Optional message to leader
  - [ ] Contact info confirmation
- [ ] Request submission (`request_to_join` function)
- [ ] Success confirmation with confetti
- [ ] Pending request indicator

#### Member Dashboard
- [ ] Team member view (`/dashboard`)
- [ ] View team info (read-only)
- [ ] See other members & contacts
- [ ] Update own status
- [ ] Leave team button
- [ ] View pending requests (read-only)

---

### 📨 PHASE 5: Request Management System (1.5 hours)

#### Request Display for Leaders
- [ ] Pending requests section in dashboard
- [ ] RequestCard component
  - [ ] Requester name
  - [ ] Requested role
  - [ ] Skills display
  - [ ] Message from requester
  - [ ] Accept/Reject buttons

#### Accept/Reject Flow
- [ ] Accept modal with warning
  - [ ] "Contact info will be shared" warning
  - [ ] Confirmation button
- [ ] Call `respond_to_request` function
- [ ] Update UI optimistically
- [ ] Send notifications

#### Request Tracking
- [ ] My requests page for members
- [ ] Request status display
- [ ] Withdraw request option
- [ ] Request history

---

### 🔔 PHASE 6: Notification System (2 hours)

#### Sound Integration
- [ ] Setup Howler.js
- [ ] Load sound files:
  - [ ] notification.mp3 (general)
  - [ ] join.mp3 (member joined)
  - [ ] alert.mp3 (urgent)
  - [ ] success.mp3 (action complete)
- [ ] Sound manager class
- [ ] Volume controls
- [ ] Mute option

#### Vibration API
- [ ] Implement vibration patterns
- [ ] Different patterns for different events:
  - [ ] Join request: [200, 100, 200]
  - [ ] Urgent: [500, 250, 500]
  - [ ] Success: [100, 50, 100]
- [ ] Check browser support
- [ ] Fallback for non-support

#### Toast Notifications
- [ ] Setup react-hot-toast
- [ ] Custom toast components
- [ ] Priority-based styling
- [ ] Auto-dismiss timings
- [ ] Click actions

#### Realtime Notifications
- [ ] Subscribe to notifications table
- [ ] Filter by current user
- [ ] Display unread count badge
- [ ] Mark as read functionality
- [ ] Notification center/dropdown

#### Browser Notifications
- [ ] Request permission
- [ ] Send browser notifications
- [ ] Click to focus window
- [ ] Offline queue

#### WhatsApp Integration
- [ ] WhatsApp deep links for notifications
- [ ] Format: `wa.me/?text=TeamDock:%20Message`
- [ ] Team invite links via WhatsApp
- [ ] Contact sharing through WhatsApp

---

### 🗳️ PHASE 7: Voting System (1.5 hours)

#### Voting Trigger
- [ ] Detect when leader leaves
- [ ] Call `initiate_leader_voting`
- [ ] Handle auto-promotion (1 member)
- [ ] Handle disbanding (0 members)

#### Voting Modal
- [ ] 5-minute countdown timer
- [ ] List of eligible candidates
- [ ] Radio button selection
- [ ] Current vote display
- [ ] Change vote option
- [ ] Submit vote button

#### Vote Processing
- [ ] Call `cast_vote` function
- [ ] Update vote count display
- [ ] Check if all voted
- [ ] Handle voting completion

#### Results Display
- [ ] Show winner announcement
- [ ] Display if tie occurred
- [ ] Update team leader badge
- [ ] Send notifications to all

---

### 🔄 PHASE 8: Realtime Features (2 hours)

#### Supabase Realtime Setup
- [ ] Create realtime client
- [ ] Setup channel subscriptions
- [ ] Handle connection states
- [ ] Implement reconnection logic

#### Team Updates
- [ ] Subscribe to teams table
- [ ] Update team cards on change
- [ ] Show recruiting status changes
- [ ] Member count updates

#### Join Request Updates
- [ ] Subscribe to join_requests
- [ ] Show new requests instantly
- [ ] Update request status
- [ ] Remove accepted/rejected

#### Member Status Updates
- [ ] Subscribe to team_members
- [ ] Update status indicators
- [ ] Show online/offline changes
- [ ] Member join/leave events

#### Notifications Stream
- [ ] Subscribe to notifications
- [ ] Show new notification badge
- [ ] Play sound on new notification
- [ ] Trigger vibration

#### Activity Feed
- [ ] Recent activity component
- [ ] Subscribe to activities table
- [ ] Show team formations
- [ ] Display role fills
- [ ] Format activity messages

---

### ✨ PHASE 9: Polish & UX (2 hours)

#### Animations
- [ ] Page transitions with Framer Motion
- [ ] Card hover effects
- [ ] Button click animations
- [ ] Loading state animations
- [ ] Skeleton loaders
- [ ] Confetti on join success
- [ ] Glowing borders for recruiting teams

#### Empty States
- [ ] No teams yet design
- [ ] No requests design
- [ ] No members design
- [ ] Search no results

#### Error Handling
- [ ] Error boundaries
- [ ] User-friendly error messages
- [ ] Retry mechanisms
- [ ] Offline detection
- [ ] Network error handling

#### Loading States
- [ ] Page-level loading
- [ ] Component loading states
- [ ] Optimistic updates
- [ ] Suspense boundaries

#### Mobile Optimization
- [ ] Responsive layouts
- [ ] Touch-friendly buttons
- [ ] Swipe gestures
- [ ] Mobile navigation menu
- [ ] PWA configuration

---

### 📊 PHASE 10: Metrics & Admin (1 hour)

#### Organizer Dashboard
- [ ] Stats overview page (`/admin/metrics`)
- [ ] Total teams counter
- [ ] Total members counter
- [ ] Open roles counter
- [ ] Role distribution chart
- [ ] Member status pie chart

#### Activity Monitoring
- [ ] Live activity feed
- [ ] Team creation rate
- [ ] Join rate graph
- [ ] Popular roles tracking

#### Export Features
- [ ] CSV export for teams
- [ ] Member list export
- [ ] Contact sheet generation

#### Big Screen Mode
- [ ] Auto-scrolling teams display
- [ ] Large format for projectors
- [ ] QR code for quick access

---

### 🚀 PHASE 11: Deployment (1 hour)

#### Build Optimization
- [ ] Production build test
- [ ] Bundle size analysis
- [ ] Image optimization
- [ ] Code splitting
- [ ] Tree shaking verification

#### Vercel Deployment
- [ ] Connect GitHub repo
- [ ] Configure environment variables
- [ ] Setup domain (if available)
- [ ] Configure caching headers
- [ ] Setup preview deployments

#### Testing Production
- [ ] Test all user flows
- [ ] Verify realtime works
- [ ] Check mobile experience
- [ ] Test notifications
- [ ] Load testing (optional)

#### Documentation
- [ ] Create README.md with setup instructions
- [ ] Document API endpoints
- [ ] Add contributing guidelines
- [ ] Create demo video/GIF

---

### 🎮 PHASE 12: Gamification (Stretch Goals)

#### Visual Effects
- [ ] Confetti variations
- [ ] Achievement badges
- [ ] Team formation counter
- [ ] Streak tracking

#### Easter Eggs
- [ ] Funny team name responses
- [ ] Special animations
- [ ] Hidden features
- [ ] Milestone celebrations

#### Leaderboards
- [ ] Most active teams
- [ ] Fastest team formation
- [ ] Most diverse team

---

### 🔒 PHASE 13: Security & Performance (Post-MVP)

#### Security Enhancements
- [ ] Rate limiting implementation
- [ ] Input sanitization
- [ ] XSS prevention
- [ ] CORS configuration
- [ ] Environment variable validation

#### Performance Optimization
- [ ] Database query optimization
- [ ] Caching strategy
- [ ] CDN setup
- [ ] Service worker
- [ ] Lazy loading

---

## 📝 CRITICAL PATH CHECKLIST

### Must-Have for Demo (MVP)
1. [ ] Landing page with 3 paths
2. [ ] Profile creation with secret code
3. [ ] Login system
4. [ ] Create team (leader)
5. [ ] Browse teams
6. [ ] Request to join
7. [ ] Accept/reject requests
8. [ ] Basic realtime updates
9. [ ] Contact sharing after accept
10. [ ] Leave team functionality

### Should-Have for Polish
1. [ ] Sound notifications
2. [ ] Vibration alerts
3. [ ] Voting system
4. [ ] Status updates
5. [ ] Animations
6. [ ] Mobile responsive
7. [ ] Activity feed
8. [ ] Team sharing (link/QR)

### Nice-to-Have (Stretch)
1. [ ] Organizer dashboard
2. [ ] Export features
3. [ ] Big screen mode
4. [ ] Gamification
5. [ ] PWA features
6. [ ] Advanced analytics

---

## ⚠️ CRITICAL REQUIREMENTS FROM PMO

### Must Implement (Non-Negotiable)
- [ ] **3 Landing Page Paths**: "Start Team", "Join Team", "Manage Team"
- [ ] **Secret Code Auth**: 6-12 digits (NOT a password)
- [ ] **Join Request System**: NOT instant join - requires approval
- [ ] **Contact Sharing**: ONLY after request accepted (with warning)
- [ ] **Leader Powers**: Full team management (accept/reject/remove)
- [ ] **Member Self-Remove**: Any member can leave
- [ ] **Voting System**: 5-min window, re-voting allowed, random tie-breaker
- [ ] **User Status**: Available/Busy/Break/Offline
- [ ] **Sound Notifications**: On urgent events
- [ ] **Vibration Alerts**: For mobile devices
- [ ] **Proficiency Options**: Frontend/Backend/Integration/Pitch/Other
- [ ] **Multiple Same Roles**: Teams can have multiple Frontend Devs, etc.
- [ ] **Team Members See Requests**: But only leader can act

### Data Validation Rules
- [ ] Email OR Phone required (not both)
- [ ] Team names must be unique
- [ ] Secret code 6-12 digits only
- [ ] Team size 2-10 members
- [ ] Description max 500 characters
- [ ] Only one pending request per person per team

### Realtime Requirements
- [ ] Team list updates instantly
- [ ] Join requests appear immediately to leader
- [ ] Member status changes broadcast to team
- [ ] Voting updates live for all members
- [ ] Activity feed shows recent events

---

## 🐛 TESTING CHECKLIST

### User Flows to Test
- [ ] Complete profile creation flow
- [ ] Login with secret code
- [ ] Create team as leader
- [ ] Browse and filter teams
- [ ] Send join request
- [ ] Accept request (verify contacts shared)
- [ ] Reject request
- [ ] Leave team as member
- [ ] Leader leaves (voting trigger)
- [ ] Vote for new leader
- [ ] Update member status
- [ ] Withdraw pending request

### Edge Cases to Test
- [ ] Duplicate team names
- [ ] Duplicate join requests
- [ ] Simultaneous role claims
- [ ] Voting with tie
- [ ] Single member promotion
- [ ] Team disbanding
- [ ] Network disconnection
- [ ] Invalid secret codes
- [ ] Missing email/phone

### Cross-Browser Testing
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers

### Device Testing
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

---

## 🎯 SUCCESS CRITERIA

### Technical Metrics
- [ ] Page load < 2 seconds
- [ ] Realtime latency < 100ms
- [ ] Sound playback < 50ms delay
- [ ] 0 critical bugs
- [ ] 99%+ uptime during demo

### User Experience Metrics
- [ ] Team creation < 1 minute
- [ ] Join team < 30 seconds
- [ ] Find team < 2 minutes
- [ ] All core features working

### Demo Requirements
- [ ] 5+ test teams created
- [ ] 20+ test profiles
- [ ] Realtime updates visible
- [ ] Notifications working
- [ ] Mobile responsive

---

## 📅 TIME ESTIMATES

### Day 1 (8-10 hours)
- Phase 0: Setup (30 mins)
- Phase 1: Core UI (2 hours)
- Phase 2: Auth (1.5 hours)
- Phase 3: Team Creation (2 hours)
- Phase 4: Browse & Join (2 hours)
- Phase 5: Requests (1.5 hours)

### Day 2 (6-8 hours)
- Phase 6: Notifications (2 hours)
- Phase 7: Voting (1.5 hours)
- Phase 8: Realtime (2 hours)
- Phase 9: Polish (2 hours)
- Phase 10: Metrics (1 hour)
- Phase 11: Deploy (1 hour)

---

## 🔄 PROGRESS TRACKING

Use this section to track daily progress:

### Day 1 Progress
- [ ] Morning: Setup + Core UI
- [ ] Afternoon: Auth + Team Creation
- [ ] Evening: Browse + Join + Requests

### Day 2 Progress
- [ ] Morning: Notifications + Voting
- [ ] Afternoon: Realtime + Polish
- [ ] Evening: Deploy + Demo prep

---

## 📌 NOTES & BLOCKERS

### Current Blockers
- None

### Decisions Made
- Using Supabase for backend ✅
- Secret code auth instead of OAuth ✅
- WhatsApp deep links over SMS ✅

### Resources Needed
- Sound files (mp3/ogg)
- Logo/branding assets
- Demo data script

---

## 🎉 DEMO PREPARATION

### Demo Script Points
1. [ ] Show landing page
2. [ ] Create leader profile
3. [ ] Create a team
4. [ ] Switch browser, create member profile
5. [ ] Browse teams
6. [ ] Send join request
7. [ ] Show notification (sound + vibration)
8. [ ] Accept request
9. [ ] Show contact sharing
10. [ ] Update status
11. [ ] Show realtime updates
12. [ ] Leader leaves, trigger voting
13. [ ] Complete voting
14. [ ] Show metrics dashboard

### Demo Data Setup
- [ ] Create 5 sample teams
- [ ] Create 20 sample profiles
- [ ] Some pending requests
- [ ] Various team statuses
- [ ] Different member counts

---

**Last Updated**: [Current Date]
**Total Tasks**: 200+
**Completed**: 8
**Remaining**: 192+
**Completion**: 4%