'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import VotingModal from '@/components/voting/VotingModal'
import soundManager, { playJoinSound, playAlertSound, playSuccessSound, playNotificationSound } from '@/lib/utils/soundManager'
import UserStatus, { StatusIndicator } from '@/components/UserStatus'

type TeamMember = {
  id: string
  profile_id: string
  role: string
  joined_at: string
  profile: {
    name: string
    email: string | null
    phone: string | null
    proficiencies: string[]
    status?: 'available' | 'busy' | 'break' | 'offline'
  }
}

type JoinRequest = {
  id: string
  profile_id: string
  requested_role: string
  message: string | null
  status: string
  created_at: string
  requester: {
    name: string
    proficiencies: string[]
  }
}

type Team = {
  id: string
  name: string
  description: string
  status: string
  leader_id: string
  looking_for_roles: string[]
  tech_stack: string[]
  voting_started_at?: string | null
  voting_ends_at?: string | null
}

function ManageTeamPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [authModal, setAuthModal] = useState(true)
  const [authData, setAuthData] = useState({
    identifier: '',
    secretCode: ''
  })
  const [authError, setAuthError] = useState('')
  const [profileId, setProfileId] = useState<string | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [isLeader, setIsLeader] = useState(false)
  const [activeTab, setActiveTab] = useState<'members' | 'requests' | 'settings'>('members')
  const [userName, setUserName] = useState<string>('')

  // Profile update states
  const [profileUpdateData, setProfileUpdateData] = useState({
    email: '',
    phone: '',
    currentCode: '',
    newCode: '',
    confirmCode: ''
  })
  const [profileUpdateError, setProfileUpdateError] = useState('')
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState('')
  const [updatingProfile, setUpdatingProfile] = useState(false)

  // Team update states
  const [editingTeam, setEditingTeam] = useState(false)
  const [teamUpdateData, setTeamUpdateData] = useState({
    description: '',
    techStack: [] as string[],
    lookingForRoles: [] as string[]
  })
  const [teamUpdateError, setTeamUpdateError] = useState('')
  const [teamUpdateSuccess, setTeamUpdateSuccess] = useState('')
  const [updatingTeam, setUpdatingTeam] = useState(false)
  const [showVotingModal, setShowVotingModal] = useState(false)

  // Available options for team settings
  const availableRoles = [
    'Frontend Dev', 'Backend Dev', 'Full Stack',
    'Mobile Dev', 'UI/UX Designer', 'Data Scientist',
    'ML Engineer', 'DevOps', 'Product Manager',
    'Business', 'Marketing', 'Pitch Expert'
  ]

  const techStackOptions = [
    'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Python',
    'Django', 'Flask', 'FastAPI', 'Java', 'Spring', 'Go',
    'Rust', 'Swift', 'Kotlin', 'Flutter', 'React Native',
    'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'AWS', 'Firebase'
  ]

  // Sound notification
  const notificationSound = typeof window !== 'undefined' ? new Howl({
    src: ['data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'],
    volume: 0.5,
  }) : null

  // Handle tab changes via URL
  const handleTabChange = (tab: 'members' | 'requests' | 'settings') => {
    setActiveTab(tab)
    router.push(`/manage-team?tab=${tab}`)
  }

  useEffect(() => {
    // Set active tab from URL params
    const tab = searchParams.get('tab') as 'members' | 'requests' | 'settings'
    if (tab && ['members', 'requests', 'settings'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  useEffect(() => {
    // Check if already authenticated
    const storedProfileId = sessionStorage.getItem('teamdock_profile_id')
    const storedUserName = sessionStorage.getItem('teamdock_user_name')
    if (storedProfileId && storedUserName) {
      setProfileId(storedProfileId)
      setUserName(storedUserName)
      setAuthModal(false)
      loadTeamData(storedProfileId)
    } else {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Check if team is in voting status
    if (team?.status === 'voting' && team.voting_ends_at) {
      setShowVotingModal(true)
      playAlertSound() // Play alert sound for voting
    }
  }, [team?.status, team?.voting_ends_at])

  const handleAuth = async () => {
    if (!authData.identifier || !authData.secretCode) {
      setAuthError('Please fill in all fields')
      return
    }

    if (authData.secretCode.length < 6 || authData.secretCode.length > 12) {
      setAuthError('Secret code must be 6-12 digits')
      return
    }

    try {
      const { data, error } = await (supabase.rpc as any)('login_with_secret', {
        p_identifier: authData.identifier,
        p_secret_code: authData.secretCode
      })

      if (error) throw error

      if (data && data.success) {
        const profileId = data.profile.id
        const profileName = data.profile.name
        sessionStorage.setItem('teamdock_profile_id', profileId)
        sessionStorage.setItem('teamdock_user_name', profileName)
        setProfileId(profileId)
        setUserName(profileName)
        setAuthModal(false)
        await loadTeamData(profileId)
      } else {
        setAuthError('Invalid credentials')
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed')
    }
  }

  const loadTeamData = async (userId: string) => {
    setLoading(true)
    try {
      // Get user's profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('name, email, phone')
        .eq('id', userId)
        .single()

      if (profileData) {
        // Set user name for header
        setUserName((profileData as any).name || '')
        // Populate profile update form with current values
        setProfileUpdateData(prev => ({
          ...prev,
          email: (profileData as any).email || '',
          phone: (profileData as any).phone || ''
        }))
      }

      // Get user's team membership
      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('profile_id', userId)
        .single()

      if (memberError || !memberData) {
        // Check if user has a team they created
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('*')
          .eq('leader_id', userId)
          .single()

        if (teamError || !teamData) {
          // Check if user has a pending request before redirecting
          const { data: pendingRequest } = await supabase
            .from('join_requests')
            .select('id, team_id, status')
            .eq('profile_id', userId)
            .eq('status', 'pending')
            .single()

          if (pendingRequest) {
            // User has a pending request, redirect to status page
            sessionStorage.setItem('hasPendingRequest', 'true')
            router.push('/request-status')
            return
          }

          // No team and no pending request, redirect home
          router.push('/')
          return
        }

        setTeam(teamData as Team)
        setIsLeader(true)
        // Populate team update form
        setTeamUpdateData({
          description: (teamData as any).description,
          techStack: (teamData as any).tech_stack || [],
          lookingForRoles: (teamData as any).looking_for_roles || []
        })
        await loadTeamMembers((teamData as any).id)
        await loadJoinRequests((teamData as any).id)
      } else {
        // Load team data
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('*')
          .eq('id', (memberData as any).team_id)
          .single()

        if (teamError) throw teamError

        setTeam(teamData as Team)
        setIsLeader((teamData as any).leader_id === userId)
        // Populate team update form if leader
        if ((teamData as any).leader_id === userId) {
          setTeamUpdateData({
            description: (teamData as any).description,
            techStack: (teamData as any).tech_stack || [],
            lookingForRoles: (teamData as any).looking_for_roles || []
          })
          await loadJoinRequests((teamData as any).id)
        }
        await loadTeamMembers((teamData as any).id)
      }

      // Setup realtime subscriptions
      setupRealtimeSubscriptions()
    } catch (error) {
      console.error('Error loading team data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTeamMembers = async (teamId: string) => {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        *,
        profile:profiles!team_members_profile_id_fkey(
          name,
          email,
          phone,
          proficiencies,
          status
        )
      `)
      .eq('team_id', teamId)

    if (!error && data) {
      setMembers(data as any)
    }
  }

  const loadJoinRequests = async (teamId: string) => {
    const { data, error } = await supabase
      .from('join_requests')
      .select(`
        *,
        requester:profiles!join_requests_profile_id_fkey(
          name,
          proficiencies
        )
      `)
      .eq('team_id', teamId)
      .eq('status', 'pending')

    if (!error && data) {
      setJoinRequests(data as any)
    }
  }

  const setupRealtimeSubscriptions = () => {
    if (!team) return

    const channel = supabase
      .channel('team-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_members', filter: `team_id=eq.${team.id}` },
        () => {
          loadTeamMembers(team.id)
          notificationSound?.play()
          if ('vibrate' in navigator) {
            navigator.vibrate(200)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'join_requests', filter: `team_id=eq.${team.id}` },
        () => {
          if (isLeader) {
            loadJoinRequests(team.id)
            notificationSound?.play()
            if ('vibrate' in navigator) {
              navigator.vibrate([200, 100, 200])
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const handleJoinRequest = async (requestId: string, accept: boolean) => {
    try {
      const { error } = await (supabase.rpc as any)('respond_to_request', {
        p_request_id: requestId,
        p_leader_id: profileId,
        p_accept: accept,
        p_response_message: null
      })

      if (error) throw error

      await loadJoinRequests(team!.id)
      if (accept) {
        await loadTeamMembers(team!.id)
        playJoinSound() // Play join sound when accepting
      } else {
        playNotificationSound() // Play notification sound when rejecting
      }
    } catch (error) {
      console.error('Error handling join request:', error)
    }
  }

  const handleLogout = () => {
    // Clear session storage
    sessionStorage.removeItem('profileId')
    sessionStorage.removeItem('teamId')
    // Redirect to home
    router.push('/')
  }

  const handleLeaveTeam = async () => {
    const confirmMessage = isLeader
      ? 'Are you sure you want to leave this team? As the team leader, this will initiate a voting process for a new leader (or auto-promote if only one member remains).'
      : 'Are you sure you want to leave this team?'

    if (!confirm(confirmMessage)) return

    try {
      const { error } = await (supabase.rpc as any)('leave_team', {
        p_profile_id: profileId,
        p_team_id: team!.id
      })

      if (error) throw error

      router.push('/')
    } catch (error) {
      console.error('Error leaving team:', error)
    }
  }

  const handleVotingComplete = async () => {
    // Reload team data to get new leader
    if (profileId) await loadTeamData(profileId)
    setShowVotingModal(false)

    // Play notification sound if available
    if ('navigator' in window && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200])
    }
  }

  const handleUpdateTeam = async () => {
    setTeamUpdateError('')
    setTeamUpdateSuccess('')
    setUpdatingTeam(true)

    try {
      if (!teamUpdateData.description || teamUpdateData.lookingForRoles.length === 0) {
        setTeamUpdateError('Please provide a description and select at least one role you are looking for')
        setUpdatingTeam(false)
        return
      }

      const { error } = await (supabase as any)
        .from('teams')
        .update({
          description: teamUpdateData.description,
          tech_stack: teamUpdateData.techStack.length > 0 ? teamUpdateData.techStack : null,
          looking_for_roles: teamUpdateData.lookingForRoles
        })
        .eq('id', team!.id)
        .eq('leader_id', profileId) // Extra safety check

      if (error) throw error

      // Update local team state
      setTeam(prev => prev ? {
        ...prev,
        description: teamUpdateData.description,
        tech_stack: teamUpdateData.techStack,
        looking_for_roles: teamUpdateData.lookingForRoles
      } : null)

      setTeamUpdateSuccess('Team information updated successfully!')
      setEditingTeam(false)
      // Clear success message after 3 seconds
      setTimeout(() => setTeamUpdateSuccess(''), 3000)
    } catch (error: any) {
      setTeamUpdateError(error.message || 'Failed to update team information')
    } finally {
      setUpdatingTeam(false)
    }
  }

  const handleUpdateProfile = async (updateType: 'contact' | 'password') => {
    setProfileUpdateError('')
    setProfileUpdateSuccess('')
    setUpdatingProfile(true)

    try {
      if (updateType === 'contact') {
        // Update email or phone
        if (!profileUpdateData.email && !profileUpdateData.phone) {
          setProfileUpdateError('Please provide at least an email or phone number')
          setUpdatingProfile(false)
          return
        }

        const { error } = await (supabase as any)
          .from('profiles')
          .update({
            email: profileUpdateData.email || null,
            phone: profileUpdateData.phone || null
          })
          .eq('id', profileId)

        if (error) {
          if (error.message?.includes('duplicate')) {
            throw new Error('This email or phone number is already in use by another account')
          }
          throw error
        }

        setProfileUpdateSuccess('Your contact information has been updated!')
        // Clear success message after 3 seconds
        setTimeout(() => setProfileUpdateSuccess(''), 3000)
      } else {
        // Update secret code
        if (!profileUpdateData.currentCode || !profileUpdateData.newCode || !profileUpdateData.confirmCode) {
          setProfileUpdateError('Please fill in all secret code fields')
          setUpdatingProfile(false)
          return
        }

        if (profileUpdateData.newCode !== profileUpdateData.confirmCode) {
          setProfileUpdateError('The new secret codes don\'t match. Please try again.')
          setUpdatingProfile(false)
          return
        }

        if (profileUpdateData.newCode.length < 6 || profileUpdateData.newCode.length > 12) {
          setProfileUpdateError('Your secret code needs to be between 6 and 12 digits')
          setUpdatingProfile(false)
          return
        }

        if (!/^\d+$/.test(profileUpdateData.newCode)) {
          setProfileUpdateError('Your secret code should only contain numbers (0-9)')
          setUpdatingProfile(false)
          return
        }

        // Use the RPC function to update the secret code
        const { error } = await (supabase.rpc as any)('update_secret_code', {
          p_profile_id: profileId,
          p_current_code: profileUpdateData.currentCode,
          p_new_code: profileUpdateData.newCode
        })

        if (error) {
          if (error.message?.includes('Current secret code is incorrect')) {
            setProfileUpdateError('The current secret code you entered is incorrect. Please try again.')
          } else {
            setProfileUpdateError('Failed to update secret code. Please try again.')
          }
          setUpdatingProfile(false)
          return
        }

        // Clear the secret code fields after successful update
        setProfileUpdateData(prev => ({
          ...prev,
          currentCode: '',
          newCode: '',
          confirmCode: ''
        }))
        setProfileUpdateSuccess('Your secret code has been updated successfully!')
        // Clear success message after 3 seconds
        setTimeout(() => setProfileUpdateSuccess(''), 3000)
      }
    } catch (error: any) {
      // Humanize common error messages
      let errorMessage = 'Something went wrong. Please try again.'

      if (error.message?.includes('duplicate')) {
        errorMessage = 'This email or phone number is already in use by another account'
      } else if (error.message?.includes('network')) {
        errorMessage = 'Connection issue. Please check your internet and try again.'
      } else if (error.message?.includes('permission') || error.message?.includes('RLS')) {
        errorMessage = 'You don\'t have permission to make this change'
      } else if (error.message?.includes('column')) {
        errorMessage = 'System update in progress. Please try again later.'
      } else if (error.message) {
        // Use the original message if it's already readable
        errorMessage = error.message
      }

      setProfileUpdateError(errorMessage)
    } finally {
      setUpdatingProfile(false)
    }
  }

  if (authModal) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white border-2 border-black max-w-md w-full p-8"
        >
          <h1 className="text-2xl sm:text-3xl font-black text-black mb-2">
            Access Your Team ⚡
          </h1>
          <p className="text-gray-600 mb-6">
            Enter your credentials to manage your team
          </p>

          {authError && (
            <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 text-red-700 text-sm">
              {authError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="label">
                Email or Phone
              </label>
              <input
                type="text"
                className="input"
                value={authData.identifier}
                onChange={(e) => setAuthData({...authData, identifier: e.target.value})}
                placeholder="email@example.com or +1234567890"
              />
            </div>

            <div>
              <label className="label">
                Secret Code (6-12 digits)
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                className="input"
                value={authData.secretCode}
                onChange={(e) => setAuthData({...authData, secretCode: e.target.value})}
                placeholder="Enter your secret code"
                onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
              />
            </div>
          </div>

          <button
            onClick={handleAuth}
            className="mt-6 w-full bg-black text-white py-3 px-6 font-bold border-2 border-black hover:bg-gray-900 transition-colors"
          >
            Access Team Dashboard
          </button>
        </motion.div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-gray-600">Loading team data...</div>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No Team Found</h2>
          <Link href="/" className="text-amber-600 hover:text-amber-700">
            ← Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex">
      {/* Left Sidebar - Hidden on mobile */}
      <aside className="hidden lg:flex w-64 bg-black text-white h-screen sticky top-0 flex-col border-r-4 border-amber-500">
        {/* Logo */}
        <div className="p-4 border-b-2 border-amber-500/30">
          <Link href="/" className="block">
            <h1 className="text-2xl lg:text-3xl font-black hover:text-amber-400 transition-colors">
              TEAMDOCK
            </h1>
            <p className="text-xs text-amber-400 mt-1">Hackathon Team Formation</p>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded hover:bg-amber-500/20 transition-colors text-gray-300 hover:text-amber-400 font-medium"
          >
            <span>🏠</span>
            <span className="text-sm">Home</span>
          </Link>

          <Link
            href="/manage-team"
            className="flex items-center gap-3 px-3 py-2 rounded bg-amber-500/20 text-amber-400 font-medium"
          >
            <span>👥</span>
            <span className="text-sm">Team Dashboard</span>
          </Link>

          <div className="pt-4 mt-4 border-t border-amber-500/30">
            <p className="px-3 text-xs text-amber-400 uppercase tracking-wider mb-2 font-bold">Teams</p>

            <Link
              href="/join-team"
              className="flex items-center gap-3 px-3 py-2 rounded hover:bg-amber-500/20 transition-colors text-gray-300 hover:text-amber-400 font-medium"
            >
              <span>🤝</span>
              <span className="text-sm">Browse Teams</span>
            </Link>

            <Link
              href="/start-team"
              className="flex items-center gap-3 px-3 py-2 rounded hover:bg-amber-500/20 transition-colors text-gray-300 hover:text-amber-400 font-medium"
            >
              <span>✨</span>
              <span className="text-sm">Create Team</span>
            </Link>
          </div>
        </nav>

        {/* Profile Section */}
        <div className="p-4 border-t border-amber-500/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-500 rounded flex items-center justify-center text-black font-black">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-bold">{userName}</p>
              <p className="text-amber-400 text-xs">Team Leader</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2 px-3 bg-white text-black font-bold border-2 border-white hover:bg-gray-100 text-sm rounded transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header Bar */}
        <header className="bg-white border-b-2 border-black px-4 lg:px-6 py-4 shadow-hard">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h2 className="text-lg lg:text-xl font-black text-black">{team.name}</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                team.status === 'recruiting' || team.status === 'forming' ? 'bg-green-100 text-green-700' :
                team.status === 'locked' || team.status === 'closed' ? 'bg-yellow-100 text-yellow-700' :
                team.status === 'voting' ? 'bg-red-100 text-red-700 animate-pulse' :
                team.status === 'full' ? 'bg-gray-100 text-gray-700' :
                'bg-red-100 text-red-700'
              }`}>
                {team.status === 'voting' ? '🗳️ Voting in Progress' :
                 team.status === 'recruiting' ? 'Recruiting' :
                 team.status.charAt(0).toUpperCase() + team.status.slice(1)}
              </span>
              <div className="flex items-center text-sm text-green-600">
                <span className="animate-pulse mr-2 h-2 w-2 bg-green-500 rounded-full"></span>
                <span className="font-medium">Real-time Updates</span>
              </div>
            </div>

            {/* ShellHack Branding - Hidden on mobile */}
            <div className="hidden lg:flex items-center gap-3">
              <span className="text-2xl font-black text-black">SHELLHACKS</span>
              <span className="text-amber-500 font-black">2025</span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 lg:px-6 py-4 lg:py-6">
            {/* Team Info */}
            <div className="mb-6 lg:mb-8">
              <div className="bg-white border-2 border-black p-4 lg:p-6 shadow-hard">
                <h2 className="text-xs lg:text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Project Description</h2>
                <p className="text-gray-800 text-base lg:text-lg font-medium mb-4">
                  {team.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {team.tech_stack.map((tech) => (
                    <span key={tech} className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm font-medium">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabs - Scrollable on mobile */}
            <div className="flex gap-2 mb-6 overflow-x-auto">
              <button
            onClick={() => handleTabChange('members')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'members'
                ? 'bg-white text-amber-600 shadow-lg'
                : 'bg-white/50 text-gray-600 hover:bg-white/70'
            }`}
          >
            Team Members ({members.length})
          </button>
          {isLeader && (
            <button
              onClick={() => handleTabChange('requests')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors relative ${
                activeTab === 'requests'
                  ? 'bg-white text-amber-600 shadow-lg'
                  : 'bg-white/50 text-gray-600 hover:bg-white/70'
              }`}
            >
              Join Requests
              {joinRequests.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {joinRequests.length}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => handleTabChange('settings')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'settings'
                ? 'bg-white text-amber-600 shadow-lg'
                : 'bg-white/50 text-gray-600 hover:bg-white/70'
            }`}
          >
            Settings
          </button>
        </div>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'members' && (
            <div className="bg-white border-2 border-black p-4 lg:p-6">
              <h2 className="text-xl font-black mb-6">Team Roster</h2>

              {/* Current Team Members - Filled Roles */}
              {members.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Current Members</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {members.map((member) => {
                      const isRequestedRole = team.looking_for_roles.includes(member.role)
                      return (
                        <div
                          key={member.id}
                          className={`border-2 p-4 ${
                            isRequestedRole ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-bold text-sm mb-1">{member.role}</div>
                              <div className="text-green-700 font-medium flex items-center gap-1">
                                <span className="text-lg">✓</span>
                                {member.profile.name}
                                {team.leader_id === member.profile_id && ' 👑'}
                                <StatusIndicator status={member.profile.status || 'offline'} size="sm" />
                              </div>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {member.profile.proficiencies.slice(0, 3).map((skill) => (
                                  <span key={skill} className="px-2 py-0.5 bg-white border border-green-300 text-green-700 text-xs">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {isLeader && (
                              <div className="flex gap-1 ml-2">
                                {member.profile.email && (
                                  <a
                                    href={`mailto:${member.profile.email}`}
                                    className="p-1.5 bg-gray-200 text-gray-700 hover:bg-gray-300 text-xs"
                                    title="Email"
                                  >
                                    ✉
                                  </a>
                                )}
                                {member.profile.phone && (
                                  <a
                                    href={`https://wa.me/${member.profile.phone.replace(/\D/g, '')}`}
                                    className="p-1.5 bg-green-200 text-green-700 hover:bg-green-300 text-xs"
                                    title="WhatsApp"
                                  >
                                    💬
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Open Positions - Still Looking For */}
              {(() => {
                const filledRoles = members.map(m => m.role)
                const openRoles = team.looking_for_roles.filter(role => !filledRoles.includes(role))
                return openRoles.length > 0 ? (
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Open Positions</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {openRoles.map((role) => (
                        <div
                          key={role}
                          className="border-2 border-gray-300 bg-gray-50 border-dashed p-4"
                        >
                          <div className="font-bold text-sm mb-1">{role}</div>
                          <div className="text-gray-500 text-sm italic">Still filling...</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}

              {/* Team Progress */}
              <div className="mt-6 p-4 bg-gray-100 border border-gray-300">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold">Team Progress</span>
                  <span className="text-sm font-bold">
                    {members.filter(m => team.looking_for_roles.includes(m.role)).length} / {team.looking_for_roles.length} roles filled
                  </span>
                </div>
                <div className="w-full bg-gray-300 h-2">
                  <div
                    className="bg-green-500 h-2 transition-all duration-300"
                    style={{ width: `${(members.filter(m => team.looking_for_roles.includes(m.role)).length / team.looking_for_roles.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'requests' && isLeader && (
            <div className="bg-white border-2 border-black p-4 lg:p-6">
              <h2 className="text-xl font-black mb-4">Join Requests</h2>
              {joinRequests.length === 0 ? (
                <p className="text-gray-600">No pending join requests</p>
              ) : (
                <div className="space-y-4">
                  {joinRequests.map((request) => (
                    <div key={request.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">
                            {request.requester.name}
                          </h3>
                          <p className="text-sm text-gray-600 mb-2">
                            Requesting: <span className="font-medium">{request.requested_role}</span>
                          </p>
                          {request.message && (
                            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded mb-2">
                              "{request.message}"
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {request.requester.proficiencies.map((skill) => (
                              <span key={skill} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleJoinRequest(request.id, true)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleJoinRequest(request.id, false)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Profile Settings */}
              <div className="bg-white border-2 border-black p-4 lg:p-6">
                <h2 className="text-xl font-black mb-6">Profile Settings</h2>

                {profileUpdateError && (
                  <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 text-red-700 text-sm">
                    {profileUpdateError}
                  </div>
                )}

                {profileUpdateSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border-2 border-green-500 text-green-700 text-sm">
                    {profileUpdateSuccess}
                  </div>
                )}

                <div className="space-y-6">
                  {/* Contact Information */}
                  <div>
                    <h3 className="font-bold text-gray-900 mb-3">Contact Information</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Email</label>
                        <input
                          type="email"
                          className="input"
                          value={profileUpdateData.email}
                          onChange={(e) => setProfileUpdateData({...profileUpdateData, email: e.target.value})}
                          placeholder="email@example.com"
                        />
                      </div>
                      <div>
                        <label className="label">Phone</label>
                        <input
                          type="tel"
                          className="input"
                          value={profileUpdateData.phone}
                          onChange={(e) => setProfileUpdateData({...profileUpdateData, phone: e.target.value})}
                          placeholder="+1234567890"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleUpdateProfile('contact')}
                      disabled={updatingProfile}
                      className="mt-3 px-4 py-2 bg-black text-white font-bold border-2 border-black hover:bg-gray-800 disabled:opacity-50"
                    >
                      Update Contact Info
                    </button>
                  </div>

                  {/* Change Secret Code */}
                  <div className="pt-6 border-t border-gray-200">
                    <h3 className="font-bold text-gray-900 mb-3">Change Secret Code</h3>
                    <div className="space-y-4 max-w-sm">
                      <div>
                        <label className="label">Current Secret Code</label>
                        <input
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={12}
                          className="input"
                          value={profileUpdateData.currentCode}
                          onChange={(e) => setProfileUpdateData({...profileUpdateData, currentCode: e.target.value})}
                          placeholder="Enter current code"
                        />
                      </div>
                      <div>
                        <label className="label">New Secret Code (6-12 digits)</label>
                        <input
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={12}
                          className="input"
                          value={profileUpdateData.newCode}
                          onChange={(e) => setProfileUpdateData({...profileUpdateData, newCode: e.target.value})}
                          placeholder="Enter new code"
                        />
                      </div>
                      <div>
                        <label className="label">Confirm New Secret Code</label>
                        <input
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={12}
                          className="input"
                          value={profileUpdateData.confirmCode}
                          onChange={(e) => setProfileUpdateData({...profileUpdateData, confirmCode: e.target.value})}
                          placeholder="Re-enter new code"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleUpdateProfile('password')}
                      disabled={updatingProfile}
                      className="mt-3 px-4 py-2 bg-black text-white font-bold border-2 border-black hover:bg-gray-800 disabled:opacity-50"
                    >
                      Update Secret Code
                    </button>
                  </div>

                </div>
              </div>

              {/* Team Settings */}
              <div className="bg-white border-2 border-black p-4 lg:p-6">
                <h2 className="text-xl font-black mb-6">Team Information</h2>

                {teamUpdateError && (
                  <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 text-red-700 text-sm">
                    {teamUpdateError}
                  </div>
                )}

                {teamUpdateSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border-2 border-green-500 text-green-700 text-sm">
                    {teamUpdateSuccess}
                  </div>
                )}

                <div className="space-y-6">
                  {isLeader && !editingTeam ? (
                    <>
                      <div>
                        <h3 className="font-bold text-gray-900 mb-2">Team Name</h3>
                        <p className="text-gray-700">{team.name}</p>
                        <p className="text-xs text-gray-500 mt-1">Team name cannot be changed</p>
                      </div>

                      <div>
                        <h3 className="font-bold text-gray-900 mb-2">Description</h3>
                        <p className="text-gray-700">{team.description}</p>
                      </div>

                      <div>
                        <h3 className="font-bold text-gray-900 mb-2">Tech Stack</h3>
                        <div className="flex flex-wrap gap-2">
                          {team.tech_stack.length === 0 ? (
                            <span className="text-gray-600">No tech stack specified</span>
                          ) : (
                            team.tech_stack.map((tech) => (
                              <span key={tech} className="px-3 py-1 bg-green-100 text-green-700 border border-green-300">
                                {tech}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-bold text-gray-900 mb-2">Looking For</h3>
                        <div className="flex flex-wrap gap-2">
                          {team.looking_for_roles.map((role) => (
                            <span key={role} className="px-3 py-1 bg-purple-100 text-purple-700 border border-purple-300">
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => setEditingTeam(true)}
                        className="px-4 py-2 bg-black text-white font-bold border-2 border-black hover:bg-gray-800"
                      >
                        Edit Team Info
                      </button>
                    </>
                  ) : isLeader && editingTeam ? (
                    <>
                      <div>
                        <h3 className="font-bold text-gray-900 mb-2">Team Name</h3>
                        <p className="text-gray-700">{team.name}</p>
                        <p className="text-xs text-gray-500 mt-1">Team name cannot be changed</p>
                      </div>

                      <div>
                        <label className="label">Description *</label>
                        <textarea
                          className="input min-h-[80px] resize-none"
                          rows={3}
                          value={teamUpdateData.description}
                          onChange={(e) => setTeamUpdateData({...teamUpdateData, description: e.target.value})}
                          placeholder="We're building an innovative solution for..."
                        />
                      </div>

                      <div>
                        <label className="label">Tech Stack (Optional)</label>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                          {techStackOptions.map((tech) => (
                            <button
                              key={tech}
                              type="button"
                              onClick={() => {
                                if (teamUpdateData.techStack.includes(tech)) {
                                  setTeamUpdateData({
                                    ...teamUpdateData,
                                    techStack: teamUpdateData.techStack.filter(t => t !== tech)
                                  })
                                } else {
                                  setTeamUpdateData({
                                    ...teamUpdateData,
                                    techStack: [...teamUpdateData.techStack, tech]
                                  })
                                }
                              }}
                              className={`px-2 py-1 text-xs font-medium border transition-all ${
                                teamUpdateData.techStack.includes(tech)
                                  ? 'bg-green-600 text-white border-green-600'
                                  : 'bg-white text-gray-700 border-gray-300 hover:border-green-600'
                              }`}
                            >
                              {tech}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="label">Looking For * (Roles needed)</label>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                          {availableRoles.map((role) => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => {
                                if (teamUpdateData.lookingForRoles.includes(role)) {
                                  setTeamUpdateData({
                                    ...teamUpdateData,
                                    lookingForRoles: teamUpdateData.lookingForRoles.filter(r => r !== role)
                                  })
                                } else {
                                  setTeamUpdateData({
                                    ...teamUpdateData,
                                    lookingForRoles: [...teamUpdateData.lookingForRoles, role]
                                  })
                                }
                              }}
                              className={`px-3 py-2 text-xs font-medium border transition-all ${
                                teamUpdateData.lookingForRoles.includes(role)
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-white text-gray-700 border-gray-300 hover:border-purple-600'
                              }`}
                            >
                              {role}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setEditingTeam(false)
                            // Reset to original values
                            setTeamUpdateData({
                              description: team.description,
                              techStack: team.tech_stack || [],
                              lookingForRoles: team.looking_for_roles || []
                            })
                            setTeamUpdateError('')
                          }}
                          className="px-4 py-2 bg-white text-black font-bold border-2 border-gray-300 hover:border-black"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleUpdateTeam}
                          disabled={updatingTeam}
                          className="px-4 py-2 bg-black text-white font-bold border-2 border-black hover:bg-gray-800 disabled:opacity-50"
                        >
                          {updatingTeam ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <h3 className="font-bold text-gray-900 mb-2">Team Name</h3>
                        <p className="text-gray-700">{team.name}</p>
                      </div>

                      <div>
                        <h3 className="font-bold text-gray-900 mb-2">Description</h3>
                        <p className="text-gray-700">{team.description}</p>
                      </div>

                      <div>
                        <h3 className="font-bold text-gray-900 mb-2">Tech Stack</h3>
                        <div className="flex flex-wrap gap-2">
                          {team.tech_stack.length === 0 ? (
                            <span className="text-gray-600">No tech stack specified</span>
                          ) : (
                            team.tech_stack.map((tech) => (
                              <span key={tech} className="px-3 py-1 bg-green-100 text-green-700 border border-green-300">
                                {tech}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-bold text-gray-900 mb-2">Looking For</h3>
                        <div className="flex flex-wrap gap-2">
                          {team.looking_for_roles.map((role) => (
                            <span key={role} className="px-3 py-1 bg-purple-100 text-purple-700 border border-purple-300">
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="pt-6 border-t border-gray-200">
                    <h3 className="font-bold text-gray-900 mb-4">Danger Zone</h3>
                    <button
                      onClick={handleLeaveTeam}
                      className="px-4 py-2 bg-red-600 text-white font-bold border-2 border-red-600 hover:bg-red-700"
                    >
                      Leave Team
                    </button>
                    {isLeader && (
                      <p className="text-xs text-gray-500 mt-2">
                        As team leader, leaving will trigger a vote for a new leader
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
          </div>
        </main>
      </div>

      {/* Voting Modal */}
      {team && (
        <VotingModal
          isOpen={showVotingModal}
          onClose={() => setShowVotingModal(false)}
          teamId={team.id}
          teamName={team.name}
          votingEndsAt={team.voting_ends_at || ''}
          currentUserId={profileId || ''}
          onVotingComplete={handleVotingComplete}
        />
      )}
    </div>
  )
}

export default function ManageTeamPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <ManageTeamPageContent />
    </Suspense>
  )
}