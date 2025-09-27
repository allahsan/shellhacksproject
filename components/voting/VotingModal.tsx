'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'

type VotingModalProps = {
  isOpen: boolean
  onClose: () => void
  teamId: string
  teamName: string
  votingEndsAt: string
  currentUserId: string
  onVotingComplete?: () => void
}

type Candidate = {
  id: string
  name: string
  role: string
  proficiencies: string[]
}

type VoteStatus = {
  hasVoted: boolean
  currentVote?: string
  totalVotes: number
  votingRound: number
}

export default function VotingModal({
  isOpen,
  onClose,
  teamId,
  teamName,
  votingEndsAt,
  currentUserId,
  onVotingComplete
}: VotingModalProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<string>('')
  const [voteStatus, setVoteStatus] = useState<VoteStatus>({
    hasVoted: false,
    totalVotes: 0,
    votingRound: 1
  })
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && teamId) {
      loadCandidates()
      loadVoteStatus()
      setupRealtimeSubscription()
    }
  }, [isOpen, teamId])

  useEffect(() => {
    if (!votingEndsAt) return

    const interval = setInterval(() => {
      const ends = new Date(votingEndsAt).getTime()
      const now = new Date().getTime()
      const diff = Math.max(0, ends - now)

      setTimeLeft(Math.floor(diff / 1000))

      if (diff === 0) {
        clearInterval(interval)
        if (onVotingComplete) onVotingComplete()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [votingEndsAt, onVotingComplete])

  const loadCandidates = async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        profile_id,
        role,
        profile:profiles!inner(
          id,
          name,
          proficiencies
        )
      `)
      .eq('team_id', teamId)
      .neq('profile_id', currentUserId)

    if (data && !error) {
      setCandidates(data.map((m: any) => ({
        id: m.profile_id,
        name: m.profile.name,
        role: m.role,
        proficiencies: m.profile.proficiencies
      })))
    }
  }

  const loadVoteStatus = async () => {
    const { data: votes } = await supabase
      .from('leader_votes')
      .select('*')
      .eq('team_id', teamId)
      .order('voting_round', { ascending: false })
      .limit(1)

    if (votes && votes.length > 0) {
      const currentRound = (votes[0] as any).voting_round
      const userVote = votes.find((v: any) => v.voter_id === currentUserId)

      const { count } = await supabase
        .from('leader_votes')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('voting_round', currentRound)

      setVoteStatus({
        hasVoted: !!userVote,
        currentVote: (userVote as any)?.candidate_id,
        totalVotes: count || 0,
        votingRound: currentRound
      })
    }
  }

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`voting-${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leader_votes',
          filter: `team_id=eq.${teamId}`
        },
        () => {
          loadVoteStatus()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const handleVote = async () => {
    if (!selectedCandidate) {
      setError('Please select a candidate')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data, error } = await (supabase.rpc as any)('cast_vote', {
        p_team_id: teamId,
        p_voter_id: currentUserId,
        p_candidate_id: selectedCandidate
      })

      if (error) throw error

      setVoteStatus(prev => ({
        ...prev,
        hasVoted: true,
        currentVote: selectedCandidate
      }))

      if ('navigator' in window && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit vote')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white border-2 border-black w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black">🗳️ Leader Election</h2>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-black"
                  disabled={loading}
                >
                  ✕
                </button>
              </div>

              <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-400">
                <p className="font-bold text-sm mb-2">⚡ URGENT: Leader has left!</p>
                <p className="text-sm">
                  The team leader has left {teamName}. Vote for a new leader to continue.
                </p>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold">Time Remaining:</span>
                  <span className={`font-mono text-lg ${timeLeft < 60 ? 'text-red-600' : ''}`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 h-2">
                  <div
                    className="bg-black h-full transition-all duration-1000"
                    style={{ width: `${(timeLeft / 300) * 100}%` }}
                  />
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 text-red-700 text-sm">
                  {error}
                </div>
              )}

              {voteStatus.hasVoted ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border-2 border-green-500">
                    <p className="font-bold text-green-700">✓ Your vote has been recorded</p>
                    <p className="text-sm text-green-600 mt-1">
                      You can change your vote anytime before the timer ends.
                    </p>
                  </div>

                  <div className="text-sm text-gray-600">
                    <p>Total votes cast: {voteStatus.totalVotes}</p>
                    <p>Voting round: {voteStatus.votingRound}</p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3 mb-6">
                <label className="font-bold">Select New Leader:</label>
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    onClick={() => setSelectedCandidate(candidate.id)}
                    disabled={loading}
                    className={`w-full p-4 border-2 text-left transition-all ${
                      selectedCandidate === candidate.id
                        ? 'border-black bg-gray-100'
                        : voteStatus.currentVote === candidate.id
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-gray-500'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold">{candidate.name}</p>
                        <p className="text-sm text-gray-600">{candidate.role}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {candidate.proficiencies.slice(0, 3).map((skill) => (
                            <span key={skill} className="text-xs px-2 py-1 bg-gray-100">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="ml-2">
                        {selectedCandidate === candidate.id && (
                          <span className="text-2xl">✓</span>
                        )}
                        {voteStatus.currentVote === candidate.id && !selectedCandidate && (
                          <span className="text-xs px-2 py-1 bg-green-500 text-white">
                            Current Vote
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleVote}
                  disabled={loading || !selectedCandidate}
                  className="flex-1 py-3 bg-black text-white font-bold border-2 border-black disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : voteStatus.hasVoted ? 'Change Vote' : 'Submit Vote'}
                </button>
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="px-6 py-3 bg-white text-black font-bold border-2 border-gray-300 hover:border-black"
                >
                  Later
                </button>
              </div>

              {candidates.length === 0 && (
                <div className="mt-4 p-4 bg-gray-50 text-center">
                  <p className="text-gray-600">No other members to vote for.</p>
                  <p className="text-sm text-gray-500 mt-1">
                    The team will be disbanded if no members remain.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}