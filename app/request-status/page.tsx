'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function RequestStatusPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [requestStatus, setRequestStatus] = useState<'pending' | 'accepted' | 'rejected' | 'none'>('none')
  const [teamName, setTeamName] = useState('')
  const [profileId, setProfileId] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [teamId, setTeamId] = useState<string | null>(null)

  useEffect(() => {
    checkRequestStatus()
    setupRealtimeSubscription()
  }, [])

  const checkRequestStatus = async () => {
    setLoading(true)
    try {
      // Get stored session data
      const storedProfileId = sessionStorage.getItem('profileId')
      const storedRequestId = sessionStorage.getItem('requestId')
      const storedTeamName = sessionStorage.getItem('pendingTeamName')
      const storedTeamId = sessionStorage.getItem('pendingTeamId')

      if (!storedProfileId) {
        router.push('/')
        return
      }

      setProfileId(storedProfileId)
      setRequestId(storedRequestId)
      setTeamName(storedTeamName || 'Unknown Team')
      setTeamId(storedTeamId)

      // Check if user is already in a team
      const { data: memberData } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('profile_id', storedProfileId)
        .eq('status', 'active')
        .single()

      if (memberData) {
        // User is now in a team, request was accepted
        sessionStorage.removeItem('hasPendingRequest')
        sessionStorage.removeItem('pendingTeamId')
        sessionStorage.removeItem('pendingTeamName')
        sessionStorage.removeItem('requestId')
        router.push('/manage-team')
        return
      }

      // Check current request status
      if (storedRequestId) {
        const { data: requestData } = await supabase
          .from('join_requests')
          .select('status, team_id, teams(name)')
          .eq('id', storedRequestId)
          .single()

        if (requestData) {
          setRequestStatus(requestData.status as any)
          if (requestData.teams) {
            setTeamName((requestData.teams as any).name)
          }

          if (requestData.status === 'accepted') {
            // Request accepted, redirect to team
            sessionStorage.removeItem('hasPendingRequest')
            sessionStorage.removeItem('pendingTeamId')
            sessionStorage.removeItem('pendingTeamName')
            router.push('/manage-team')
          }
        } else {
          // Try to find any pending request for this user
          const { data: pendingRequest } = await supabase
            .from('join_requests')
            .select('id, status, team_id, teams(name)')
            .eq('profile_id', storedProfileId)
            .eq('status', 'pending')
            .single()

          if (pendingRequest) {
            setRequestStatus('pending')
            setRequestId(pendingRequest.id)
            setTeamId(pendingRequest.team_id)
            if (pendingRequest.teams) {
              setTeamName((pendingRequest.teams as any).name)
            }
            sessionStorage.setItem('requestId', pendingRequest.id)
            sessionStorage.setItem('pendingTeamId', pendingRequest.team_id)
            sessionStorage.setItem('pendingTeamName', (pendingRequest.teams as any)?.name || '')
          } else {
            setRequestStatus('none')
          }
        }
      }
    } catch (error) {
      console.error('Error checking request status:', error)
      setRequestStatus('none')
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const profileId = sessionStorage.getItem('profileId')
    if (!profileId) return

    const channel = supabase
      .channel('request-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'join_requests',
          filter: `profile_id=eq.${profileId}`
        },
        () => {
          checkRequestStatus()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_members',
          filter: `profile_id=eq.${profileId}`
        },
        () => {
          checkRequestStatus()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const handleWithdrawRequest = async () => {
    if (!requestId) return

    if (!confirm('Are you sure you want to withdraw your join request?')) return

    try {
      const { error } = await supabase
        .from('join_requests')
        .update({
          status: 'withdrawn',
          withdrawn_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (error) throw error

      sessionStorage.removeItem('hasPendingRequest')
      sessionStorage.removeItem('pendingTeamId')
      sessionStorage.removeItem('pendingTeamName')
      sessionStorage.removeItem('requestId')

      router.push('/join-team')
    } catch (error) {
      console.error('Error withdrawing request:', error)
      alert('Failed to withdraw request. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-gray-600">Checking request status...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
            ← Back to Home
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-8"
          >
            {requestStatus === 'pending' && (
              <>
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">⏳</span>
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Request Pending
                  </h1>
                  <p className="text-gray-600">
                    Your request to join <span className="font-semibold">{teamName}</span> is being reviewed
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    💡 The team leader will review your request soon. You'll be notified once they make a decision.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-6">
                  <div className="flex items-center">
                    <span className="animate-pulse mr-3 h-3 w-3 bg-green-500 rounded-full"></span>
                    <span className="text-sm text-gray-600">Real-time status updates active</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleWithdrawRequest}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                  >
                    Withdraw Request
                  </button>
                  <Link
                    href="/join-team"
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-center"
                  >
                    Browse Other Teams
                  </Link>
                </div>
              </>
            )}

            {requestStatus === 'accepted' && (
              <>
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">🎉</span>
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Request Accepted!
                  </h1>
                  <p className="text-gray-600">
                    Welcome to <span className="font-semibold">{teamName}</span>!
                  </p>
                </div>

                <button
                  onClick={() => router.push('/manage-team')}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  Go to Team Dashboard →
                </button>
              </>
            )}

            {requestStatus === 'rejected' && (
              <>
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">😔</span>
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Request Not Accepted
                  </h1>
                  <p className="text-gray-600">
                    Your request to join {teamName} was not accepted
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    Don't worry! There are many other teams looking for talented members like you.
                  </p>
                </div>

                <Link
                  href="/join-team"
                  className="block w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-center"
                >
                  Find Another Team →
                </Link>
              </>
            )}

            {requestStatus === 'none' && (
              <>
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">🔍</span>
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    No Active Request
                  </h1>
                  <p className="text-gray-600">
                    You don't have any pending join requests
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Link
                    href="/join-team"
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-center"
                  >
                    Join a Team
                  </Link>
                  <Link
                    href="/start-team"
                    className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-center"
                  >
                    Start a Team
                  </Link>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}