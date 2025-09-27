'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { Howl } from 'howler'

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
  }
}

type JoinRequest = {
  id: string
  requester_id: string
  requested_role: string
  message: string | null
  status: string
  requested_at: string
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
}

export default function ManageTeamPage() {
  const router = useRouter()
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

  // Sound notification
  const notificationSound = typeof window !== 'undefined' ? new Howl({
    src: ['data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'],
    volume: 0.5,
  }) : null

  useEffect(() => {
    // Check if already authenticated
    const storedProfileId = sessionStorage.getItem('profileId')
    if (storedProfileId) {
      setProfileId(storedProfileId)
      setAuthModal(false)
      loadTeamData(storedProfileId)
    } else {
      setLoading(false)
    }
  }, [])

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
      const { data, error } = await supabase.rpc('login_with_secret', {
        p_identifier: authData.identifier,
        p_secret_code: authData.secretCode
      })

      if (error) throw error

      if (data) {
        sessionStorage.setItem('profileId', data)
        setProfileId(data)
        setAuthModal(false)
        await loadTeamData(data)
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
          // No team found
          router.push('/')
          return
        }

        setTeam(teamData)
        setIsLeader(true)
        await loadTeamMembers(teamData.id)
        await loadJoinRequests(teamData.id)
      } else {
        // Load team data
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('*')
          .eq('id', memberData.team_id)
          .single()

        if (teamError) throw teamError

        setTeam(teamData)
        setIsLeader(teamData.leader_id === userId)
        await loadTeamMembers(teamData.id)
        if (teamData.leader_id === userId) {
          await loadJoinRequests(teamData.id)
        }
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
          proficiencies
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
        requester:profiles!join_requests_requester_id_fkey(
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
      const { error } = await supabase.rpc('respond_to_request', {
        p_leader_id: profileId,
        p_request_id: requestId,
        p_accepted: accept
      })

      if (error) throw error

      await loadJoinRequests(team!.id)
      if (accept) {
        await loadTeamMembers(team!.id)
      }
    } catch (error) {
      console.error('Error handling join request:', error)
    }
  }

  const handleLeaveTeam = async () => {
    if (!confirm('Are you sure you want to leave this team?')) return

    try {
      const { error } = await supabase.rpc('leave_team', {
        p_member_id: profileId
      })

      if (error) throw error

      router.push('/')
    } catch (error) {
      console.error('Error leaving team:', error)
    }
  }

  const handleDisbandTeam = async () => {
    if (!confirm('Are you sure you want to disband this team? This action cannot be undone.')) return

    try {
      const { error } = await supabase.rpc('disband_team', {
        p_leader_id: profileId
      })

      if (error) throw error

      router.push('/')
    } catch (error) {
      console.error('Error disbanding team:', error)
    }
  }

  if (authModal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl shadow-xl max-w-md w-full p-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Access Your Team ⚡
          </h1>
          <p className="text-gray-600 mb-6">
            Enter your credentials to manage your team
          </p>

          {authError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {authError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email or Phone
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                value={authData.identifier}
                onChange={(e) => setAuthData({...authData, identifier: e.target.value})}
                placeholder="email@example.com or +1234567890"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Secret Code (6-12 digits)
              </label>
              <input
                type="password"
                maxLength={12}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                value={authData.secretCode}
                onChange={(e) => setAuthData({...authData, secretCode: e.target.value})}
                placeholder="Enter your secret code"
                onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
              />
            </div>
          </div>

          <button
            onClick={handleAuth}
            className="mt-6 w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white py-3 px-6 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Access Team Dashboard
          </button>

          <Link href="/" className="mt-4 block text-center text-gray-600 hover:text-gray-900">
            ← Back to Home
          </Link>
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
            ← Back to Home
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                {team.name}
              </h1>
              <p className="text-gray-600 mt-2">
                {team.description}
              </p>
              <div className="flex items-center gap-4 mt-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  team.status === 'forming' ? 'bg-green-100 text-green-700' :
                  team.status === 'locked' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {team.status.charAt(0).toUpperCase() + team.status.slice(1)}
                </span>
                {isLeader && (
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                    👑 Team Leader
                  </span>
                )}
                <div className="flex items-center text-sm text-green-600">
                  <span className="animate-pulse mr-2 h-2 w-2 bg-green-500 rounded-full"></span>
                  Real-time Updates Active
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('members')}
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
              onClick={() => setActiveTab('requests')}
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
            onClick={() => setActiveTab('settings')}
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
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Team Members</h2>
              {members.length === 0 ? (
                <p className="text-gray-600">No team members yet. Start recruiting!</p>
              ) : (
                <div className="space-y-4">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {member.profile.name}
                          </h3>
                          {team.leader_id === member.profile_id && (
                            <span className="text-amber-600">👑</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{member.role}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {member.profile.proficiencies.map((skill) => (
                            <span key={skill} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                      {isLeader && team.leader_id === member.profile_id && (
                        <div className="flex gap-2">
                          {member.profile.email && (
                            <a
                              href={`mailto:${member.profile.email}`}
                              className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                            >
                              Email
                            </a>
                          )}
                          {member.profile.phone && (
                            <a
                              href={`https://wa.me/${member.profile.phone.replace(/\D/g, '')}`}
                              className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                            >
                              WhatsApp
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'requests' && isLeader && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Join Requests</h2>
              {joinRequests.length === 0 ? (
                <p className="text-gray-600">No pending join requests</p>
              ) : (
                <div className="space-y-4">
                  {joinRequests.map((request) => (
                    <div key={request.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between">
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
                        <div className="flex gap-2 ml-4">
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
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Team Settings</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Tech Stack</h3>
                  <div className="flex flex-wrap gap-2">
                    {team.tech_stack.length === 0 ? (
                      <span className="text-gray-600">No tech stack specified</span>
                    ) : (
                      team.tech_stack.map((tech) => (
                        <span key={tech} className="px-3 py-1 bg-green-100 text-green-700 rounded">
                          {tech}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Looking For</h3>
                  <div className="flex flex-wrap gap-2">
                    {team.looking_for_roles.map((role) => (
                      <span key={role} className="px-3 py-1 bg-purple-100 text-purple-700 rounded">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Danger Zone</h3>
                  {isLeader ? (
                    <button
                      onClick={handleDisbandTeam}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                    >
                      Disband Team
                    </button>
                  ) : (
                    <button
                      onClick={handleLeaveTeam}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                    >
                      Leave Team
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}