'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { Howl } from 'howler'
import VotingModal from '@/components/voting/VotingModal'
import UserStatus, { StatusIndicator } from '@/components/UserStatus'
import { playJoinSound, playAlertSound, playSuccessSound, playNotificationSound } from '@/lib/utils/soundManager'

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
    user_status?: 'available' | 'busy' | 'break' | 'offline'
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

interface TeamDashboardProps {
  profileId: string
  userName: string
}

export default function TeamDashboard({ profileId, userName }: TeamDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [isLeader, setIsLeader] = useState(false)
  const [showVotingModal, setShowVotingModal] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({
    email: '',
    phone: '',
    secret_code: '',
    proficiencies: [] as string[]
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadTeamData()
    loadUserProfile()
  }, [profileId])

  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single()

      if (data) {
        setUserProfile(data)
        setProfileForm({
          email: data.email || '',
          phone: data.phone || '',
          secret_code: data.secret_code || '',
          proficiencies: data.proficiencies || []
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    }
  }

  // Format phone number as user types
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const phoneNumber = value.replace(/\D/g, '')

    // Format as XXX-XXX-XXXX
    if (phoneNumber.length <= 3) {
      return phoneNumber
    } else if (phoneNumber.length <= 6) {
      return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`
    } else {
      return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
    }
  }

  // Validate email format
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Validate phone number (10 digits)
  const validatePhone = (phone: string) => {
    const digitsOnly = phone.replace(/\D/g, '')
    return digitsOnly.length === 10
  }

  const handleSaveProfile = async () => {
    // Check if phone number is missing
    if (!profileForm.phone || profileForm.phone.trim() === '') {
      alert('📱 Please add your phone number so your team can reach you! This helps with quick coordination during the hackathon.')
      return
    }

    // Validate phone number format
    if (!validatePhone(profileForm.phone)) {
      alert('📱 Please enter a valid 10-digit phone number (e.g., 571-842-2187)')
      return
    }

    // Validate email if provided
    if (profileForm.email && !validateEmail(profileForm.email)) {
      alert('📧 Please enter a valid email address')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          email: profileForm.email,
          phone: profileForm.phone,
          secret_code: profileForm.secret_code,
          proficiencies: profileForm.proficiencies
        })
        .eq('id', profileId)

      if (!error) {
        setEditingProfile(false)
        loadUserProfile()
        playSuccessSound()
      }
    } catch (error) {
      console.error('Error saving profile:', error)
    } finally {
      setSaving(false)
    }
  }

  const loadTeamData = async () => {
    setLoading(true)
    try {
      // Get user's team membership
      const { data: memberData } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('profile_id', profileId)
        .single()

      if (memberData) {
        // Load team data
        const { data: teamData } = await supabase
          .from('teams')
          .select('*')
          .eq('id', memberData.team_id)
          .single()

        if (teamData) {
          setTeam(teamData as Team)
          setIsLeader(teamData.leader_id === profileId)

          // Load team members
          const { data: membersData } = await supabase
            .from('team_members')
            .select(`
              *,
              profile:profiles(
                name, email, phone, proficiencies, user_status
              )
            `)
            .eq('team_id', teamData.id)

          if (membersData) {
            setMembers(membersData as any)
          }

          // Load join requests if leader
          if (teamData.leader_id === profileId) {
            const { data: requestsData } = await supabase
              .from('join_requests')
              .select(`
                *,
                requester:profiles(
                  name, proficiencies
                )
              `)
              .eq('team_id', teamData.id)
              .eq('status', 'pending')

            if (requestsData) {
              setJoinRequests(requestsData as any)
            }
          }
        }
      } else {
        // Check if user is a team leader without being a member
        const { data: teamData } = await supabase
          .from('teams')
          .select('*')
          .eq('leader_id', profileId)
          .single()

        if (teamData) {
          setTeam(teamData as Team)
          setIsLeader(true)
        }
      }
    } catch (error) {
      console.error('Error loading team data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const { error } = await (supabase.rpc as any)('respond_to_request', {
        p_request_id: requestId,
        p_leader_id: profileId,
        p_accept: true
      })

      if (!error) {
        playSuccessSound()
        loadTeamData()
      }
    } catch (error) {
      console.error('Error accepting request:', error)
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await (supabase.rpc as any)('respond_to_request', {
        p_request_id: requestId,
        p_leader_id: profileId,
        p_accept: false
      })

      if (!error) {
        loadTeamData()
      }
    } catch (error) {
      console.error('Error rejecting request:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading team data...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Profile Management Section */}
      <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-black text-gray-900">👤 My Profile</h2>
          {!editingProfile ? (
            <button
              onClick={() => setEditingProfile(true)}
              className="px-4 py-2 bg-amber-500 text-white font-black border-2 border-black hover:bg-amber-600 transition-colors"
            >
              EDIT PROFILE
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditingProfile(false)}
                className="px-4 py-2 bg-gray-500 text-white font-black border-2 border-black hover:bg-gray-600 transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="px-4 py-2 bg-green-500 text-white font-black border-2 border-black hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {saving ? 'SAVING...' : 'SAVE'}
              </button>
            </div>
          )}
        </div>

        {userProfile && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={userName}
                  disabled
                  className="w-full px-3 py-2 border-2 border-gray-300 bg-gray-100 font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Email
                  {editingProfile && profileForm.email && !validateEmail(profileForm.email) && (
                    <span className="text-xs text-red-500 ml-2">Invalid email format</span>
                  )}
                </label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                  disabled={!editingProfile}
                  placeholder="your.email@example.com"
                  className={`w-full px-3 py-2 border-2 ${
                    editingProfile
                      ? profileForm.email && !validateEmail(profileForm.email)
                        ? 'border-red-500 bg-red-50'
                        : 'border-black'
                      : 'border-gray-300 bg-gray-100'
                  } font-medium`}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Phone <span className="text-red-500">*</span>
                  {editingProfile && (
                    !profileForm.phone ? (
                      <span className="text-xs text-amber-600 ml-2">Required for team coordination</span>
                    ) : !validatePhone(profileForm.phone) ? (
                      <span className="text-xs text-red-500 ml-2">Must be 10 digits</span>
                    ) : null
                  )}
                </label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => {
                    const formatted = formatPhoneNumber(e.target.value)
                    setProfileForm({...profileForm, phone: formatted})
                  }}
                  disabled={!editingProfile}
                  placeholder="571-842-2187"
                  maxLength={12}
                  className={`w-full px-3 py-2 border-2 ${
                    editingProfile
                      ? profileForm.phone
                        ? validatePhone(profileForm.phone)
                          ? 'border-black'
                          : 'border-red-500 bg-red-50'
                        : 'border-amber-500 bg-amber-50'
                      : 'border-gray-300 bg-gray-100'
                  } font-medium`}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Secret Code</label>
                <input
                  type="password"
                  value={profileForm.secret_code}
                  onChange={(e) => setProfileForm({...profileForm, secret_code: e.target.value})}
                  disabled={!editingProfile}
                  placeholder={editingProfile ? "Enter new code" : "••••••••"}
                  className={`w-full px-3 py-2 border-2 ${editingProfile ? 'border-black' : 'border-gray-300 bg-gray-100'} font-medium`}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Skills</label>
              <div className="flex flex-wrap gap-2">
                {['Frontend', 'Backend', 'Full Stack', 'Mobile', 'DevOps', 'UI/UX', 'Data Science', 'ML/AI', 'Blockchain', 'Cloud', 'Security'].map(skill => (
                  <button
                    key={skill}
                    onClick={() => {
                      if (editingProfile) {
                        const skills = profileForm.proficiencies || []
                        if (skills.includes(skill)) {
                          setProfileForm({...profileForm, proficiencies: skills.filter(s => s !== skill)})
                        } else {
                          setProfileForm({...profileForm, proficiencies: [...skills, skill]})
                        }
                      }
                    }}
                    disabled={!editingProfile}
                    className={`px-3 py-1 border-2 ${profileForm.proficiencies?.includes(skill) ? 'bg-amber-500 text-white border-black' : 'bg-white border-gray-300'} font-medium transition-colors ${editingProfile ? 'cursor-pointer hover:border-black' : 'cursor-not-allowed'}`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Team Status Section */}
      {!team ? (
        <>
          {/* Solo Hacker Badge */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 border-2 border-black p-8 shadow-[4px_4px_0px_rgba(0,0,0,1)] text-center">
            <div className="text-6xl mb-4">🚀</div>
            <h2 className="text-3xl font-black text-white mb-2">SOLO HACKER</h2>
            <p className="text-white/90 font-bold text-lg mb-4">
              You're flying solo at ShellHacks 2025!
            </p>
            <div className="bg-white/20 border-2 border-white/50 rounded-lg p-4 mt-4">
              <p className="text-white text-sm font-medium">
                💡 Build your own project or join a team to collaborate with others
              </p>
            </div>
          </div>

          {/* Solo Hacker Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] transition-all h-full flex flex-col">
              <h3 className="text-xl font-black text-gray-900 mb-3">🤝 Join a Team</h3>
              <p className="text-gray-600 mb-4 flex-grow">
                Browse recruiting teams and find your perfect match
              </p>
              <button
                onClick={() => window.location.href = '/?view=browse-teams'}
                className="w-full px-4 py-2 bg-amber-500 text-white font-black border-2 border-black hover:bg-amber-600 transition-colors"
              >
                BROWSE TEAMS
              </button>
            </div>

            <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] transition-all h-full flex flex-col">
              <h3 className="text-xl font-black text-gray-900 mb-3">✨ Create a Team</h3>
              <p className="text-gray-600 mb-4 flex-grow">
                Start your own team and recruit other hackers
              </p>
              <button
                onClick={() => window.location.href = '/?view=create-team'}
                className="w-full px-4 py-2 bg-green-500 text-white font-black border-2 border-black hover:bg-green-600 transition-colors"
              >
                CREATE TEAM
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Show team info when user has a team */
        <>

      {/* Team Info */}
      <div className="mb-8">
        <div className="bg-white border-2 border-black p-6 shadow-hard">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Tech Stack</h2>
          <div className="flex flex-wrap gap-2">
            {team.tech_stack.map((tech) => (
              <span key={tech} className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm font-medium">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>

          {/* Voting Modal */}
          {team && showVotingModal && (
            <VotingModal
              isOpen={showVotingModal}
              onClose={() => setShowVotingModal(false)}
              teamId={team.id}
              teamName={team.name}
              votingEndsAt={team.voting_ends_at || ''}
              currentUserId={profileId}
              onVotingComplete={() => loadTeamData()}
            />
          )}
        </>
      )}
    </div>
  )
}