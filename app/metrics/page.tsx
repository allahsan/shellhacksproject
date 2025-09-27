'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

type Metrics = {
  totalTeams: number
  totalMembers: number
  activeTeams: number
  completedTeams: number
  averageTeamSize: number
  mostPopularRoles: { role: string; count: number }[]
  mostPopularTech: { tech: string; count: number }[]
  recentActivity: {
    hour: string
    teams: number
    members: number
  }[]
  teamsByStatus: {
    status: string
    count: number
  }[]
  userStatuses: {
    status: string
    count: number
  }[]
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    loadMetrics()
    const interval = setInterval(() => {
      loadMetrics(true)
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const loadMetrics = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // Fetch total teams
      const { count: totalTeams } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })

      // Fetch active teams (recruiting or forming)
      const { count: activeTeams } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .in('status', ['recruiting', 'forming'])

      // Fetch completed teams (closed)
      const { count: completedTeams } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'closed')

      // Fetch total members
      const { count: totalMembers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      // Calculate average team size
      const { data: teamSizes } = await supabase
        .from('team_members')
        .select('team_id')

      const teamMemberCounts: { [key: string]: number } = {}
      teamSizes?.forEach((tm: any) => {
        teamMemberCounts[tm.team_id] = (teamMemberCounts[tm.team_id] || 0) + 1
      })
      const averageTeamSize = Object.values(teamMemberCounts).length > 0
        ? Object.values(teamMemberCounts).reduce((a, b) => a + b, 0) / Object.values(teamMemberCounts).length
        : 0

      // Fetch teams by status
      const { data: teamsByStatusData } = await supabase
        .from('teams')
        .select('status')

      const statusCounts: { [key: string]: number } = {}
      teamsByStatusData?.forEach((team: any) => {
        statusCounts[team.status] = (statusCounts[team.status] || 0) + 1
      })

      const teamsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count
      }))

      // Fetch most popular roles from team_members
      const { data: memberRoles } = await supabase
        .from('team_members')
        .select('role')

      const roleCounts: { [key: string]: number } = {}
      memberRoles?.forEach((member: any) => {
        roleCounts[member.role] = (roleCounts[member.role] || 0) + 1
      })

      const mostPopularRoles = Object.entries(roleCounts)
        .map(([role, count]) => ({ role, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      // Fetch most popular tech from teams
      const { data: techData } = await supabase
        .from('teams')
        .select('tech_stack')
        .not('tech_stack', 'is', null)

      const techCounts: { [key: string]: number } = {}
      techData?.forEach((team: any) => {
        team.tech_stack?.forEach((tech: string) => {
          techCounts[tech] = (techCounts[tech] || 0) + 1
        })
      })

      const mostPopularTech = Object.entries(techCounts)
        .map(([tech, count]) => ({ tech, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      // Fetch user statuses
      const { data: userStatusData } = await supabase
        .from('profiles')
        .select('status')

      const statusTypeCounts: { [key: string]: number } = {
        'available': 0,
        'busy': 0,
        'break': 0,
        'offline': 0
      }

      userStatusData?.forEach((profile: any) => {
        const status = profile.status || 'offline'
        statusTypeCounts[status] = (statusTypeCounts[status] || 0) + 1
      })

      const userStatuses = Object.entries(statusTypeCounts).map(([status, count]) => ({
        status,
        count
      }))

      // Fetch recent activity (last 24 hours)
      const last24Hours = new Date()
      last24Hours.setHours(last24Hours.getHours() - 24)

      const { data: recentTeams } = await supabase
        .from('teams')
        .select('created_at')
        .gte('created_at', last24Hours.toISOString())

      const { data: recentMembers } = await supabase
        .from('team_members')
        .select('joined_at')
        .gte('joined_at', last24Hours.toISOString())

      // Group by hour
      const hourlyActivity: { [key: string]: { teams: number; members: number } } = {}
      const now = new Date()
      for (let i = 0; i < 24; i++) {
        const hour = new Date(now)
        hour.setHours(hour.getHours() - i)
        const hourKey = hour.getHours() + ':00'
        hourlyActivity[hourKey] = { teams: 0, members: 0 }
      }

      recentTeams?.forEach((team: any) => {
        const hour = new Date(team.created_at).getHours() + ':00'
        if (hourlyActivity[hour]) {
          hourlyActivity[hour].teams++
        }
      })

      recentMembers?.forEach((member: any) => {
        const hour = new Date(member.joined_at).getHours() + ':00'
        if (hourlyActivity[hour]) {
          hourlyActivity[hour].members++
        }
      })

      const recentActivity = Object.entries(hourlyActivity)
        .map(([hour, data]) => ({ hour, ...data }))
        .reverse()
        .slice(0, 12) // Last 12 hours

      setMetrics({
        totalTeams: totalTeams || 0,
        totalMembers: totalMembers || 0,
        activeTeams: activeTeams || 0,
        completedTeams: completedTeams || 0,
        averageTeamSize: Math.round(averageTeamSize * 10) / 10,
        mostPopularRoles,
        mostPopularTech,
        recentActivity,
        teamsByStatus,
        userStatuses
      })

      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error loading metrics:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading metrics...</div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Unable to load metrics</h2>
          <Link href="/" className="text-blue-600 hover:text-blue-700">
            ← Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-gray-500 hover:text-gray-700 mr-4">
                ← Back
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">
                TeamDock Metrics Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
              <button
                onClick={() => loadMetrics(true)}
                disabled={refreshing}
                className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  refreshing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Total Teams
            </div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">
              {metrics.totalTeams}
            </div>
            <div className="mt-2 text-sm text-green-600">
              {metrics.activeTeams} active
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Total Members
            </div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">
              {metrics.totalMembers}
            </div>
            <div className="mt-2 text-sm text-blue-600">
              {metrics.userStatuses.find(s => s.status === 'available')?.count || 0} available
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Avg Team Size
            </div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">
              {metrics.averageTeamSize}
            </div>
            <div className="mt-2 text-sm text-gray-600">
              members per team
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Completed Teams
            </div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">
              {metrics.completedTeams}
            </div>
            <div className="mt-2 text-sm text-purple-600">
              {Math.round((metrics.completedTeams / (metrics.totalTeams || 1)) * 100)}% completion rate
            </div>
          </motion.div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Team Status Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Teams by Status
            </h2>
            <div className="space-y-3">
              {metrics.teamsByStatus.map((item) => (
                <div key={item.status} className="flex items-center">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-600 capitalize">
                        {item.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {item.count}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          item.status === 'recruiting' ? 'bg-green-500' :
                          item.status === 'forming' ? 'bg-blue-500' :
                          item.status === 'voting' ? 'bg-red-500' :
                          item.status === 'closed' ? 'bg-purple-500' :
                          'bg-gray-500'
                        }`}
                        style={{
                          width: `${(item.count / (metrics.totalTeams || 1)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* User Status Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              User Status Distribution
            </h2>
            <div className="space-y-3">
              {metrics.userStatuses.map((item) => (
                <div key={item.status} className="flex items-center">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-600 capitalize">
                        {item.status === 'break' ? 'On Break' : item.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {item.count}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          item.status === 'available' ? 'bg-green-500' :
                          item.status === 'busy' ? 'bg-red-500' :
                          item.status === 'break' ? 'bg-yellow-500' :
                          'bg-gray-500'
                        }`}
                        style={{
                          width: `${(item.count / (metrics.totalMembers || 1)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Popular Roles and Tech */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Most Popular Roles */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.6 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Most Popular Roles
            </h2>
            {metrics.mostPopularRoles.length === 0 ? (
              <p className="text-gray-500">No role data available yet</p>
            ) : (
              <div className="space-y-3">
                {metrics.mostPopularRoles.map((role, index) => (
                  <div key={role.role} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-lg font-bold text-gray-400 w-6">
                        {index + 1}
                      </span>
                      <span className="ml-3 text-sm font-medium text-gray-900">
                        {role.role}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {role.count} {role.count === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Most Popular Tech Stack */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.7 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Most Popular Tech Stack
            </h2>
            {metrics.mostPopularTech.length === 0 ? (
              <p className="text-gray-500">No tech stack data available yet</p>
            ) : (
              <div className="space-y-3">
                {metrics.mostPopularTech.map((tech, index) => (
                  <div key={tech.tech} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-lg font-bold text-gray-400 w-6">
                        {index + 1}
                      </span>
                      <span className="ml-3 text-sm font-medium text-gray-900">
                        {tech.tech}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {tech.count} {tech.count === 1 ? 'team' : 'teams'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Activity Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.8 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity (Last 12 Hours)
          </h2>
          <div className="flex items-end space-x-2 h-32">
            {metrics.recentActivity.map((hour) => {
              const maxValue = Math.max(
                ...metrics.recentActivity.map(h => h.teams + h.members),
                1
              )
              const heightPercentage = ((hour.teams + hour.members) / maxValue) * 100

              return (
                <div
                  key={hour.hour}
                  className="flex-1 flex flex-col items-center"
                >
                  <div className="relative w-full">
                    <div
                      className="absolute bottom-0 w-full bg-blue-500 rounded-t"
                      style={{ height: `${heightPercentage}px`, maxHeight: '100px' }}
                      title={`${hour.teams} teams, ${hour.members} members`}
                    />
                    <div
                      className="absolute bottom-0 w-full bg-green-500 rounded-t"
                      style={{
                        height: `${(hour.teams / maxValue) * 100}px`,
                        maxHeight: '100px'
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 mt-2">
                    {hour.hour}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-xs text-gray-600">Teams</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-xs text-gray-600">Members</span>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}