'use client'

import { useState, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import TeamFeed from '@/components/TeamFeed'
import TeamDashboard from '@/components/TeamDashboard'
import PostCreationModal from '@/components/PostCreationModal'
import JoinTeamView from '@/components/JoinTeamView'
import JoinRequestsView from '@/components/JoinRequestsView'
import ManageTeam from '@/components/ManageTeam'
import CreateTeamView from '@/components/CreateTeamView'
import AuthModal from '@/components/AuthModal'
import { supabase } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Database } from '@/types/supabase'
import type { HackathonStatistics, ActivityFeedItem, SkillSupplyDemand } from '@/types/database.types'

function HomePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [hasPendingRequest, setHasPendingRequest] = useState(false)
  const [activeTeamsCount, setActiveTeamsCount] = useState(0)
  const [totalMembers, setTotalMembers] = useState(0)
  const [showAuthForm, setShowAuthForm] = useState<'login' | 'signup' | null>(null)
  const [authStep, setAuthStep] = useState<'credentials' | 'profile'>('credentials')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statisticsData, setStatisticsData] = useState<HackathonStatistics | null>(null)
  const [liveActivityFeed, setLiveActivityFeed] = useState<ActivityFeedItem[]>([])
  const [skillSupplyDemand, setSkillSupplyDemand] = useState<SkillSupplyDemand | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [refreshingActivities, setRefreshingActivities] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null)
  const [userTeam, setUserTeam] = useState<{ id: string; name: string } | null>(null)
  const [isTeamLeader, setIsTeamLeader] = useState(false)
  const [teamStatus, setTeamStatus] = useState<string>('')
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)
  const [currentView, setCurrentView] = useState<'home' | 'profile' | 'browse-teams' | 'create-team' | 'statistics' | 'join-requests' | 'manage-team'>('home')
  const [showPostModal, setShowPostModal] = useState(false)
  const [hackathonProgress, setHackathonProgress] = useState<{ timeRemaining: string; percentage: number }>({ timeRemaining: '', percentage: 0 })
  const [flipText, setFlipText] = useState(true)
  // Bottom navigation for mobile - no hamburger menu needed
  const [authModal, setAuthModal] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login')

  // Login data
  const [loginData, setLoginData] = useState({
    identifier: '',
    secretCode: ''
  })

  // Signup data
  const [signupData, setSignupData] = useState({
    name: '',
    email: '',
    phone: '',
    secretCode: '',
    confirmCode: '',
    skills: [] as string[]
  })

  const availableSkills = [
    'Frontend', 'Backend', 'Full Stack', 'Mobile', 'DevOps',
    'UI/UX', 'Data Science', 'ML/AI', 'Blockchain',
    'Cloud', 'Security', 'Game Dev', 'AR/VR', 'IoT', 'Pitch'
  ]

  useEffect(() => {
    setMounted(true)

    // Check for Discord auth callback
    const discordAuth = searchParams.get('discord_auth')
    const discordProfileId = searchParams.get('profile_id')
    const discordUsername = searchParams.get('username')
    const isNewUser = searchParams.get('is_new_user')

    if (discordAuth === 'success' && discordProfileId && discordUsername) {
      // Save Discord auth to session
      sessionStorage.setItem('teamdock_profile_id', discordProfileId)
      sessionStorage.setItem('teamdock_user_name', discordUsername)
      setCurrentUser({ id: discordProfileId, name: discordUsername })
      checkUserTeam(discordProfileId)

      // If it's a new user signup, redirect to profile page
      if (isNewUser === 'true') {
        setCurrentView('profile')
      }

      // Clean URL
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('discord_auth')
      newUrl.searchParams.delete('profile_id')
      newUrl.searchParams.delete('username')
      newUrl.searchParams.delete('is_new_user')
      window.history.replaceState({}, '', newUrl.toString())
    } else {
      // Check if user has a pending request
      const pending = sessionStorage.getItem('hasPendingRequest')
      setHasPendingRequest(pending === 'true')

      // Check if user is logged in
      const profileId = sessionStorage.getItem('teamdock_profile_id')
      const userName = sessionStorage.getItem('teamdock_user_name')
      if (profileId && userName) {
        setCurrentUser({ id: profileId, name: userName })
        // Check if user has a team
        checkUserTeam(profileId)
      }
    }

    // Check URL parameters for view
    const view = searchParams.get('view')
    if (view && ['home', 'profile', 'browse-teams', 'create-team', 'statistics', 'join-requests', 'manage-team'].includes(view)) {
      setCurrentView(view as any)
    }

    loadStats()
  }, [searchParams])

  // Text flipping animation for home page
  useEffect(() => {
    if (currentView === 'home' && !currentUser) {
      const interval = setInterval(() => {
        setFlipText(prev => !prev)
      }, 5000) // Switch every 5 seconds

      return () => clearInterval(interval)
    }
  }, [currentView, currentUser])

  const refreshSkillMarketData = async () => {
    try {
      const { data: skillAnalysis, error: skillError } = await supabase.rpc('get_skill_supply_demand')

      if (!skillError && skillAnalysis) {
        setSkillSupplyDemand(skillAnalysis as unknown as SkillSupplyDemand)
      } else if (skillError) {
        console.error('Error fetching skill market data:', skillError)
      }
    } catch (error) {
      console.error('Error fetching skill market data:', error)
    }
  }

  // Load comprehensive statistics when statistics view is selected
  useEffect(() => {
    if (currentView === 'statistics') {
      loadComprehensiveStatistics()

      // Update hackathon progress every second
      const progressInterval = setInterval(() => {
        setHackathonProgress(calculateHackathonProgress())
      }, 1000)

      // Set up realtime subscriptions for skill market updates
      const profilesSubscription = supabase
        .channel('profiles-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'profiles'
        }, () => {
          // Refresh skill supply when profiles change
          refreshSkillMarketData()
        })
        .subscribe()

      const teamsSubscription = supabase
        .channel('teams-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'teams',
          filter: 'status=eq.recruiting'
        }, () => {
          // Refresh skill demand when recruiting teams change
          refreshSkillMarketData()
        })
        .subscribe()

      // Realtime subscriptions for live activities
      const profilesActivitySubscription = supabase
        .channel('profiles-activity')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles'
        }, () => {
          // New member signup
          refreshLiveActivities()
        })
        .subscribe()

      const teamsActivitySubscription = supabase
        .channel('teams-activity')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'teams'
        }, () => {
          // Team created or status changed
          refreshLiveActivities()
          loadComprehensiveStatistics() // Update team counts
        })
        .subscribe()

      const teamMembersSubscription = supabase
        .channel('team-members-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'team_members'
        }, () => {
          // Member joined or left team
          refreshLiveActivities()
          loadComprehensiveStatistics() // Update member counts
        })
        .subscribe()

      const teamPostsSubscription = supabase
        .channel('team-posts-changes')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'team_posts'
        }, () => {
          // New team post
          refreshLiveActivities()
        })
        .subscribe()

      return () => {
        clearInterval(progressInterval)
        supabase.removeChannel(profilesSubscription)
        supabase.removeChannel(teamsSubscription)
        supabase.removeChannel(profilesActivitySubscription)
        supabase.removeChannel(teamsActivitySubscription)
        supabase.removeChannel(teamMembersSubscription)
        supabase.removeChannel(teamPostsSubscription)
      }
    }
  }, [currentView])

  const checkUserTeam = async (profileId: string) => {
    try {
      // Check if user is a member of a team (with active status)
      const { data: memberData } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('profile_id', profileId)
        .eq('status', 'active')
        .single()

      if (memberData && memberData.team_id) {
        // Now get the team details
        const { data: teamData } = await supabase
          .from('teams')
          .select('id, name, status, leader_id')
          .eq('id', memberData.team_id)
          .single()

        if (teamData) {
          console.log('Setting userTeam with:', { id: teamData.id, name: teamData.name })
          setUserTeam({ id: teamData.id, name: teamData.name })
          setTeamStatus(teamData.status || '')
          setIsTeamLeader(teamData.leader_id === profileId)

          // If user is a leader, get pending requests count
          if (teamData.leader_id === profileId) {
            const { count } = await supabase
              .from('join_requests')
              .select('*', { count: 'exact', head: true })
              .eq('team_id', teamData.id)
            .eq('status', 'pending')

            setPendingRequestsCount(count || 0)
            console.log('Pending requests count for team:', teamData.id, count)
          }
        }
      } else {
        // Check if user is a leader without being a member
        const { data: teamData } = await supabase
          .from('teams')
          .select('id, name, status')
          .eq('leader_id', profileId)
          .single()

        if (teamData) {
          setUserTeam({ id: teamData.id, name: teamData.name })
          setTeamStatus(teamData.status || '')
          setIsTeamLeader(true)

          // Get pending requests count
          const { count } = await supabase
            .from('join_requests')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', teamData.id)
            .eq('status', 'pending')

          setPendingRequestsCount(count || 0)
          console.log('Pending requests count for leader team:', teamData.id, count)
        } else {
          setUserTeam(null)
          setIsTeamLeader(false)
          setTeamStatus('')
          setPendingRequestsCount(0)
        }
      }
    } catch (error) {
      setUserTeam(null)
      setIsTeamLeader(false)
      setTeamStatus('')
      setPendingRequestsCount(0)
    }
  }

  const loadStats = async () => {
    try {
      // Get active teams count
      const { count: teamsCount } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .in('status', ['recruiting', 'full', 'closed'])

      // Get total members count
      const { count: membersCount } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })

      setActiveTeamsCount(teamsCount || 0)
      setTotalMembers(membersCount || 0)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const calculateHackathonProgress = () => {
    // Hackathon starts: September 26, 2025 at 3:00 PM EST
    // Hackathon ends: September 28, 2025 at 6:00 PM EST
    const startDate = new Date('2025-09-26T15:00:00-04:00') // 3 PM EST
    const endDate = new Date('2025-09-28T18:00:00-04:00') // 6 PM EST
    const now = new Date()

    // If hackathon hasn't started yet
    if (now < startDate) {
      const timeUntilStart = startDate.getTime() - now.getTime()
      const days = Math.floor(timeUntilStart / (1000 * 60 * 60 * 24))
      const hours = Math.floor((timeUntilStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((timeUntilStart % (1000 * 60 * 60)) / (1000 * 60))

      return {
        timeRemaining: `Starts in ${days}d ${hours}h ${minutes}m`,
        percentage: 0
      }
    }

    // If hackathon has ended
    if (now > endDate) {
      return {
        timeRemaining: 'Hackathon Ended',
        percentage: 100
      }
    }

    // Hackathon is ongoing
    const totalDuration = endDate.getTime() - startDate.getTime()
    const elapsed = now.getTime() - startDate.getTime()
    const remaining = endDate.getTime() - now.getTime()

    const hours = Math.floor(remaining / (1000 * 60 * 60))
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000)

    const percentage = Math.round((elapsed / totalDuration) * 100)

    return {
      timeRemaining: `${hours}h ${minutes}m ${seconds}s`,
      percentage: percentage
    }
  }

  const refreshLiveActivities = async () => {
    setRefreshingActivities(true)
    try {
      const { data: activities, error: activitiesError } = await supabase.rpc('get_live_activity_feed', { p_limit: 15 })

      if (!activitiesError && activities) {
        setLiveActivityFeed(activities as unknown as ActivityFeedItem[])
      } else if (activitiesError) {
        console.error('Error refreshing activities:', activitiesError)
      }
    } catch (error) {
      console.error('Error refreshing activities:', error)
    } finally {
      setRefreshingActivities(false)
    }
  }

  const loadComprehensiveStatistics = async () => {
    setLoadingStats(true)
    try {
      // Get comprehensive statistics
      const { data: stats, error: statsError } = await supabase.rpc('get_hackathon_statistics')

      if (!statsError && stats) {
        const statistics = stats as unknown as HackathonStatistics
        setStatisticsData(statistics)
        // Update the basic counts too
        setActiveTeamsCount(statistics.active_teams || 0)
        setTotalMembers(statistics.total_members || 0)
      }

      // Get live activity feed
      const { data: activities, error: activitiesError } = await supabase.rpc('get_live_activity_feed', { p_limit: 15 })

      if (!activitiesError && activities) {
        setLiveActivityFeed(activities as unknown as ActivityFeedItem[])
        console.log('Live activities:', activities) // Debug to see what we get
      } else if (activitiesError) {
        console.error('Error loading activities:', activitiesError)
      }

      // Get skill supply vs demand analysis
      const { data: skillAnalysis, error: skillError } = await supabase.rpc('get_skill_supply_demand')

      if (!skillError && skillAnalysis) {
        setSkillSupplyDemand(skillAnalysis as unknown as SkillSupplyDemand)
      }

      // Calculate hackathon progress
      setHackathonProgress(calculateHackathonProgress())
    } catch (error) {
      console.error('Error loading comprehensive statistics:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  const handleLogin = async () => {
    if (!loginData.identifier || !loginData.secretCode) {
      setError('Please enter your phone/email and secret code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data: authResult, error: authError } = await (supabase.rpc as any)('login_with_secret', {
        p_identifier: loginData.identifier,
        p_secret_code: loginData.secretCode
      })

      if (authError) throw authError

      if (authResult && authResult.success) {
        const profile = authResult.profile
        sessionStorage.setItem('teamdock_profile_id', profile.id)
        sessionStorage.setItem('teamdock_user_name', profile.name)

        // Update current user state
        setCurrentUser({ id: profile.id, name: profile.name })
        checkUserTeam(profile.id)
        setShowAuthForm(null)
        setError('')

        // Show success message
        console.log('Login successful for:', profile.name)

        // Don't redirect - stay on home page
      } else {
        setError(authResult?.error || 'Invalid credentials')
      }
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const toggleSkill = (skill: string) => {
    setSignupData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }))
  }

  const handleSignup = async () => {
    if (authStep === 'credentials') {
      if (!signupData.name || !signupData.email || !signupData.phone || !signupData.secretCode || !signupData.confirmCode) {
        setError('Please fill in all required fields')
        return
      }

      if (signupData.secretCode !== signupData.confirmCode) {
        setError('Secret codes do not match')
        return
      }

      if (signupData.secretCode.length < 6 || signupData.secretCode.length > 12) {
        setError('Secret code must be 6-12 digits')
        return
      }

      if (!/^\d+$/.test(signupData.secretCode)) {
        setError('Secret code must contain only numbers')
        return
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupData.email)) {
        setError('Please enter a valid email address')
        return
      }

      setError('')
      setAuthStep('profile')
      return
    }

    if (signupData.skills.length === 0) {
      setError('Please select at least one skill')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data: profileId, error: profileError } = await (supabase.rpc as any)('create_profile', {
        p_name: signupData.name,
        p_email: signupData.email,
        p_phone: signupData.phone,
        p_secret_code: signupData.secretCode,
        p_proficiencies: signupData.skills
      })

      if (profileError) throw profileError

      if (profileId) {
        sessionStorage.setItem('teamdock_profile_id', profileId)
        sessionStorage.setItem('teamdock_user_name', signupData.name)

        // Update current user state
        setCurrentUser({ id: profileId, name: signupData.name })
        checkUserTeam(profileId)
        setShowAuthForm(null)
        setAuthStep('credentials')
        setSignupData({
          name: '',
          email: '',
          phone: '',
          secretCode: '',
          confirmCode: '',
          skills: []
        })

        // Don't redirect - stay on home page
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex overflow-hidden">
      {/* Bottom Navigation Bar for Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-black z-50 shadow-[0_-4px_6px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-around py-2">
          {/* Home */}
          <button
            onClick={() => {
              router.push('/')
              setCurrentView('home')
            }}
            className={`flex flex-col items-center px-3 py-1 transition-colors ${
              currentView === 'home'
                ? 'text-amber-500'
                : 'text-gray-600'
            }`}
          >
            <span className="text-xl mb-0.5">📜</span>
            <span className="text-xs font-bold">Scroll</span>
          </button>

          {/* Teams */}
          <button
            onClick={() => {
              router.push('/?view=browse-teams')
              setCurrentView('browse-teams')
            }}
            className={`flex flex-col items-center px-3 py-1 transition-colors ${
              currentView === 'browse-teams'
                ? 'text-amber-500'
                : 'text-gray-600'
            }`}
          >
            <span className="text-xl mb-0.5">👥</span>
            <span className="text-xs font-bold">Teams</span>
          </button>

          {/* Create/Manage */}
          {currentUser && (
            <button
              onClick={() => {
                if (userTeam) {
                  router.push('/?view=manage-team')
                  setCurrentView('manage-team')
                } else {
                  router.push('/?view=create-team')
                  setCurrentView('create-team')
                }
              }}
              className={`flex flex-col items-center px-3 py-1 transition-colors relative ${
                currentView === 'create-team' || currentView === 'manage-team'
                  ? 'text-amber-500'
                  : 'text-gray-600'
              }`}
            >
              <span className="text-xl mb-0.5">{userTeam ? '⚙️' : '➕'}</span>
              <span className="text-xs font-bold">{userTeam ? 'Manage' : 'Create'}</span>
              {isTeamLeader && pendingRequestsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          )}

          {/* Stats */}
          <button
            onClick={() => {
              router.push('/?view=statistics')
              setCurrentView('statistics')
            }}
            className={`flex flex-col items-center px-3 py-1 transition-colors ${
              currentView === 'statistics'
                ? 'text-amber-500'
                : 'text-gray-600'
            }`}
          >
            <span className="text-xl mb-0.5">📊</span>
            <span className="text-xs font-bold">Stats</span>
          </button>

          {/* Profile */}
          {currentUser ? (
            <button
              onClick={() => {
                router.push('/?view=profile')
                setCurrentView('profile')
              }}
              className={`flex flex-col items-center px-3 py-1 transition-colors ${
                currentView === 'profile'
                  ? 'text-amber-500'
                  : 'text-gray-600'
              }`}
            >
              <span className="text-xl mb-0.5">👤</span>
              <span className="text-xs font-bold">Profile</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setAuthModal(true)
                setAuthModalMode('login')
              }}
              className="flex flex-col items-center px-3 py-1 text-gray-600 transition-colors"
            >
              <span className="text-xl mb-0.5">🔑</span>
              <span className="text-xs font-bold">Login</span>
            </button>
          )}
        </div>
      </nav>

      {/* Left Sidebar - Desktop Only */}
      <aside className="hidden lg:flex w-64 bg-black text-white h-screen fixed top-0 left-0 flex-col border-r-4 border-amber-500 z-40">
        {/* Logo */}
        <div className="p-4 border-b-2 border-amber-500/30">
          <h1 className="text-2xl lg:text-3xl font-black">
            TEAMDOCK
          </h1>
          <p className="text-xs text-amber-400 mt-1">Hackathon Team Formation</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => {
              router.push('/')
              setCurrentView('home')
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-colors font-medium ${
              currentView === 'home'
                ? 'bg-amber-500/20 text-amber-400'
                : 'hover:bg-amber-500/20 text-gray-300 hover:text-amber-400'
            }`}
          >
            <span>📜</span>
            <span className="text-sm">The Scroll</span>
          </button>

          {/* Statistics - Available for Everyone */}
          <button
            onClick={() => {
              router.push('/?view=statistics')
              setCurrentView('statistics')
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-colors font-medium ${
              currentView === 'statistics'
                ? 'bg-amber-500/20 text-amber-400'
                : 'hover:bg-amber-500/20 text-gray-300 hover:text-amber-400'
            }`}
          >
            <span>📊</span>
            <span className="text-sm">Statistics</span>
          </button>

          {/* My Profile - User Profile Management */}
          {currentUser && (
            <button
              onClick={() => {
                router.push('/?view=profile')
                setCurrentView('profile')
                }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded transition-colors font-medium hover:bg-amber-500/20 text-gray-300 hover:text-amber-400"
            >
              <span>👤</span>
              <span className="text-sm">My Profile</span>
            </button>
          )}

          {hasPendingRequest && (
            <Link
              href="/request-status"
              className="flex items-center gap-2 px-2 py-1.5 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors font-medium"
            >
              <span>⏳</span>
              <span className="text-sm">Pending Request</span>
            </Link>
          )}

          <div className="pt-4 mt-4 border-t border-amber-500/30">
            <p className="px-3 text-xs text-amber-400 uppercase tracking-wider mb-2 font-bold">Teams</p>

            {currentUser && (
              <>
                <button
                  onClick={() => {
                    router.push('/?view=browse-teams')
                    setCurrentView('browse-teams')
                        }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-colors font-medium ${
                    currentView === 'browse-teams'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'hover:bg-amber-500/20 text-gray-300 hover:text-amber-400'
                  }`}
                >
                  <span>🤝</span>
                  <span className="text-sm">Browse Teams</span>
                </button>

                {/* Show Manage/View Team for team members, Create Team for users without teams */}
                {userTeam ? (
                  <button
                    onClick={() => {
                      router.push('/?view=manage-team')
                      setCurrentView('manage-team')
                            }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-colors font-medium ${
                      currentView === 'manage-team'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'hover:bg-amber-500/20 text-gray-300 hover:text-amber-400'
                    }`}
                  >
                    <span>{isTeamLeader ? '⚙️' : '👁️'}</span>
                    <span className="text-sm">{isTeamLeader ? 'Manage Team' : 'View Team'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      router.push('/?view=create-team')
                      setCurrentView('create-team')
                            }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-colors font-medium ${
                      currentView === 'create-team'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'hover:bg-amber-500/20 text-gray-300 hover:text-amber-400'
                    }`}
                  >
                    <span>✨</span>
                    <span className="text-sm">Create Team</span>
                  </button>
                )}

                {/* Join Requests - visible for team leaders until team is full */}
                {isTeamLeader && teamStatus !== 'full' && teamStatus !== 'closed' && (
                  <button
                    onClick={() => {
                      router.push('/?view=join-requests')
                      setCurrentView('join-requests')
                            }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-colors font-medium relative ${
                      currentView === 'join-requests'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'hover:bg-amber-500/20 text-gray-300 hover:text-amber-400'
                    }`}
                  >
                    <span>📋</span>
                    <span className="text-sm">Join Requests</span>
                    {pendingRequestsCount > 0 && (
                      <span className="absolute right-3 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {pendingRequestsCount}
                      </span>
                    )}
                  </button>
                )}
              </>
            )}

            {!currentUser && (
              <button
                onClick={() => {
                  router.push('/?view=browse-teams')
                  setCurrentView('browse-teams')
                    }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-colors font-medium ${
                  currentView === 'browse-teams'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'hover:bg-amber-500/20 text-gray-300 hover:text-amber-400'
                }`}
              >
                <span>🤝</span>
                <span className="text-sm">Browse Teams</span>
              </button>
            )}
          </div>
        </nav>

        {/* Profile Section */}
        <div className="p-4 border-t border-amber-500/30 relative">
          <AnimatePresence mode="wait">
            {currentUser ? (
              // Logged in state
              <motion.div
                key="profile"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500 rounded flex items-center justify-center text-black font-black">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-bold">{currentUser.name}</p>
                    <p className="text-amber-400 text-xs">
                      {userTeam ? (
                        <span className="flex items-center gap-1">
                          <span>👥</span> {userTeam.name}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <span>🚀</span> Solo Hacker
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    sessionStorage.clear()
                    setCurrentUser(null)
                    setUserTeam(null)
                    router.push('/')
                  }}
                  className="w-full py-2 px-3 bg-white text-black font-bold border-2 border-white hover:bg-gray-100 text-sm rounded transition-colors"
                >
                  Logout
                </button>
              </motion.div>
            ) : !showAuthForm ? (
              <motion.div
                key="buttons"
                initial={{ y: 0 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex gap-2"
              >
                <button
                  onClick={() => {
                    setShowAuthForm('signup')
                    setAuthStep('credentials')
                    setError('')
                  }}
                  className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-black text-sm font-bold rounded transition-colors"
                >
                  Signup
                </button>
                <button
                  onClick={() => {
                    setShowAuthForm('login')
                    setError('')
                  }}
                  className="flex-1 py-2 px-3 bg-white text-black font-bold border-2 border-white hover:bg-gray-100 text-sm rounded transition-colors"
                >
                  Login
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
              >
                {/* Close button */}
                <button
                  onClick={() => {
                    setShowAuthForm(null)
                    setError('')
                    setAuthStep('credentials')
                  }}
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-300"
                >
                  ✕
                </button>

                <h3 className="text-white font-semibold text-sm">
                  {showAuthForm === 'login' ? 'Login' : authStep === 'credentials' ? 'Sign Up' : 'Select Skills'}
                </h3>

                {error && (
                  <div className="p-2 bg-red-900/50 border-2 border-red-500 text-red-300 rounded text-xs font-bold">
                    {error}
                  </div>
                )}

                {showAuthForm === 'login' ? (
                  <>
                    {/* Discord Login Button */}
                    <button
                      onClick={() => window.location.href = '/api/auth/discord'}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded text-sm transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.157 2.419 0 1.3332-.9555 2.4189-2.1571 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1569 2.419 0 1.3332-.9554 2.4189-2.1569 2.4189Z"/>
                      </svg>
                      Login with Discord
                    </button>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-700"></div>
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="px-2 bg-black text-gray-500">or</span>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={loginData.identifier}
                      onChange={(e) => setLoginData({ ...loginData, identifier: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border-2 border-amber-500/30 text-white rounded text-sm focus:outline-none focus:border-amber-500 placeholder-gray-500"
                      placeholder="Phone or Email"
                    />
                    <input
                      type="password"
                      value={loginData.secretCode}
                      onChange={(e) => setLoginData({ ...loginData, secretCode: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border-2 border-amber-500/30 text-white rounded text-sm focus:outline-none focus:border-amber-500 placeholder-gray-500"
                      placeholder="Secret Code"
                      maxLength={12}
                    />
                    <button
                      onClick={handleLogin}
                      disabled={loading}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded text-sm transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Logging in...' : 'Login'}
                    </button>
                  </>
                ) : (
                  <>
                    {authStep === 'credentials' ? (
                      <>
                        {/* Discord Signup Button */}
                        <button
                          onClick={() => window.location.href = '/api/auth/discord'}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded text-sm transition-colors"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.157 2.419 0 1.3332-.9555 2.4189-2.1571 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1569 2.419 0 1.3332-.9554 2.4189-2.1569 2.4189Z"/>
                          </svg>
                          Sign up with Discord
                        </button>
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-700"></div>
                          </div>
                          <div className="relative flex justify-center text-xs">
                            <span className="px-2 bg-black text-gray-500">or</span>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={signupData.name}
                          onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-900 border-2 border-amber-500/30 text-white rounded text-sm focus:outline-none focus:border-amber-500 placeholder-gray-500"
                          placeholder="Full Name *"
                        />
                        <input
                          type="email"
                          value={signupData.email}
                          onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-900 border-2 border-amber-500/30 text-white rounded text-sm focus:outline-none focus:border-amber-500 placeholder-gray-500"
                          placeholder="Email *"
                        />
                        <input
                          type="tel"
                          value={signupData.phone}
                          onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-900 border-2 border-amber-500/30 text-white rounded text-sm focus:outline-none focus:border-amber-500 placeholder-gray-500"
                          placeholder="Phone *"
                        />
                        <input
                          type="password"
                          value={signupData.secretCode}
                          onChange={(e) => setSignupData({ ...signupData, secretCode: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-900 border-2 border-amber-500/30 text-white rounded text-sm focus:outline-none focus:border-amber-500 placeholder-gray-500"
                          placeholder="Create Secret Code (6-12 digits) *"
                          maxLength={12}
                        />
                        <input
                          type="password"
                          value={signupData.confirmCode}
                          onChange={(e) => setSignupData({ ...signupData, confirmCode: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-900 border-2 border-amber-500/30 text-white rounded text-sm focus:outline-none focus:border-amber-500 placeholder-gray-500"
                          placeholder="Confirm Secret Code *"
                          maxLength={12}
                        />
                        <button
                          onClick={handleSignup}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded text-sm transition-colors"
                        >
                          Next: Select Skills
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="max-h-40 overflow-y-auto">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {availableSkills.map((skill) => (
                              <button
                                key={skill}
                                onClick={() => toggleSkill(skill)}
                                className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                                  signupData.skills.includes(skill)
                                    ? 'bg-amber-500 text-black border-2 border-amber-500'
                                    : 'bg-gray-900 text-gray-400 border-2 border-gray-700 hover:border-amber-500/50'
                                }`}
                              >
                                {skill}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setAuthStep('credentials')}
                            className="flex-1 py-2 bg-gray-800 text-gray-300 font-bold rounded text-sm hover:bg-gray-700 border-2 border-gray-700"
                          >
                            Back
                          </button>
                          <button
                            onClick={handleSignup}
                            disabled={loading}
                            className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded text-sm transition-colors disabled:opacity-50"
                          >
                            {loading ? 'Creating...' : 'Create'}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* Main Content - Responsive margin and padding for bottom nav */}
      <div className="flex-1 flex flex-col lg:ml-64 h-screen pb-16 lg:pb-0">
        {/* Header Bar - Dynamic based on current view */}
        <header className="bg-white border-b-2 border-black px-4 lg:px-6 py-4 flex-shrink-0 relative z-20 shadow-[0_4px_6px_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between">
            {/* TD Logo on far left */}
            <div className="flex items-center">
              <span className="text-xl lg:text-2xl font-black text-amber-500 border-2 border-amber-500 px-2.5 py-1 bg-black shadow-[2px_2px_0px_rgba(245,158,11,1)]">TD</span>
            </div>

            {/* Centered page name */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <h2 className="text-lg lg:text-xl font-black text-black text-center">
                {currentView === 'home' && 'THE SCROLL'}
                {currentView === 'profile' && 'MY PROFILE'}
                {currentView === 'statistics' && 'STATISTICS'}
                {currentView === 'browse-teams' && 'BROWSE TEAMS'}
                {currentView === 'create-team' && 'CREATE TEAM'}
                {currentView === 'join-requests' && 'JOIN REQUESTS'}
                {currentView === 'manage-team' && 'MANAGE TEAM'}
              </h2>
            </div>

            {/* ShellHacks on the right with 2025 below */}
            <div className="flex flex-col items-end">
              <span className="text-sm lg:text-base font-bold text-black">ShellHacks</span>
              <span className="text-xs lg:text-sm font-bold text-amber-500">2025</span>
            </div>
          </div>
        </header>

        {/* Center message below header for The Scroll and Statistics */}
        {currentView === 'home' && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
            <div className="text-center">
              <p className="text-sm lg:text-base font-bold text-gray-800">
                    {currentUser ? (
                      <>🚀 Yo {currentUser.name.split(' ')[0]}! Here's the tea ☕ from the hackathon streets</>
                    ) : (
                      <span className="inline-block">
                        <motion.span
                          key={flipText ? 'text1' : 'text2'}
                          initial={{ y: 30, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -30, opacity: 0 }}
                          transition={{ duration: 0.5 }}
                          className="block"
                        >
                          {flipText ? (
                            <>👀 Psst... stranger! Here's what the cool kids are building</>
                          ) : (
                            <>🎯 Join now to stay connected and updated. It takes 5 sec!</>
                          )}
                        </motion.span>
                      </span>
                    )}
              </p>
            </div>
          </div>
        )}

        {currentView === 'statistics' && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2">
            <p className="text-xs lg:text-sm font-bold text-red-600 text-center">
              ⚠️ The data in TeamDock is based on user activity and may not be completely reliable
            </p>
          </div>
        )}

        {currentView === 'browse-teams' && !currentUser && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
            <p className="text-xs lg:text-sm font-bold text-amber-600 text-center">
              🕵️ Hold up there, mystery hacker! Login to crash the party and find your coding crew! 🎉
            </p>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative z-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
            <AnimatePresence mode="wait">
              {currentView === 'home' && (
                <motion.div
                  key="home"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <TeamFeed
                    isUserLoggedIn={!!currentUser}
                    currentUser={currentUser}
                  />
                </motion.div>
              )}

              {currentView === 'profile' && currentUser && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <TeamDashboard profileId={currentUser.id} userName={currentUser.name} />
                </motion.div>
              )}

              {currentView === 'browse-teams' && (
                <JoinTeamView currentUser={currentUser} isTeamLeader={isTeamLeader} userTeam={userTeam} />
              )}

              {currentView === 'create-team' && currentUser && (
                <CreateTeamView
                  profileId={currentUser.id}
                  profileName={currentUser.name}
                  onTeamCreated={() => {
                    // Refresh user data after team creation
                    const checkUserTeam = async () => {
                      const { data: memberData } = await supabase
                        .from('team_members')
                        .select('team_id, teams(id, name, leader_id)')
                        .eq('profile_id', currentUser.id)
                        .single()

                      if (memberData?.teams) {
                        setUserTeam(memberData.teams as any)
                        setIsTeamLeader(memberData.teams.leader_id === currentUser.id)
                        setCurrentView('manage-team')
                      }
                    }
                    checkUserTeam()
                  }}
                />
              )}

              {currentView === 'join-requests' && currentUser && userTeam && isTeamLeader && (
                <motion.div
                  key="join-requests"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <JoinRequestsView
                    profileId={currentUser.id}
                    teamId={userTeam.id || ''}
                    teamName={userTeam.name || 'Your Team'}
                    isLeader={isTeamLeader}
                  />
                </motion.div>
              )}

              {currentView === 'manage-team' && currentUser && userTeam && (
                <motion.div
                  key="manage-team"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <ManageTeam
                    profileId={currentUser.id}
                    teamId={userTeam.id || ''}
                    isLeader={isTeamLeader}
                  />
                </motion.div>
              )}

              {currentView === 'statistics' && (
                <motion.div
                  key="statistics"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {loadingStats ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
                        <p className="text-gray-600 font-bold">Loading statistics...</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Live Stats Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white border-2 border-black p-4 md:p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-3xl">🔥</span>
                            <div className="flex items-center gap-2">
                              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                              <span className="text-xs bg-green-400 text-black px-2 py-1 rounded font-bold">LIVE</span>
                            </div>
                          </div>
                          <p className="text-2xl md:text-4xl font-black text-amber-500">{statisticsData?.active_teams || activeTeamsCount}</p>
                          <p className="text-sm font-bold text-gray-700 mt-1">ACTIVE TEAMS</p>
                        </div>

                        <div className="bg-white border-2 border-black p-4 md:p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-3xl">👥</span>
                            <div className="flex items-center gap-2">
                              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                              <span className="text-xs bg-amber-400 text-black px-2 py-1 rounded font-bold">GROWING</span>
                            </div>
                          </div>
                          <p className="text-2xl md:text-4xl font-black text-amber-500">{statisticsData?.total_members || totalMembers}</p>
                          <p className="text-sm font-bold text-gray-700 mt-1">TOTAL HACKERS</p>
                        </div>
                      </div>

                  {/* Hackathon Progress */}
                  <div className="bg-white border-2 border-black p-4 md:p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                    <h3 className="text-xl font-black text-black mb-4">🏁 HACKATHON PROGRESS</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-gray-700">
                            {hackathonProgress.percentage === 0 ? 'Countdown' :
                             hackathonProgress.percentage === 100 ? 'Status' : 'Time Remaining'}
                          </span>
                          <span className={`text-sm font-black ${
                            hackathonProgress.percentage === 100 ? 'text-red-600' : 'text-amber-500'
                          }`}>
                            {hackathonProgress.timeRemaining}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-4 border border-black overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${
                              hackathonProgress.percentage === 100 ? 'bg-green-500' :
                              hackathonProgress.percentage === 0 ? 'bg-gray-400' : 'bg-amber-500'
                            }`}
                            style={{width: `${hackathonProgress.percentage}%`}}
                          ></div>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-gray-600 font-medium">Sept 26, 3PM EST</span>
                          <span className="text-xs font-bold text-amber-600">{hackathonProgress.percentage}% Complete</span>
                          <span className="text-xs text-gray-600 font-medium">Sept 28, 6PM EST</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div className="text-center p-3 bg-amber-50 border border-amber-300 relative">
                          <span className="absolute top-2 right-2 inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                          <p className="text-2xl font-black text-amber-600">{statisticsData?.teams_recruiting || 0}</p>
                          <p className="text-xs font-bold text-gray-600">TEAMS RECRUITING</p>
                        </div>
                        <div className="text-center p-3 bg-green-50 border border-green-300 relative">
                          <span className="absolute top-2 right-2 inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                          <p className="text-2xl font-black text-green-600">{statisticsData?.teams_locked || 0}</p>
                          <p className="text-xs font-bold text-gray-600">TEAMS LOCKED</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Skill Supply vs Demand Board */}
                  <div className="bg-white border-2 border-black p-4 md:p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                    <h3 className="text-xl font-black text-black mb-4">🔥 SKILL MARKET BOARD</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:divide-x-2 md:divide-black">
                      {/* High Demand Column */}
                      <div className="md:pr-6">
                        <h4 className="text-sm font-black text-red-600 mb-3 pb-2 border-b-2 border-red-300">
                          🚨 HIGH IN DEMAND
                        </h4>
                        <div className="space-y-2">
                          {skillSupplyDemand?.high_demand_skills && skillSupplyDemand.high_demand_skills.length > 0 ? (
                            skillSupplyDemand.high_demand_skills
                              .sort((a, b) => {
                                // First priority: CRITICAL skills (zero supply) at the top
                                if (a.status === 'CRITICAL_NEED' && b.status !== 'CRITICAL_NEED') return -1
                                if (b.status === 'CRITICAL_NEED' && a.status !== 'CRITICAL_NEED') return 1

                                // Second priority: Sort by gap (needed - available) in descending order
                                const gapA = (a.needed || 0) - (a.available || 0)
                                const gapB = (b.needed || 0) - (b.available || 0)
                                return gapB - gapA // Biggest gap first
                              })
                              .slice(0, 5)
                              .map((skill, index) => {
                              const supplyPercentage = skill.needed > 0 ? Math.min((skill.available / skill.needed) * 100, 100) : 0
                              const isCritical = skill.status === 'CRITICAL_NEED'
                              const isHighDemand = skill.status === 'HIGH_DEMAND'

                              return (
                                <div key={skill.skill} className="flex items-center gap-2">
                                  <span className="font-black text-lg text-amber-600 w-6">{index + 1}.</span>
                                  <div className="flex-1 p-2 bg-red-50 border-l-4 border-red-500">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-bold text-sm text-gray-800">{skill.skill}</span>
                                      <div className="flex items-center gap-2">
                                        {isCritical && (
                                          <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-black rounded animate-pulse">
                                            🔥 CRITICAL
                                          </span>
                                        )}
                                        {!isCritical && isHighDemand && (
                                          <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-black rounded">
                                            HIGH DEMAND
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                      <div
                                        className={`h-3 rounded-full transition-all duration-500 ${
                                          supplyPercentage < 25 ? 'bg-red-600' :
                                          supplyPercentage < 50 ? 'bg-orange-500' :
                                          supplyPercentage < 75 ? 'bg-yellow-500' : 'bg-green-500'
                                        }`}
                                        style={{ width: `${supplyPercentage}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )
                            })
                          ) : (
                            <div className="text-center text-gray-400 py-8 bg-gray-50 rounded">
                              No high demand skills yet
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Over Supplied Column */}
                      <div className="md:pl-6">
                        <h4 className="text-sm font-black text-green-600 mb-3 pb-2 border-b-2 border-green-300">
                          ✅ SUFFICIENT
                        </h4>
                        <div className="space-y-2">
                          {skillSupplyDemand?.oversupplied_skills && skillSupplyDemand.oversupplied_skills.length > 0 ? (
                            skillSupplyDemand.oversupplied_skills.slice(0, 5).map((skill, index) => {
                              return (
                                <div key={skill.skill} className="flex items-center gap-2">
                                  <span className="font-black text-lg text-amber-600 w-6">{index + 1}.</span>
                                  <div className="flex-1 p-2 bg-green-50 border-l-4 border-green-500">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-bold text-sm text-gray-800">{skill.skill}</span>
                                      <span className="px-1.5 py-0.5 bg-green-600 text-white text-[10px] font-black rounded">
                                        WE HAVE {skill.available}
                                      </span>
                                    </div>
                                    <div className="w-full bg-green-200 rounded-full h-3 overflow-hidden">
                                      <div
                                        className="h-3 bg-green-600 rounded-full transition-all duration-500"
                                        style={{ width: '100%' }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )
                            })
                          ) : (
                            <div className="text-center text-gray-400 py-8 bg-gray-50 rounded">
                              No oversupplied skills yet
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Summary Stats */}
                    {skillSupplyDemand?.summary && (
                      <div className="mt-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-4 border-t-2 border-gray-300">
                          <div className="text-center p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-300">
                            <p className="text-xl font-black text-blue-600">
                              {skillSupplyDemand.summary.total_skills_in_demand}
                            </p>
                            <p className="text-[10px] text-blue-700 font-black uppercase">Skills Needed</p>
                          </div>
                          <div className="text-center p-2 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-300">
                            <p className="text-xl font-black text-green-600">
                              {skillSupplyDemand.summary.total_skills_available}
                            </p>
                            <p className="text-[10px] text-green-700 font-black uppercase">Skills Available</p>
                          </div>
                          <div className="text-center p-2 bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-300">
                            <p className="text-xl font-black text-red-600">
                              {skillSupplyDemand.summary.critical_gaps}
                            </p>
                            <p className="text-[10px] text-red-700 font-black uppercase">Critical Gaps</p>
                            {skillSupplyDemand.summary.critical_gaps > 0 && (
                              <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse mt-1"></span>
                            )}
                          </div>
                          <div className="text-center p-2 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-300">
                            <p className="text-xl font-black text-orange-600">
                              {skillSupplyDemand.summary.high_demand_count}
                            </p>
                            <p className="text-[10px] text-orange-700 font-black uppercase">High Demand</p>
                          </div>
                        </div>

                        {/* Live indicator */}
                        <div className="mt-3 text-center">
                          <span className="text-xs text-gray-500">
                            <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                            Live updates enabled • Data syncs automatically
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recent Activity Feed */}
                  <div className="bg-white border-2 border-black p-4 md:p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-black text-black">📢 LIVE ACTIVITY</h3>
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <span className="text-xs font-bold text-green-600">REAL-TIME</span>
                      </div>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {liveActivityFeed && liveActivityFeed.length > 0 ? (
                        liveActivityFeed.map((activity, index) => {
                          // Color based on activity type
                          const getActivityColor = (type: string) => {
                            switch (type) {
                              case 'member_signup': return 'bg-green-50 border-green-500'
                              case 'member_joined': return 'bg-blue-50 border-blue-500'
                              case 'member_left': return 'bg-red-50 border-red-500'
                              case 'team_post': return 'bg-amber-50 border-amber-500'
                              case 'team_created': return 'bg-purple-50 border-purple-500'
                              case 'team_locked': return 'bg-indigo-50 border-indigo-500'
                              default: return 'bg-gray-50 border-gray-500'
                            }
                          }
                          const colors = getActivityColor(activity.type)

                          return (
                            <div key={`${activity.type}-${index}`} className={`flex items-start gap-3 p-3 ${colors.split(' ')[0]} border-l-4 ${colors.split(' ')[1]}`}>
                              <span className="text-lg">{activity.data?.icon || '📣'}</span>
                              <div className="flex-1">
                                <p className="text-sm font-bold text-gray-800">
                                  {activity.data?.message}
                                </p>
                                {/* Member Signup - Show Skills */}
                                {activity.type === 'member_signup' && activity.data?.skills && activity.data.skills.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {activity.data.skills.slice(0, 3).map((skill: string) => (
                                      <span key={skill} className="text-[10px] px-1 py-0.5 bg-black/10 rounded">
                                        {skill}
                                      </span>
                                    ))}
                                    {activity.data.skills.length > 3 && (
                                      <span className="text-[10px] px-1 py-0.5 bg-black/10 rounded">
                                        +{activity.data.skills.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Member Joined - Show Role */}
                                {activity.type === 'member_joined' && activity.data?.role && (
                                  <div className="mt-1">
                                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                                      {activity.data.role}
                                    </span>
                                  </div>
                                )}

                                {/* Team Post - Show Content Preview */}
                                {activity.type === 'team_post' && activity.data?.content_preview && (
                                  <p className="text-[11px] text-gray-600 mt-1 italic">
                                    "{activity.data.content_preview}"
                                  </p>
                                )}

                                {/* Team Created - Show Looking For */}
                                {activity.type === 'team_created' && activity.data?.looking_for && activity.data.looking_for.length > 0 && (
                                  <p className="text-[11px] text-gray-600 mt-0.5">
                                    Looking for: {activity.data.looking_for.slice(0, 2).join(', ')}
                                    {activity.data.looking_for.length > 2 && ` +${activity.data.looking_for.length - 2} more`}
                                  </p>
                                )}

                                {/* Team Locked/Full - Show Member Count */}
                                {activity.type === 'team_locked' && activity.data?.member_count && (
                                  <div className="mt-1">
                                    <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-medium">
                                      {activity.data.member_count} members
                                    </span>
                                  </div>
                                )}

                                <p className="text-xs text-gray-500 mt-1">{activity.data?.time_ago}</p>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <>
                          <div className="flex items-start gap-3 p-3 bg-amber-50 border-l-4 border-amber-500">
                            <span className="text-lg">🚀</span>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-gray-800">Waiting for hackers to join!</p>
                              <p className="text-xs text-gray-600">Be the first to sign up</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Floating Post Button */}
      {currentView === 'home' && currentUser && (
        <button
          onClick={() => setShowPostModal(true)}
          className="fixed bottom-20 right-2 lg:bottom-8 lg:right-8 bg-amber-500 hover:bg-amber-600 text-black px-3 py-2 lg:px-6 lg:py-4 rounded-full font-black shadow-2xl hover:scale-110 transition-all duration-300 hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] border-2 border-black z-40 group"
        >
          <div className="flex items-center gap-1 lg:gap-2">
            <span className="text-lg lg:text-2xl">📣</span>
            <div className="hidden sm:flex flex-col items-start">
              <span className="text-sm lg:text-base">Don't be an introvert!</span>
              <span className="text-xs opacity-90">Share your progress →</span>
            </div>
            <span className="sm:hidden text-xs">Post</span>
          </div>

          {/* Pulsing ring animation */}
          <div className="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-20"></div>
        </button>
      )}

      {/* Post Creation Modal */}
      {currentUser && (
        <PostCreationModal
          isOpen={showPostModal}
          onClose={() => setShowPostModal(false)}
          profileId={currentUser.id}
          userName={currentUser.name}
          onPostCreated={() => {
            // Refresh the feed
            if (currentView === 'home') {
              window.location.reload()
            }
          }}
        />
      )}

      {/* Auth Modal */}
      {authModal && (
        <AuthModal
          isOpen={authModal}
          onClose={() => setAuthModal(false)}
          mode={authModalMode}
        />
      )}

    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>}>
      <HomePageContent />
    </Suspense>
  )
}
