'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'

type Team = {
  id: string
  name: string
  description: string
  status: string
  looking_for_roles: string[]
  tech_stack: string[]
  min_members: number
  max_members: number
  leader_id?: string
}

type TeamMember = {
  id: string
  profile_id: string
  role: string
  joined_at: string
  presence?: 'online' | 'away' | 'busy' | 'offline'
  last_seen?: string
  profiles: {
    id: string
    name: string
    email: string
    avatar_url?: string
    proficiencies?: string[]
  }
}

interface ManageTeamProps {
  profileId: string
  teamId: string
  isLeader?: boolean
}

export default function ManageTeam({ profileId, teamId, isLeader = false }: ManageTeamProps) {
  console.log('ManageTeam props:', { profileId, teamId, isLeader })
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [confirmTeamName, setConfirmTeamName] = useState('')
  const [leaveError, setLeaveError] = useState('')
  const [userRole, setUserRole] = useState<string>('')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [removingMember, setRemovingMember] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'general' | 'roles' | 'tech' | 'members' | 'leave'>('general')
  const [votingInProgress, setVotingInProgress] = useState(false)
  const [votingRoundId, setVotingRoundId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    description: '',
    status: 'recruiting',
    looking_for_roles: [] as string[],
    tech_stack: [] as string[]
  })

  const [newRole, setNewRole] = useState('')
  const [newTech, setNewTech] = useState('')

  const availableRoles = [
    'Frontend Developer',
    'Backend Developer',
    'Full Stack Developer',
    'Mobile Developer',
    'UI/UX Designer',
    'Data Scientist',
    'ML Engineer',
    'DevOps Engineer',
    'Project Manager',
    'Business Analyst'
  ]

  const availableTechStack = [
    'React', 'Next.js', 'Vue', 'Angular', 'Svelte',
    'Node.js', 'Express', 'Python', 'Django', 'Flask',
    'Java', 'Spring', 'Go', 'Rust', 'Ruby on Rails',
    'TypeScript', 'JavaScript', 'PostgreSQL', 'MongoDB', 'Redis',
    'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP'
  ]

  useEffect(() => {
    console.log('ManageTeam useEffect triggered:', { teamId, profileId })
    if (teamId && profileId) {
      console.log('Loading team data...')
      loadTeam()
      loadUserRole()
      loadTeamMembers()
    } else {
      console.log('Missing teamId or profileId:', { teamId, profileId })
    }
  }, [teamId, profileId])

  const loadUserRole = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('role')
        .eq('profile_id', profileId)
        .eq('team_id', teamId)
        .single()

      if (!error && data && data.role) {
        setUserRole(data.role)
      } else {
        // If not a member, check if they're the leader
        const { data: teamData } = await supabase
          .from('teams')
          .select('leader_id')
          .eq('id', teamId)
          .single()

        if (teamData && teamData.leader_id === profileId) {
          // Get the leader's proficiency instead of hardcoding "Team Leader"
          const { data: profileData } = await supabase
            .from('profiles')
            .select('proficiencies')
            .eq('id', profileId)
            .single()

          if (profileData?.proficiencies?.[0]) {
            setUserRole(profileData.proficiencies[0])
          } else {
            setUserRole('Team Leader')
          }
        } else {
          // Only set default if no specific role found
          setUserRole('')
        }
      }
    } catch (error) {
      console.error('Error loading user role:', error)
      setUserRole('')
    }
  }

  const loadTeam = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single()

      if (error) throw error

      if (data) {
        setTeam(data as Team)
        setFormData({
          description: data.description || '',
          status: data.status || 'recruiting',
          looking_for_roles: data.looking_for_roles || [],
          tech_stack: data.tech_stack || []
        })
      }
    } catch (error) {
      console.error('Error loading team:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTeamMembers = async () => {
    try {
      console.log('Loading team members for team:', teamId)
      console.log('TeamId type:', typeof teamId, 'value:', teamId)

      if (!teamId || teamId === '') {
        console.error('Invalid teamId:', teamId)
        setTeamMembers([])
        return
      }

      // First, get team members
      console.log('Making query with teamId:', teamId)
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .order('joined_at', { ascending: true })

      if (membersError) {
        console.error('Error loading team members:', membersError)
        console.error('Query details:', { teamId, query: 'team_members with team_id' })
        throw membersError
      }

      console.log('Team members raw data:', membersData)

      if (membersData && membersData.length > 0) {
        // Get profile IDs
        const profileIds = membersData.map(m => m.profile_id)

        // Fetch profiles separately with proficiencies
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, email, proficiencies')
          .in('id', profileIds)

        if (profilesError) {
          console.error('Error loading profiles:', profilesError)
          throw profilesError
        }

        // Combine the data
        const combinedData = membersData.map(member => ({
          ...member,
          profiles: profilesData?.find(p => p.id === member.profile_id) || null
        }))

        console.log('Combined team members with profiles:', combinedData)
        setTeamMembers(combinedData as TeamMember[])
      } else {
        setTeamMembers([])
      }
    } catch (error) {
      console.error('Error loading team members:', error)
    }
  }

  const handleRemoveMember = async (memberId: string, memberProfileId: string) => {
    if (!isLeader) return

    const memberName = teamMembers.find(m => m.profile_id === memberProfileId)?.profiles?.name || 'this member'

    if (!confirm(`Are you sure you want to remove ${memberName} from the team?`)) return

    setRemovingMember(memberId)
    try {
      // Delete the team member record
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      // Update the profile to set them as looking for team
      await supabase
        .from('profiles')
        .update({
          current_team_id: null,
          profile_type: 'looking'
        })
        .eq('id', memberProfileId)

      alert(`${memberName} has been removed from the team.`)
      loadTeamMembers()
    } catch (error) {
      console.error('Error removing team member:', error)
      alert('Failed to remove team member. Please try again.')
    } finally {
      setRemovingMember(null)
    }
  }

  const handleSaveGeneral = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          description: formData.description
          // Status is managed automatically based on team size and shouldn't be manually changed
        })
        .eq('id', teamId)

      if (error) throw error

      alert('Team information updated successfully!')
      loadTeam()
    } catch (error) {
      console.error('Error updating team:', error)
      alert('Failed to update team information')
    } finally {
      setSaving(false)
    }
  }

  const handleAddRole = () => {
    if (newRole && !formData.looking_for_roles.includes(newRole)) {
      setFormData({
        ...formData,
        looking_for_roles: [...formData.looking_for_roles, newRole]
      })
      setNewRole('')
    }
  }

  const handleRemoveRole = (role: string) => {
    setFormData({
      ...formData,
      looking_for_roles: formData.looking_for_roles.filter(r => r !== role)
    })
  }

  const handleSaveRoles = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          looking_for_roles: formData.looking_for_roles
        })
        .eq('id', teamId)

      if (error) throw error

      alert('Roles updated successfully!')
      loadTeam()
    } catch (error) {
      console.error('Error updating roles:', error)
      alert('Failed to update roles')
    } finally {
      setSaving(false)
    }
  }

  const handleAddTech = () => {
    if (newTech && !formData.tech_stack.includes(newTech)) {
      setFormData({
        ...formData,
        tech_stack: [...formData.tech_stack, newTech]
      })
      setNewTech('')
    }
  }

  const handleRemoveTech = (tech: string) => {
    setFormData({
      ...formData,
      tech_stack: formData.tech_stack.filter(t => t !== tech)
    })
  }

  const handleSaveTech = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          tech_stack: formData.tech_stack
        })
        .eq('id', teamId)

      if (error) throw error

      alert('Tech stack updated successfully!')
      loadTeam()
    } catch (error) {
      console.error('Error updating tech stack:', error)
      alert('Failed to update tech stack')
    } finally {
      setSaving(false)
    }
  }

  const handleLeaveTeam = async () => {
    if (!confirmTeamName) {
      setLeaveError('Please type the team name to confirm')
      return
    }

    if (!team || confirmTeamName.toLowerCase() !== team.name.toLowerCase()) {
      setLeaveError('Team name does not match. Please type it exactly as shown.')
      return
    }

    setLeaving(true)
    setLeaveError('')

    try {
      // Use the leave_team RPC function for proper cleanup
      const { data, error } = await (supabase.rpc as any)('leave_team', {
        p_profile_id: profileId,
        p_team_id: teamId
      })

      if (error) {
        console.error('RPC error:', error)
        throw error
      }

      if (data && !data.success) {
        setLeaveError(data.error || 'Failed to leave team')
        setLeaving(false)
        return
      }

      // Clear session storage before showing alert
      sessionStorage.removeItem('currentUser')
      sessionStorage.removeItem('userTeam')

      // Show appropriate message based on action
      if (data.action === 'team_disbanded') {
        alert('Team has been disbanded as you were the only member.')
      } else if (data.action === 'leadership_transfer') {
        const votingResult = data.voting_result
        if (votingResult.action === 'auto_promoted') {
          alert('You have left the team. Leadership has been automatically transferred to the remaining member.')
        } else if (votingResult.action === 'voting_started') {
          alert('You have left the team. A leadership election has started for the remaining members.')
        }
      } else {
        alert('You have successfully left the team.')
      }

      // Redirect to home
      window.location.href = '/'
    } catch (error) {
      console.error('Error leaving team:', error)
      setLeaveError('Failed to leave team. Please try again.')
    } finally {
      setLeaving(false)
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="bg-white border-2 border-black p-12 shadow-[4px_4px_0px_rgba(0,0,0,1)] text-center">
        <div className="text-6xl mb-4">❌</div>
        <h2 className="text-2xl font-black text-gray-400">Team Not Found</h2>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border-2 border-black p-4 md:p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900">
              {isLeader ? '⚙️ Manage Team' : '👁️ View Team'}: {team.name}
            </h1>
            <p className="text-gray-600 mt-2">
              {isLeader ? 'Update your team\'s information and settings' : 'View your team\'s information'}
            </p>
          </div>
          {!isLeader && (
            <div className="bg-amber-100 border-2 border-amber-400 px-4 py-2 rounded">
              <span className="text-sm font-black text-amber-700">VIEW ONLY</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)]">
        <div className="flex border-b-2 border-black">
          <button
            onClick={() => {
              setActiveSection('general')
              setConfirmTeamName('')
              setLeaveError('')
            }}
            className={`px-6 py-3 font-black transition-colors ${
              activeSection === 'general'
                ? 'bg-amber-400 text-black'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            📝 GENERAL
          </button>
          <button
            onClick={() => {
              setActiveSection('roles')
              setConfirmTeamName('')
              setLeaveError('')
            }}
            className={`px-6 py-3 font-black transition-colors border-l-2 border-black ${
              activeSection === 'roles'
                ? 'bg-amber-400 text-black'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            👥 ROLES
          </button>
          <button
            onClick={() => {
              setActiveSection('tech')
              setConfirmTeamName('')
              setLeaveError('')
            }}
            className={`px-6 py-3 font-black transition-colors border-l-2 border-black ${
              activeSection === 'tech'
                ? 'bg-amber-400 text-black'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            🛠️ TECH STACK
          </button>
          <button
            onClick={() => {
              setActiveSection('members')
              setConfirmTeamName('')
              setLeaveError('')
            }}
            className={`px-6 py-3 font-black transition-colors border-l-2 border-black ${
              activeSection === 'members'
                ? 'bg-amber-400 text-black'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            👨‍👩‍👧‍👦 TEAM MEMBERS
          </button>
          <button
            onClick={() => {
              setActiveSection('leave')
              setConfirmTeamName('')
              setLeaveError('')
            }}
            className={`px-6 py-3 font-black transition-colors border-l-2 border-black ${
              activeSection === 'leave'
                ? 'bg-red-400 text-white'
                : 'bg-white text-gray-600 hover:bg-red-100'
            }`}
          >
            🚪 LEAVE TEAM
          </button>
        </div>

        <div className="p-4 md:p-6">
          {/* General Information */}
          {activeSection === 'general' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-black text-gray-700 mb-2">
                  TEAM DESCRIPTION
                </label>
                <textarea
                  className="w-full px-3 py-2 border-2 border-black font-bold focus:outline-none focus:ring-4 focus:ring-amber-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of your team..."
                  disabled={!isLeader}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 mb-2">
                  TEAM STATUS (AUTO-MANAGED)
                </label>
                <div className="w-full px-3 py-2 border-2 border-gray-400 bg-gray-100 font-bold">
                  {formData.status === 'recruiting' && '🟢 Recruiting'}
                  {formData.status === 'full' && '🟡 Full'}
                  {formData.status === 'closed' && '🔴 Closed'}
                  {formData.status === 'voting' && '🗳️ Voting'}
                  {formData.status === 'disbanded' && '⛔ Disbanded'}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Status updates automatically based on team size
                </p>
              </div>

              {isLeader && (
                <button
                  onClick={handleSaveGeneral}
                  disabled={saving}
                  className="px-6 py-3 bg-amber-400 text-black font-black border-2 border-black hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                >
                  {saving ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
              )}
            </motion.div>
          )}

          {/* Looking For Roles */}
          {activeSection === 'roles' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-black text-gray-700 mb-2">
                  ROLES YOUR TEAM IS LOOKING FOR
                </label>

                {isLeader && (
                  <div className="flex gap-2 mb-4">
                    <select
                      className="flex-1 px-3 py-2 border-2 border-black font-bold focus:outline-none focus:ring-4 focus:ring-amber-400"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                    >
                      <option value="">Select a role...</option>
                      {availableRoles
                        .filter(role => !formData.looking_for_roles.includes(role))
                        .map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                    </select>
                    <button
                      onClick={handleAddRole}
                      disabled={!newRole}
                      className="px-4 py-2 bg-green-500 text-white font-black border-2 border-black hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                    >
                      ADD +
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {formData.looking_for_roles.length === 0 ? (
                    <div className="p-4 bg-gray-100 text-gray-600 text-center rounded">
                      No roles added yet
                    </div>
                  ) : (
                    formData.looking_for_roles.map(role => (
                      <div key={role} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-300 rounded">
                        <span className="font-bold">{role}</span>
                        {isLeader && (
                          <button
                            onClick={() => handleRemoveRole(role)}
                            className="px-3 py-1 bg-red-500 text-white font-black text-xs hover:bg-red-600 transition-colors"
                          >
                            REMOVE
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {isLeader && (
                <button
                  onClick={handleSaveRoles}
                  disabled={saving}
                  className="px-6 py-3 bg-amber-400 text-black font-black border-2 border-black hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                >
                  {saving ? 'SAVING...' : 'SAVE ROLES'}
                </button>
              )}
            </motion.div>
          )}

          {/* Tech Stack */}
          {activeSection === 'tech' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-black text-gray-700 mb-2">
                  TECHNOLOGIES YOUR TEAM USES
                </label>

                {isLeader ? (
                  <div className="flex gap-2 mb-4">
                    <select
                      className="flex-1 px-3 py-2 border-2 border-black font-bold focus:outline-none focus:ring-4 focus:ring-amber-400"
                      value={newTech}
                      onChange={(e) => setNewTech(e.target.value)}
                    >
                      <option value="">Select a technology...</option>
                      {availableTechStack
                        .filter(tech => !formData.tech_stack.includes(tech))
                        .map(tech => (
                          <option key={tech} value={tech}>{tech}</option>
                        ))}
                    </select>
                    <button
                      onClick={handleAddTech}
                      disabled={!newTech}
                      className="px-4 py-2 bg-green-500 text-white font-black border-2 border-black hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                    >
                      ADD +
                    </button>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {formData.tech_stack.length === 0 ? (
                    <div className="w-full p-4 bg-gray-100 text-gray-600 text-center rounded">
                      No technologies added yet
                    </div>
                  ) : (
                    formData.tech_stack.map(tech => (
                      <div key={tech} className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 border border-blue-300 rounded">
                        <span className="font-bold text-blue-700">{tech}</span>
                        {isLeader && (
                          <button
                            onClick={() => handleRemoveTech(tech)}
                            className="text-red-500 hover:text-red-700 font-black"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {isLeader && (
                <button
                  onClick={handleSaveTech}
                  disabled={saving}
                  className="px-6 py-3 bg-amber-400 text-black font-black border-2 border-black hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                >
                  {saving ? 'SAVING...' : 'SAVE TECH STACK'}
                </button>
              )}
            </motion.div>
          )}


          {/* Team Members Section */}
          {activeSection === 'members' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-black">CURRENT TEAM MEMBERS</h3>
                <span className="text-sm font-bold text-gray-600">
                  {teamMembers.length} / {team.max_members} MEMBERS
                </span>
              </div>

              {teamMembers.length === 0 ? (
                <div className="bg-gray-50 border-2 border-gray-300 p-8 text-center rounded">
                  <p className="text-gray-600 font-bold">No team members found.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {teamMembers.map((member) => {
                    const isTeamLeader = team && (
                      team.leader_id === member.profile_id ||
                      member.role === 'leader'
                    )
                    const isCurrentUser = member.profile_id === profileId

                    return (
                      <div
                        key={member.id}
                        className={`bg-white border-2 border-black p-4 shadow-[2px_2px_0px_rgba(0,0,0,1)] ${
                          isCurrentUser ? 'bg-amber-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-black">
                                {member.profiles?.name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-lg">
                                    {member.profiles?.name || 'Unknown Member'}
                                  </span>
                                  {isTeamLeader && (
                                    <span className="bg-amber-400 text-black px-2 py-0.5 text-xs font-black rounded">
                                      👑 LEADER
                                    </span>
                                  )}
                                  {isCurrentUser && (
                                    <span className="bg-green-400 text-black px-2 py-0.5 text-xs font-black rounded">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600">
                                  <span className="font-bold">Role:</span> {
                                    isTeamLeader ? (
                                      <>
                                        <span className="text-amber-600">👑</span> {member.profiles?.proficiencies?.[0] || member.role || 'Team Member'}
                                      </>
                                    ) : (
                                      member.profiles?.proficiencies?.[0] || member.role || 'Team Member'
                                    )
                                  } •
                                  <span className="font-bold"> Joined:</span> {
                                    member.joined_at
                                      ? new Date(member.joined_at).toLocaleDateString()
                                      : 'Unknown'
                                  }
                                </div>
                                {member.profiles?.email && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    📧 {member.profiles.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Only show remove button to team leader for other members */}
                          {isLeader && !isCurrentUser && !isTeamLeader && (
                            <button
                              onClick={() => handleRemoveMember(member.id, member.profile_id)}
                              disabled={removingMember === member.id}
                              className="ml-4 px-4 py-2 bg-red-500 text-white font-black border-2 border-black hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                            >
                              {removingMember === member.id ? 'REMOVING...' : 'REMOVE'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {isLeader && (
                <div className="p-4 bg-blue-50 border border-blue-300 rounded mt-4">
                  <p className="text-sm text-gray-700">
                    <span className="font-black">Team Leader Note:</span> You can remove team members who are not performing or violating team rules.
                    Removed members will need to request to join again if they want to return.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Leave Team Section */}
          {activeSection === 'leave' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="bg-red-50 border-2 border-red-300 p-4 md:p-6 rounded">
                <h3 className="text-xl font-black text-red-700 mb-4">⚠️ LEAVE TEAM</h3>
                <p className="text-gray-700 mb-4">
                  {isLeader
                    ? "As the team leader, leaving will transfer leadership to another member or dissolve the team if you're the only member."
                    : "You are about to leave this team. This action cannot be undone and you'll need to request to join again if you change your mind."
                  }
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  <strong>Team:</strong> {team.name}<br />
                  <strong>Your Role/Position:</strong> {isLeader && '👑 '}{userRole || 'Member'}
                </p>

                {/* Team Name Confirmation */}
                <div className="mb-6">
                  <label className="block text-xs font-black text-gray-700 mb-2">
                    TYPE THE TEAM NAME TO CONFIRM: <span className="text-red-600">{team.name}</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border-2 border-black font-bold focus:outline-none focus:ring-4 focus:ring-red-400"
                    placeholder={`Type "${team.name}" to confirm...`}
                    value={confirmTeamName}
                    onChange={(e) => {
                      setConfirmTeamName(e.target.value)
                      setLeaveError('')
                    }}
                    disabled={leaving}
                  />
                  {leaveError && (
                    <p className="mt-2 text-sm text-red-600 font-bold">{leaveError}</p>
                  )}
                </div>

                <button
                  onClick={handleLeaveTeam}
                  disabled={leaving || !confirmTeamName || confirmTeamName.toLowerCase() !== team.name.toLowerCase()}
                  className="px-6 py-3 bg-red-500 text-white font-black border-2 border-black hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                >
                  {leaving ? 'LEAVING TEAM...' : '🚪 CONFIRM & LEAVE TEAM'}
                </button>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-300 rounded">
                <p className="text-sm text-gray-700">
                  <span className="font-black">Note:</span> If you're working on an important project or the hackathon is ongoing,
                  consider discussing with your team before leaving.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}