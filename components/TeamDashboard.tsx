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
  const [activeTab, setActiveTab] = useState<'members' | 'requests' | 'settings'>('members')
  const [showVotingModal, setShowVotingModal] = useState(false)

  useEffect(() => {
    loadTeamData()
  }, [profileId])

  const loadTeamData = async () => {
    setLoading(true)
    try {
      // Get user's team membership
      const { data: memberData } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('profile_id', profileId)
        .eq('status', 'active')
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
                name, email, phone, proficiencies, status
              )
            `)
            .eq('team_id', teamData.id)
            .eq('status', 'active')

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

  if (!team) {
    return (
      <div className="space-y-6">
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
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] transition-all">
            <h3 className="text-xl font-black text-gray-900 mb-3">🤝 Join a Team</h3>
            <p className="text-gray-600 mb-4">
              Browse recruiting teams and find your perfect match
            </p>
            <button
              onClick={() => window.location.href = '/?view=browse-teams'}
              className="w-full px-4 py-2 bg-amber-500 text-white font-black border-2 border-black hover:bg-amber-600 transition-colors"
            >
              BROWSE TEAMS
            </button>
          </div>

          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] transition-all">
            <h3 className="text-xl font-black text-gray-900 mb-3">✨ Create a Team</h3>
            <p className="text-gray-600 mb-4">
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

        {/* Solo Hacker Stats */}
        <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <h3 className="text-lg font-black text-gray-900 mb-4">YOUR PROFILE</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-bold text-gray-600">Name:</span>
              <span className="font-medium">{userName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-600">Status:</span>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm font-bold">Solo Hacker</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-600">Team:</span>
              <span className="text-gray-500">None</span>
            </div>
          </div>
        </div>

        {/* Tips for Solo Hackers */}
        <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-lg">
          <h4 className="font-black text-amber-800 mb-2">💡 TIPS FOR SOLO HACKERS</h4>
          <ul className="space-y-1 text-sm text-amber-700">
            <li>• You can work on your own project independently</li>
            <li>• Join a team anytime before the hackathon starts</li>
            <li>• Network with other hackers in The Scroll</li>
            <li>• Teams are looking for diverse skills - check Browse Teams!</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Team Info */}
      <div className="mb-8">
        <div className="bg-white border-2 border-black p-6 shadow-hard">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Project Description</h2>
          <p className="text-gray-800 text-lg font-medium mb-4">
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
          <div className="bg-white border-2 border-black p-6">
            <h2 className="text-xl font-black mb-6">Team Roster</h2>

            {members.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="border-2 border-gray-300 bg-gray-50 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-bold text-sm mb-1">{member.role}</div>
                        <div className="text-green-700 font-medium flex items-center gap-1">
                          <span className="text-lg">✓</span>
                          {member.profile.name}
                          {team.leader_id === member.profile_id && ' 👑'}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {member.profile.proficiencies.slice(0, 3).map((skill) => (
                            <span key={skill} className="px-2 py-0.5 bg-white border border-green-300 text-green-700 text-xs">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No members yet</p>
            )}
          </div>
        )}

        {activeTab === 'requests' && isLeader && (
          <div className="bg-white border-2 border-black p-6">
            <h2 className="text-xl font-black mb-4">Join Requests</h2>
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
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleAcceptRequest(request.id)}
                            className="px-4 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectRequest(request.id)}
                            className="px-4 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white border-2 border-black p-6">
            <h2 className="text-xl font-black mb-4">Team Settings</h2>
            <p className="text-gray-600">Team settings and configuration options will appear here.</p>
          </div>
        )}
      </motion.div>

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
  )
}