'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import TeamInfoModal from './TeamInfoModal'

interface Team {
  id: string
  name: string
  description: string
  status: 'recruiting' | 'closed' | 'full' | 'voting' | 'disbanded'
  leader_id: string
  max_members: number
  min_members: number
  looking_for_roles: string[]
  tech_stack: string[]
  created_at: string
  member_count?: number
  leader?: {
    name: string
  }
  members?: any[]
}

interface BrowseTeamsProps {
  currentUser: { id: string; name: string } | null
}

export default function BrowseTeams({ currentUser }: BrowseTeamsProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'recruiting' | 'closed' | 'full'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingRequests, setPendingRequests] = useState<string[]>([])
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [selectedTeamForJoin, setSelectedTeamForJoin] = useState<Team | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>('')

  useEffect(() => {
    loadTeams()
    if (currentUser) {
      loadPendingRequests()
    }
    setupRealtimeSubscription()
  }, [currentUser])

  const loadTeams = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          leader:profiles!teams_leader_id_fkey(name),
          members:team_members(
            id,
            profile:profiles(id, name)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Calculate member count for each team
      const teamsWithCount = data?.map(team => ({
        ...team,
        member_count: team.members?.length || 0
      })) || []

      setTeams(teamsWithCount as Team[])
    } catch (error) {
      console.error('Error loading teams:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPendingRequests = async () => {
    if (!currentUser) return

    try {
      // Only get PENDING requests, not rejected or withdrawn ones
      const { data, error } = await supabase
        .from('join_requests')
        .select('team_id, status')
        .eq('profile_id', currentUser.id)
        .in('status', ['pending'])  // Only pending, not rejected/withdrawn

      if (data && !error) {
        setPendingRequests(data.map(r => r.team_id))
      }
    } catch (error) {
      console.error('Error loading pending requests:', error)
    }
  }

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('teams-browse')
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

  const openRoleSelection = (team: Team) => {
    setSelectedTeamForJoin(team)
    setSelectedRole(team.looking_for_roles?.[0] || 'Team Member')
    setShowRoleModal(true)
  }

  const handleJoinTeam = async () => {
    if (!currentUser || !selectedTeamForJoin) {
      console.log('Please login to join a team!')
      return
    }

    try {
      const { data, error } = await (supabase.rpc as any)('request_to_join', {
        p_profile_id: currentUser.id,
        p_team_id: selectedTeamForJoin.id,
        p_requested_role: selectedRole,
        p_message: null
      })

      if (error) throw error

      if (data?.success) {
        console.log('Request sent successfully to', selectedTeamForJoin.name)
        setPendingRequests([...pendingRequests, selectedTeamForJoin.id])
        setShowRoleModal(false)
        setSelectedTeamForJoin(null)
        loadPendingRequests()
      } else {
        console.error('Failed to send request:', data?.error || 'Unknown error')
      }
    } catch (error) {
      console.error('Error joining team:', error)
    }
  }

  const handleWithdrawRequest = async (teamId: string) => {
    if (!currentUser) return

    try {
      // Find and delete the pending request
      const { data: request } = await supabase
        .from('join_requests')
        .select('id')
        .eq('profile_id', currentUser.id)
        .eq('team_id', teamId)
        .eq('status', 'pending')
        .single()

      if (request) {
        const { error } = await supabase
          .from('join_requests')
          .update({ status: 'withdrawn' })
          .eq('id', request.id)

        if (!error) {
          console.log('Request withdrawn successfully')
          setPendingRequests(pendingRequests.filter(id => id !== teamId))
          loadPendingRequests()
        }
      }
    } catch (error) {
      console.error('Error withdrawing request:', error)
    }
  }

  const filteredTeams = teams.filter(team => {
    // Filter by status
    if (filterStatus !== 'all' && team.status !== filterStatus) return false

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        team.name.toLowerCase().includes(query) ||
        team.description.toLowerCase().includes(query) ||
        team.tech_stack.some(tech => tech.toLowerCase().includes(query)) ||
        team.looking_for_roles.some(role => role.toLowerCase().includes(query))
      )
    }

    return true
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'recruiting': return 'bg-green-500'
      case 'full': return 'bg-amber-500'
      case 'closed': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'recruiting': return '🟢 RECRUITING'
      case 'full': return '🟡 FULL'
      case 'closed': return '🔴 CLOSED'
      default: return status.toUpperCase()
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header with Filters */}
        <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="🔍 Search teams by name, tech stack, or roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border-2 border-black font-bold focus:outline-none focus:ring-4 focus:ring-amber-400"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 border-2 border-black font-bold transition-all ${
                  filterStatus === 'all'
                    ? 'bg-amber-400 shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                    : 'bg-white hover:bg-gray-100'
                }`}
              >
                ALL
              </button>
              <button
                onClick={() => setFilterStatus('recruiting')}
                className={`px-4 py-2 border-2 border-black font-bold transition-all ${
                  filterStatus === 'recruiting'
                    ? 'bg-green-400 shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                    : 'bg-white hover:bg-gray-100'
                }`}
              >
                RECRUITING
              </button>
              <button
                onClick={() => setFilterStatus('full')}
                className={`px-4 py-2 border-2 border-black font-bold transition-all ${
                  filterStatus === 'full'
                    ? 'bg-amber-400 shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                    : 'bg-white hover:bg-gray-100'
                }`}
              >
                FULL
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-4 pt-4 border-t-2 border-gray-200 flex justify-between text-sm">
            <span className="font-bold">
              Total Teams: <span className="text-amber-600">{teams.length}</span>
            </span>
            <span className="font-bold">
              Recruiting: <span className="text-green-600">{teams.filter(t => t.status === 'recruiting').length}</span>
            </span>
            <span className="font-bold">
              Showing: <span className="text-blue-600">{filteredTeams.length}</span>
            </span>
          </div>
        </div>

        {/* Teams Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
              <p className="text-gray-600 font-bold">Loading teams...</p>
            </div>
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="bg-white border-2 border-black p-12 shadow-[4px_4px_0px_rgba(0,0,0,1)] text-center">
            <p className="text-2xl font-black text-gray-400 mb-2">NO TEAMS FOUND</p>
            <p className="text-gray-600">Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredTeams.map((team) => (
                <motion.div
                  key={team.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -4 }}
                  className="bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
                  onClick={() => {
                    setSelectedTeam(team)
                    setShowTeamModal(true)
                  }}
                >
                  <div className="p-4">
                    {/* Team Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-black text-lg text-gray-900">{team.name}</h3>
                        <p className="text-sm text-gray-600">by {team.leader?.name || 'Unknown'}</p>
                      </div>
                      <span className={`px-2 py-1 text-[10px] font-black text-white rounded ${getStatusColor(team.status)}`}>
                        {getStatusText(team.status)}
                      </span>
                    </div>

                    {/* Description */}
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

                    {/* Looking For */}
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
                      {team.status === 'recruiting' && currentUser && pendingRequests.includes(team.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleWithdrawRequest(team.id)
                          }}
                          className="px-3 py-1 bg-yellow-500 text-white text-xs font-black rounded hover:bg-yellow-600 transition-colors"
                        >
                          WITHDRAW REQUEST
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Real-time indicator */}
        <div className="text-center">
          <span className="text-xs text-gray-500">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></span>
            Live updates enabled • Teams refresh automatically
          </span>
        </div>
      </div>

      {/* Team Info Modal */}
      {showTeamModal && selectedTeam && (
        <TeamInfoModal
          isOpen={showTeamModal}
          team={selectedTeam as any}
          onClose={() => {
            setShowTeamModal(false)
            setSelectedTeam(null)
          }}
          currentUserId={currentUser?.id}
        />
      )}

      {/* Role Selection Modal */}
      {showRoleModal && selectedTeamForJoin && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowRoleModal(false)}
          />
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="relative bg-white border-2 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] p-6 max-w-md w-full mx-4"
          >
            <h2 className="text-2xl font-black text-gray-900 mb-4">
              Select Your Role for {selectedTeamForJoin.name}
            </h2>

            <div className="space-y-2 mb-6">
              {selectedTeamForJoin.looking_for_roles.map((role) => (
                <label
                  key={role}
                  className="flex items-center p-3 border-2 border-black hover:bg-amber-50 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    checked={selectedRole === role}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="mr-3"
                  />
                  <span className="font-bold text-gray-900">{role}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRoleModal(false)}
                className="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 text-black font-black border-2 border-black transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleJoinTeam}
                className="flex-1 py-2 px-4 bg-green-500 hover:bg-green-600 text-white font-black border-2 border-black transition-colors"
              >
                SEND REQUEST
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  )
}