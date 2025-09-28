'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

type Team = {
  id: string
  name: string
  description: string
  status: string
  looking_for_roles: string[]
  tech_stack: string[]
  member_count?: number
}

export default function JoinTeamPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedTech, setSelectedTech] = useState('')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [authData, setAuthData] = useState({
    name: '',
    email: '',
    secretCode: '',
    skills: [] as string[],
    requestMessage: '',
    requestedRole: ''
  })
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const availableSkills = [
    'Frontend', 'Backend', 'Full Stack', 'Mobile', 'DevOps',
    'UI/UX Design', 'Data Science', 'Machine Learning', 'Blockchain',
    'Cloud', 'Security', 'Game Dev', 'AR/VR', 'IoT', 'Other'
  ]

  useEffect(() => {
    loadTeams()
    setupRealtimeSubscription()
  }, [])

  useEffect(() => {
    filterTeams()
  }, [teams, searchTerm, selectedRole, selectedTech])

  const loadTeams = async () => {
    try {
      const { data: teamsData, error } = await supabase
        .from('teams')
        .select('*')
        .in('status', ['recruiting', 'forming'])  // Check for both recruiting and forming status

      if (error) throw error

      // Get member counts for each team
      const teamsWithCounts = await Promise.all(
        (teamsData || []).map(async (team: any) => {
          const { count } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id)

          return { ...team, member_count: count || 0 }
        })
      )

      setTeams(teamsWithCounts)
    } catch (error) {
      console.error('Error loading teams:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('teams-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams' },
        () => {
          loadTeams()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const filterTeams = () => {
    let filtered = teams

    if (searchTerm) {
      filtered = filtered.filter(team =>
        team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (selectedRole) {
      filtered = filtered.filter(team =>
        team.looking_for_roles.includes(selectedRole)
      )
    }

    if (selectedTech) {
      filtered = filtered.filter(team =>
        team.tech_stack.includes(selectedTech)
      )
    }

    setFilteredTeams(filtered)
  }

  const handleJoinRequest = async () => {
    if (!authData.name || !authData.secretCode || !authData.requestedRole || authData.skills.length === 0) {
      setAuthError('Please fill in all required fields')
      return
    }

    if (authData.secretCode.length < 6 || authData.secretCode.length > 12) {
      setAuthError('Secret code must be 6-12 digits')
      return
    }

    if (!/^\d+$/.test(authData.secretCode)) {
      setAuthError('Secret code must contain only numbers')
      return
    }

    setAuthLoading(true)
    setAuthError('')

    try {
      // Create profile
      const { data: profileId, error: profileError } = await (supabase.rpc as any)('create_profile', {
        p_name: authData.name,
        p_email: authData.email || null,
        p_phone: null,
        p_secret_code: authData.secretCode,
        p_proficiencies: authData.skills
      })

      if (profileError) throw profileError

      // Submit join request
      const { data, error } = await (supabase.rpc as any)('request_to_join', {
        p_profile_id: profileId,
        p_team_id: selectedTeam?.id,
        p_requested_role: authData.requestedRole,
        p_message: authData.requestMessage || null
      })

      if (error) throw error

      // Store profile ID
      sessionStorage.setItem('profileId', profileId)
      sessionStorage.setItem('requestId', data)

      // Show success message
      alert('Join request sent successfully! The team leader will review your request.')
      setShowAuthModal(false)
      setAuthData({
        name: '',
        email: '',
        secretCode: '',
        skills: [],
        requestMessage: '',
        requestedRole: ''
      })
    } catch (err: any) {
      setAuthError(err.message || 'Failed to send join request')
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">
            Join a Team 🤝
          </h1>
          <p className="text-gray-600 mt-2">
            Find the perfect team that matches your skills
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Teams
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Search by name or description"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Role
              </label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="Frontend Developer">Frontend Developer</option>
                <option value="Backend Developer">Backend Developer</option>
                <option value="Full Stack Developer">Full Stack Developer</option>
                <option value="Mobile Developer">Mobile Developer</option>
                <option value="UI/UX Designer">UI/UX Designer</option>
                <option value="Data Scientist">Data Scientist</option>
                <option value="ML Engineer">ML Engineer</option>
                <option value="DevOps Engineer">DevOps Engineer</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Tech Stack
              </label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                value={selectedTech}
                onChange={(e) => setSelectedTech(e.target.value)}
              >
                <option value="">All Technologies</option>
                <option value="React">React</option>
                <option value="Next.js">Next.js</option>
                <option value="Node.js">Node.js</option>
                <option value="Python">Python</option>
                <option value="Java">Java</option>
                <option value="Go">Go</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Found {filteredTeams.length} team{filteredTeams.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center text-sm text-green-600">
              <span className="animate-pulse mr-2 h-2 w-2 bg-green-500 rounded-full"></span>
              Live Updates Enabled
            </div>
          </div>
        </div>

        {/* Teams Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-600">Loading teams...</div>
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-lg">
            <div className="text-6xl mb-4">😔</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No teams found
            </h3>
            <p className="text-gray-600">
              Try adjusting your filters or check back later
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.map((team) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                className="bg-white rounded-xl shadow-lg overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">
                      {team.name}
                    </h3>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      {team.member_count} member{team.member_count !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {team.description}
                  </p>

                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Looking for:</p>
                    <div className="flex flex-wrap gap-1">
                      {team.looking_for_roles.slice(0, 3).map((role) => (
                        <span
                          key={role}
                          className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded"
                        >
                          {role}
                        </span>
                      ))}
                      {team.looking_for_roles.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          +{team.looking_for_roles.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {team.tech_stack.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Tech Stack:</p>
                      <div className="flex flex-wrap gap-1">
                        {team.tech_stack.slice(0, 4).map((tech) => (
                          <span
                            key={tech}
                            className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                          >
                            {tech}
                          </span>
                        ))}
                        {team.tech_stack.length > 4 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            +{team.tech_stack.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setSelectedTeam(team)
                      setAuthData({ ...authData, requestedRole: team.looking_for_roles[0] || '' })
                      setShowAuthModal(true)
                    }}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2 px-4 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                  >
                    Request to Join →
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Join {selectedTeam?.name}</h2>
                <button
                  onClick={() => setShowAuthModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {authError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {authError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    value={authData.name}
                    onChange={(e) => setAuthData({...authData, name: e.target.value})}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    value={authData.email}
                    onChange={(e) => setAuthData({...authData, email: e.target.value})}
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secret Code * (6-12 digits)
                  </label>
                  <input
                    type="password"
                    maxLength={12}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    value={authData.secretCode}
                    onChange={(e) => setAuthData({...authData, secretCode: e.target.value})}
                    placeholder="Enter 6-12 digit code"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Remember this code for future access!
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Requested Role *
                  </label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    value={authData.requestedRole}
                    onChange={(e) => setAuthData({...authData, requestedRole: e.target.value})}
                  >
                    {selectedTeam?.looking_for_roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Skills * (Select at least one)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {availableSkills.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => {
                          if (authData.skills.includes(skill)) {
                            setAuthData({
                              ...authData,
                              skills: authData.skills.filter(s => s !== skill)
                            })
                          } else {
                            setAuthData({
                              ...authData,
                              skills: [...authData.skills, skill]
                            })
                          }
                        }}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          authData.skills.includes(skill)
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message to Team (Optional)
                  </label>
                  <textarea
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={3}
                    value={authData.requestMessage}
                    onChange={(e) => setAuthData({...authData, requestMessage: e.target.value})}
                    placeholder="Tell the team why you'd be a great fit..."
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowAuthModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinRequest}
                  disabled={authLoading}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2 px-4 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {authLoading ? 'Sending...' : 'Send Join Request'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}