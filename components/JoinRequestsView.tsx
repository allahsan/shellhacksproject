'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'

type JoinRequest = {
  id: string
  profile_id: string
  requested_role: string
  message: string | null
  status: string
  created_at: string
  requester: {
    name: string
    email: string | null
    phone: string | null
    proficiencies: string[]
  }
}

interface JoinRequestsViewProps {
  profileId: string
  teamId: string
  teamName: string
  isLeader?: boolean
}

export default function JoinRequestsView({ profileId, teamId, teamName, isLeader = false }: JoinRequestsViewProps) {
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    if (teamId) {
      loadJoinRequests()
      const unsubscribe = setupRealtimeSubscription()
      return () => unsubscribe()
    }
  }, [teamId])

  const loadJoinRequests = async () => {
    if (!teamId) {
      console.log('No teamId provided')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      console.log('Loading join requests for team:', teamId)

      // First get join requests
      const { data: requests, error: requestsError } = await supabase
        .from('join_requests')
        .select('*')
        .eq('team_id', teamId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      console.log('Raw requests:', requests)

      if (requestsError) {
        console.error('Error loading requests:', requestsError)
        return
      }

      if (requests && requests.length > 0) {
        // Then get profiles for each request
        const profileIds = requests.map(r => r.profile_id)
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, email, phone, proficiencies')
          .in('id', profileIds)

        console.log('Profiles:', profiles)

        if (profilesError) {
          console.error('Error loading profiles:', profilesError)
          return
        }

        // Check which profiles are already team members
        const { data: existingMembers } = await supabase
          .from('team_members')
          .select('profile_id')
          .eq('team_id', teamId)
          .in('profile_id', profileIds)

        const existingMemberIds = new Set(existingMembers?.map(m => m.profile_id) || [])

        // Filter out requests from existing members and combine the data
        const validRequests = requests.filter(r => !existingMemberIds.has(r.profile_id))

        const combinedData = validRequests.map(request => ({
          ...request,
          requester: profiles?.find(p => p.id === request.profile_id) || {
            name: 'Unknown',
            email: null,
            phone: null,
            proficiencies: []
          }
        }))

        console.log('Combined data:', combinedData)
        setJoinRequests(combinedData as any)
      } else {
        setJoinRequests([])
      }
    } catch (error) {
      console.error('Error loading join requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('join-requests')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'join_requests',
        filter: `team_id=eq.${teamId}`
      }, () => {
        loadJoinRequests()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const handleAcceptRequest = async (requestId: string) => {
    if (!isLeader) {
      alert('Only the team leader can accept join requests')
      return
    }
    setProcessing(requestId)
    try {
      const { data, error } = await (supabase.rpc as any)('respond_to_request', {
        p_request_id: requestId,
        p_leader_id: profileId,
        p_accept: true
      })

      if (error) {
        console.error('Error accepting request:', error)
        // Check for specific error messages
        if (error.message?.includes('already a member') || error.message?.includes('unique_member_per_team') || error.code === '23505') {
          alert('This person is already a member of your team. The request will be removed.')
        } else if (error.message?.includes('not found')) {
          alert('Request not found. It may have been processed already.')
        } else if (error.message?.includes('not authorized') || error.message?.includes('Only team leader')) {
          alert('Only the team leader can manage join requests.')
        } else {
          alert(`Failed to accept request: ${error.message || 'Unknown error'}`)
        }
        // Refresh the list anyway in case the status changed
        await loadJoinRequests()
      } else {
        if (data?.success === false) {
          alert(data.error || 'Failed to accept request')
        } else {
          alert('Member added successfully!')
        }
        await loadJoinRequests()
      }
    } catch (error) {
      console.error('Error accepting request:', error)
      alert('An unexpected error occurred. Please try again.')
    } finally {
      setProcessing(null)
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    if (!isLeader) {
      alert('Only the team leader can reject join requests')
      return
    }
    setProcessing(requestId)
    try {
      const { error } = await (supabase.rpc as any)('respond_to_request', {
        p_request_id: requestId,
        p_leader_id: profileId,
        p_accept: false
      })

      if (!error) {
        loadJoinRequests()
      }
    } catch (error) {
      console.error('Error rejecting request:', error)
    } finally {
      setProcessing(null)
    }
  }

  if (!teamId) {
    return (
      <div className="bg-white border-2 border-black p-12 shadow-[4px_4px_0px_rgba(0,0,0,1)] text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-black text-gray-400 mb-2">No Team Found</h2>
        <p className="text-gray-600">You need to be a team leader to view join requests.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
        <h1 className="text-3xl font-black text-gray-900">📋 Join Requests</h1>
        <p className="text-gray-600 mt-2">Manage join requests for <span className="font-bold">{teamName}</span></p>
      </div>

      {/* Requests List */}
      {joinRequests.length === 0 ? (
        <div className="bg-white border-2 border-black p-12 shadow-[4px_4px_0px_rgba(0,0,0,1)] text-center">
          <div className="text-6xl mb-4">📭</div>
          <h2 className="text-2xl font-black text-gray-400 mb-2">No Pending Requests</h2>
          <p className="text-gray-600">When hackers request to join your team, they'll appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {joinRequests.map((request) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Requester Info */}
                  <div className="mb-4">
                    <h3 className="text-xl font-black text-gray-900">{request.requester.name}</h3>
                    <p className="text-gray-600">
                      Requesting: <span className="font-bold text-amber-600">{request.requested_role}</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Applied {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Contact Info */}
                  <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
                    <p className="text-sm text-gray-600">
                      <span className="font-bold">Email:</span> {request.requester.email || 'Not provided'}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-bold">Phone:</span> {request.requester.phone || 'Not provided'}
                    </p>
                  </div>

                  {/* Skills */}
                  <div className="mb-4">
                    <p className="text-sm font-bold text-gray-700 mb-2">Skills:</p>
                    <div className="flex flex-wrap gap-2">
                      {request.requester.proficiencies.map((skill) => (
                        <span
                          key={skill}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Message */}
                  {request.message && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded">
                      <p className="text-sm font-bold text-gray-700 mb-1">Message:</p>
                      <p className="text-sm text-gray-700">{request.message}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAcceptRequest(request.id)}
                      disabled={processing === request.id}
                      className="px-6 py-2 bg-green-500 text-white font-black border-2 border-black hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                    >
                      {processing === request.id ? 'PROCESSING...' : 'ACCEPT ✓'}
                    </button>
                    <button
                      onClick={() => handleRejectRequest(request.id)}
                      disabled={processing === request.id || !isLeader}
                      className="px-6 py-2 bg-red-500 text-white font-black border-2 border-black hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                    >
                      {processing === request.id ? 'PROCESSING...' : 'REJECT ✕'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Real-time indicator */}
      <div className="text-center">
        <span className="text-xs text-gray-500">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></span>
          Live updates enabled • Requests refresh automatically
        </span>
      </div>
    </div>
  )
}