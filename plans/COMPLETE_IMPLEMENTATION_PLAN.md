# TeamDock Complete Implementation Plan

## 🎯 Project Overview
**TeamDock** - Real-time hackathon team formation platform with three user paths:
1. **Start a New Team** - For project leaders
2. **Join a Team** - For those looking for projects
3. **Manage My Team** - For returning members/leaders

## 🛠️ Tech Stack Finalized
```javascript
Frontend:
├── Next.js 14 (App Router)
├── TypeScript
├── TailwindCSS + shadcn/ui
├── Framer Motion (animations)
├── Howler.js (sound effects)
└── React Hot Toast (notifications)

Backend:
├── Supabase (PostgreSQL + Realtime)
├── Row Level Security (RLS)
├── Database Functions (RPCs)
└── Realtime Subscriptions

Deployment:
├── Vercel (frontend)
├── Supabase Cloud (backend)
└── GitHub (version control)
```

## 📁 Project Structure
```
teamdock/
├── app/
│   ├── layout.tsx
│   ├── page.tsx (landing with 3 paths)
│   ├── auth/
│   │   └── login/
│   │       └── page.tsx (secret code login)
│   ├── profile/
│   │   ├── create/
│   │   │   └── page.tsx (profile creation)
│   │   └── edit/
│   │       └── page.tsx
│   ├── teams/
│   │   ├── page.tsx (browse teams)
│   │   ├── create/
│   │   │   └── page.tsx (create team)
│   │   └── [id]/
│   │       ├── page.tsx (team details)
│   │       └── manage/
│   │           └── page.tsx (leader dashboard)
│   ├── dashboard/
│   │   └── page.tsx (team dashboard)
│   └── api/
│       ├── auth/
│       ├── teams/
│       ├── requests/
│       └── votes/
├── components/
│   ├── landing/
│   │   ├── PathSelector.tsx (3 options)
│   │   └── LiveStats.tsx
│   ├── auth/
│   │   ├── SecretCodeLogin.tsx
│   │   └── ProfileForm.tsx
│   ├── teams/
│   │   ├── TeamCard.tsx
│   │   ├── TeamList.tsx
│   │   ├── CreateTeamForm.tsx
│   │   └── TeamFilters.tsx
│   ├── requests/
│   │   ├── JoinRequestModal.tsx
│   │   ├── RequestCard.tsx
│   │   └── RequestManager.tsx
│   ├── voting/
│   │   ├── VotingModal.tsx
│   │   └── VotingResults.tsx
│   ├── notifications/
│   │   ├── NotificationToast.tsx
│   │   └── SoundManager.tsx
│   └── ui/ (shadcn components)
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── types.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useRealtime.ts
│   │   ├── useNotifications.ts
│   │   └── useSound.ts
│   └── utils/
│       ├── notifications.ts
│       └── voting.ts
├── public/
│   └── sounds/
│       ├── notification.mp3
│       ├── join.mp3
│       ├── alert.mp3
│       └── success.mp3
└── types/
    └── index.ts
```

## 🗓️ Implementation Timeline (2 Days)

### Day 1: Core Features (8 hours)

#### Phase 1: Setup & Database (1.5 hours)
**9:00 AM - 10:30 AM**
- [ ] Initialize Next.js project with TypeScript
- [ ] Setup Supabase project
- [ ] Create all database tables from DATABASE_DESIGN_V2.md
- [ ] Setup RLS policies
- [ ] Create database functions (claim_role, voting, etc.)
- [ ] Configure environment variables

#### Phase 2: Authentication & Profiles (1.5 hours)
**10:30 AM - 12:00 PM**
- [ ] Implement secret code authentication system
- [ ] Create profile creation form
- [ ] Build login flow with email/phone + secret code
- [ ] Setup auth context and hooks
- [ ] Test profile persistence

#### Phase 3: Landing Page & Navigation (1 hour)
**12:00 PM - 1:00 PM**
- [ ] Create landing page with 3 equal paths
- [ ] Implement PathSelector component
- [ ] Add live stats display
- [ ] Setup routing for all three paths
- [ ] Mobile responsive design

