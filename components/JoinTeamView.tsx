'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import TeamInfoModal from './TeamInfoModal'

type Team = {
  id: string
  name: string
  description: string
  status: string
  looking_for_roles: string[]
  tech_stack: string[]
  member_count?: number
  min_members?: number
  max_members?: number
  leader?: {
    name: string
  }
}

interface JoinTeamViewProps {
  currentUser: { id: string; name: string } | null
  isTeamLeader?: boolean
  userTeam?: { id: string; name: string } | null
}

export default function JoinTeamView({ currentUser, isTeamLeader = false, userTeam = null }: JoinTeamViewProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedTech, setSelectedTech] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'recruiting' | 'full'>('recruiting')
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [showTeamModal, setShowTeamModal] = useState(false)

  useEffect(() => {
    loadTeams()
    setupRealtimeSubscription()
  }, [])

  useEffect(() => {
    filterTeams()
  }, [teams, searchTerm, selectedRole, selectedTech, selectedStatus])

  const loadTeams = async () => {
    try {
      const { data: teamsData, error } = await supabase
        .from('teams')
        .select(`
          *,
          leader:profiles!teams_leader_id_fkey(name),
          members:team_members(id)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Add member counts
      const teamsWithCounts = (teamsData || []).map((team: any) => ({
        ...team,
        member_count: team.members?.length || 0
      }))

      setTeams(teamsWithCounts)
    } catch (error) {
      console.error('Error loading teams:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('teams-browse-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'teams'
      }, () => {
        loadTeams()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_members'
      }, () => {
        loadTeams()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const filterTeams = () => {
    let filtered = teams

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(team => {
        if (selectedStatus === 'recruiting') return team.status === 'recruiting'
        if (selectedStatus === 'full') return team.status === 'full' || team.status === 'closed'
        return true
      })
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(team =>
        team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by role
    if (selectedRole) {
      filtered = filtered.filter(team =>
        team.looking_for_roles?.some(role =>
          role.toLowerCase().includes(selectedRole.toLowerCase())
        )
      )
    }

    // Filter by tech
    if (selectedTech) {
      filtered = filtered.filter(team =>
        team.tech_stack?.some(tech =>
          tech.toLowerCase().includes(selectedTech.toLowerCase())
        )
      )
    }

    setFilteredTeams(filtered)
  }

  const handleJoinRequest = async (teamId: string) => {
    if (!currentUser) {
      alert('Please login to join a team!')
      return
    }

    try {
      const { data, error } = await (supabase.rpc as any)('request_to_join', {
        p_profile_id: currentUser.id,
        p_team_id: teamId,
        p_requested_role: 'member',
        p_message: 'I would like to join your team!'
      })

      if (error) throw error

      if (data?.success) {
        alert('Join request sent successfully!')
      } else {
        alert(data?.error || 'Failed to send request')
      }
    } catch (error) {
      console.error('Error sending join request:', error)
      alert('Failed to send join request')
    }
  }

  const getStatusBadge = (status: string, memberCount: number = 0, maxMembers: number = 8) => {
    const isFull = memberCount >= maxMembers

    if (status === 'recruiting' && !isFull) {
      return <span className="px-2 py-1 bg-green-500 text-white text-xs font-black rounded">🟢 RECRUITING</span>
    } else if (isFull || status === 'full') {
      return <span className="px-2 py-1 bg-amber-500 text-white text-xs font-black rounded">🟡 FULL</span>
    } else if (status === 'closed') {
      return <span className="px-2 py-1 bg-red-500 text-white text-xs font-black rounded">🔴 CLOSED</span>
    }
    return <span className="px-2 py-1 bg-gray-500 text-white text-xs font-black rounded">{status.toUpperCase()}</span>
  }

  return (
    <motion.div
      key="browse-teams"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Filters Section */}
      <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-black text-gray-700 mb-2">
              SEARCH TEAMS
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border-2 border-black font-bold focus:outline-none focus:ring-4 focus:ring-amber-400"
              placeholder="Team name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-black text-gray-700 mb-2">
              STATUS
            </label>
            <select
              className="w-full px-3 py-2 border-2 border-black font-bold focus:outline-none focus:ring-4 focus:ring-amber-400"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
            >
              <option value="all">All Teams</option>
              <option value="recruiting">Recruiting</option>
              <option value="full">Full/Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-700 mb-2">
              LOOKING FOR
            </label>
            <select
              className="w-full px-3 py-2 border-2 border-black font-bold focus:outline-none focus:ring-4 focus:ring-amber-400"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="Frontend">Frontend Developer</option>
              <option value="Backend">Backend Developer</option>
              <option value="Full Stack">Full Stack Developer</option>
              <option value="Mobile">Mobile Developer</option>
              <option value="UI/UX">UI/UX Designer</option>
              <option value="Data">Data Scientist</option>
              <option value="ML">ML Engineer</option>
              <option value="DevOps">DevOps Engineer</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-700 mb-2">
              TECH STACK
            </label>
            <select
              className="w-full px-3 py-2 border-2 border-black font-bold focus:outline-none focus:ring-4 focus:ring-amber-400"
              value={selectedTech}
              onChange={(e) => setSelectedTech(e.target.value)}
            >
              <option value="">All Technologies</option>
              <option value="React">React</option>
              <option value="Next.js">Next.js</option>
              <option value="Node.js">Node.js</option>
              <option value="Python">Python</option>
              <option value="TypeScript">TypeScript</option>
              <option value="Java">Java</option>
              <option value="Go">Go</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t-2 border-gray-200 pt-4">
          <p className="text-sm font-bold text-gray-600">
            Found <span className="text-amber-600">{filteredTeams.length}</span> teams
            {selectedStatus === 'recruiting' && ' looking for members'}
          </p>
          <div className="flex items-center text-sm text-green-600 font-bold">
            <span className="animate-pulse mr-2 h-2 w-2 bg-green-500 rounded-full"></span>
            REAL-TIME UPDATES
          </div>
        </div>
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
            <p className="text-gray-600 font-bold">Loading teams...</p>
          </div>
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="text-center py-12 bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-black text-gray-900 mb-2">
            NO TEAMS FOUND
          </h3>
          <p className="text-gray-600 font-bold">
            Try adjusting your filters or check back later
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              className="bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
              onClick={() => {
                setSelectedTeam(team)
                setShowTeamModal(true)
              }}
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-black text-gray-900">
                      {team.name}
                    </h3>
                    <p className="text-xs text-gray-600">
                      by {team.leader?.name || 'Unknown'}
                    </p>
                  </div>
                  {getStatusBadge(team.status, team.member_count, team.max_members)}
                </div>

                <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                  {team.description}
                </p>

                {/* Tech Stack */}
                {team.tech_stack && team.tech_stack.length > 0 && (
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-1">
                      {team.tech_stack.slice(0, 4).map((tech) => (
                        <span key={tech} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">
                          {tech}
                        </span>
                      ))}
                      {team.tech_stack.length > 4 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded">
                          +{team.tech_stack.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Looking for roles */}
                {team.looking_for_roles && team.looking_for_roles.length > 0 && (
                  <div className="mb-3 p-2 bg-amber-50 border border-amber-300 rounded">
                    <p className="text-[10px] font-black text-amber-700 mb-1">LOOKING FOR:</p>
                    <div className="flex flex-wrap gap-1">
                      {team.looking_for_roles.slice(0, 3).map((role) => (
                        <span key={role} className="text-[10px] font-bold text-gray-700">
                          • {role}
                        </span>
                      ))}
                      {team.looking_for_roles.length > 3 && (
                        <span className="text-[10px] font-bold text-gray-500">
                          +{team.looking_for_roles.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <div className="text-xs font-bold text-gray-600">
                    👥 {team.member_count || 0}/{
                      team.status === 'recruiting'
                        ? (team.member_count || 0) + (team.looking_for_roles?.length || 0)
                        : (team.member_count || 0)
                    } members
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Team Info Modal */}
      {showTeamModal && selectedTeam && (
        <TeamInfoModal
          isOpen={showTeamModal}
          onClose={() => {
            setShowTeamModal(false)
            setSelectedTeam(null)
          }}
          team={selectedTeam}
          currentUserId={currentUser?.id}
          userHasTeam={!!userTeam}
        />
      )}
    </motion.div>
  )
}