**1:00 PM - 2:00 PM: LUNCH BREAK**

#### Phase 4: Team Creation Flow (1.5 hours)
**2:00 PM - 3:30 PM**
- [ ] Build CreateTeamForm component
- [ ] Implement role selection UI
- [ ] Add team settings (max members, etc.)
- [ ] Create team in database with leader
- [ ] Redirect to leader dashboard

#### Phase 5: Browse & Join Teams (1.5 hours)
**3:30 PM - 5:00 PM**
- [ ] Create TeamList component
- [ ] Implement TeamCard with realtime status
- [ ] Add filters by skills/roles
- [ ] Build JoinRequestModal
- [ ] Implement request submission

#### Phase 6: Leader Dashboard (2 hours)
**5:00 PM - 7:00 PM**
- [ ] Create leader dashboard layout
- [ ] Display team members and roles
- [ ] Show pending requests with accept/reject
- [ ] Implement member removal
- [ ] Add team editing capabilities

### Day 2: Advanced Features (6 hours)

#### Phase 7: Realtime & Notifications (2 hours)
**9:00 AM - 11:00 AM**
- [ ] Setup Supabase realtime subscriptions
- [ ] Implement notification system with sound
- [ ] Add vibration API for mobile
- [ ] Create NotificationToast component
- [ ] Test realtime updates across tabs

#### Phase 8: Voting System (1.5 hours)
**11:00 AM - 12:30 PM**
- [ ] Implement leader leaving flow
- [ ] Create voting modal UI
- [ ] Add 5-minute countdown timer
- [ ] Implement vote casting/changing
- [ ] Handle tie-breaker logic
- [ ] Test voting completion

#### Phase 9: Contact Sharing (1 hour)
**12:30 PM - 1:30 PM**
- [ ] Implement contact protection
- [ ] Add warning before sharing
- [ ] Create contact display for team members
- [ ] Test contact reveal on acceptance

**1:30 PM - 2:00 PM: BREAK**

#### Phase 10: Polish & Deploy (1.5 hours)
**2:00 PM - 3:30 PM**
- [ ] Add loading states and error handling
- [ ] Implement animations (Framer Motion)
- [ ] Final mobile responsiveness check
- [ ] Deploy to Vercel
- [ ] Test production environment
- [ ] Prepare demo

## 🔑 Key Implementation Details

### 1. Landing Page Three Paths
```typescript
// components/landing/PathSelector.tsx
const paths = [
  {
    icon: '🚀',
    title: 'Start a New Team',
    description: 'I have a project idea and need to recruit team members',
    action: '/profile/create?role=leader',
    color: 'bg-blue-500'
  },
  {
    icon: '🔍',
    title: 'Join a Team',
    description: "I'm looking for a project to contribute my skills to",
    action: '/profile/create?role=member',
    color: 'bg-green-500'
  },
  {
    icon: '📊',
    title: 'Manage My Team',
    description: 'I already have a team and need to check requests or members',
    action: '/auth/login',
    color: 'bg-purple-500'
  }
];
```

### 2. Secret Code Authentication
```typescript
// lib/auth/secretCode.ts
export async function loginWithSecret(
  identifier: string, // email or phone
  secretCode: string
) {
  const hashedCode = await hashSecretCode(secretCode);

  const { data, error } = await supabase.rpc('login_with_secret', {
    p_identifier: identifier,
    p_secret_code: hashedCode
  });

  if (data?.success) {
    // Store session
    localStorage.setItem('teamdock_session', data.profile.id);
    return data.profile;
  }

  throw new Error('Invalid credentials');
}
```

### 3. Realtime Join Requests
```typescript
// hooks/useJoinRequests.ts
export function useJoinRequests(teamId: string) {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    // Initial fetch
    fetchRequests();

    // Subscribe to realtime
    const subscription = supabase
      .channel(`requests:${teamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'join_requests',
        filter: `team_id=eq.${teamId}`
      }, (payload) => {
        // Play notification sound
        playSound('notification');

        // Vibrate
        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200]);
        }

        // Show toast
        toast.custom(<NewRequestToast request={payload.new} />);

        // Update state
        setRequests(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => subscription.unsubscribe();
  }, [teamId]);

  return requests;
}
```

### 4. Voting System Implementation
```typescript
// components/voting/VotingModal.tsx
export function VotingModal({ teamId, members }) {
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          finalizeVoting();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const castVote = async () => {
    await supabase.rpc('cast_vote', {
      p_team_id: teamId,
      p_voter_id: currentUser.id,
      p_candidate_id: selectedCandidate
    });

    toast.success('Vote cast! You can change it anytime.');
  };

  return (
    <Modal>
      <h2>⚠️ Team Leader Election</h2>
      <Timer seconds={timeLeft} />
      <MemberList
        members={members}
        selected={selectedCandidate}
        onSelect={setSelectedCandidate}
      />
      <Button onClick={castVote}>Cast Vote</Button>
    </Modal>
  );
}
```

### 5. Contact Sharing Warning
```typescript
// components/requests/AcceptRequestModal.tsx
export function AcceptRequestModal({ request, onAccept }) {
  const [showWarning, setShowWarning] = useState(false);

  const handleAccept = async () => {
    if (!showWarning) {
      setShowWarning(true);
      return;
    }

    await supabase.rpc('accept_request', {
      p_request_id: request.id,
      p_leader_id: currentUser.id
    });

    // Contacts will be automatically shared via database function
    toast.success('Request accepted! Contacts shared with all members.');
    onAccept();
  };

  return (
    <Modal>
      {showWarning ? (
        <Warning>
          ⚠️ Accepting will share all team member contact information
          including email, phone, Discord, Slack, etc.

          Are you sure?
        </Warning>
      ) : (
        <RequestDetails request={request} />
      )}

      <Button onClick={handleAccept}>
        {showWarning ? 'Yes, Accept & Share' : 'Accept Request'}
      </Button>
    </Modal>
  );
}
```

## 🧪 Testing Checklist

### Core Functionality
- [ ] Create profile with secret code
- [ ] Login with email/phone + code
- [ ] Create team as leader
- [ ] Browse available teams
- [ ] Send join request
- [ ] Accept/reject requests
- [ ] View team contacts after joining
- [ ] Leave team as member
- [ ] Voting system triggers on leader leave
- [ ] New leader gets full permissions

### Realtime Features
- [ ] New teams appear instantly
- [ ] Join requests show immediately
- [ ] Member status updates live
- [ ] Vote counts update in realtime
- [ ] Notifications with sound
- [ ] Vibration on mobile

### Edge Cases
- [ ] Can't join same team twice
- [ ] Can't vote for yourself
- [ ] Tie-breaker works correctly
- [ ] Secret code validation
- [ ] Team disbands with no members

## 🚀 Deployment Steps

1. **Supabase Setup**
```bash
# Create project at supabase.com
# Run SQL from DATABASE_DESIGN_V2.md
# Enable realtime on tables
# Get API keys
```

2. **Environment Variables**
```env
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
NEXT_PUBLIC_APP_URL=https://teamdock.vercel.app
```

3. **Deploy to Vercel**
```bash
git init
git add .
git commit -m "Initial TeamDock implementation"
git push origin main

# Connect to Vercel
vercel --prod
```

## 📊 Success Metrics

- Teams created: 50+
- Join requests: 200+
- Average team formation: < 5 minutes
- Successful votes: 95%+
- Uptime: 99.9%

## 🎯 Demo Script

1. **Show Landing** (10s)
   - Three equal paths
   - Live statistics

2. **Create Team** (30s)
   - Quick profile setup
   - Define roles needed
   - Get to dashboard

3. **Join Team** (30s)
   - Browse teams
   - Send request
   - Show notification

4. **Accept Request** (20s)
   - Leader accepts
   - Contacts shared
   - Member joins

5. **Voting Demo** (30s)
   - Leader leaves
   - Voting starts
   - New leader elected

---

**Ready to implement TeamDock! Let's build! 🚀**