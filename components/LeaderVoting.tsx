'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'

interface TeamMember {
  id: string
  profile_id: string
  role: string
  presence?: 'online' | 'away' | 'busy' | 'offline'
  profiles: {
    id: string
    name: string
  }
}

interface VotingRound {
  id: string
  team_id: string
  started_at: string
  ends_at: string
  status: 'active' | 'completed' | 'failed'
  winner_id?: string
  total_votes: number
}

interface Vote {
  candidate_id: string
  count: number
  percentage: number
}

interface LeaderVotingProps {
  teamId: string
  userId: string
  currentLeaderId: string | null
}

export default function LeaderVoting({ teamId, userId, currentLeaderId }: LeaderVotingProps) {
  const [votingRound, setVotingRound] = useState<VotingRound | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [myVote, setMyVote] = useState<string | null>(null)
  const [votes, setVotes] = useState<Vote[]>([])
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<string>('')

  useEffect(() => {
    loadVotingData()
    const interval = setInterval(updateTimeRemaining, 1000)

    // Set up realtime subscription
    const channel = supabase
      .channel(`voting-${teamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'voting_rounds',
        filter: `team_id=eq.${teamId}`
      }, () => {
        loadVotingData()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leader_votes',
        filter: `team_id=eq.${teamId}`
      }, () => {
        loadVotingData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [teamId])

  const loadVotingData = async () => {
    try {
      // Check for active voting round
      const { data: roundData } = await (supabase as any)
        .from('voting_rounds')
        .select('*')
        .eq('team_id', teamId)
        .eq('status', 'active')
        .single()

      if (roundData) {
        setVotingRound(roundData)

        // Load team members
        const { data: membersData } = await supabase
          .from('team_members')
          .select(`
            *,
            profiles:profile_id(id, name)
          `)
          .eq('team_id', teamId)

        setTeamMembers(membersData || [])

        // Load current votes
        const { data: votesData } = await supabase
          .from('leader_votes')
          .select('candidate_id')
          .eq('voting_round_id', roundData.id)

        if (votesData) {
          // Count votes per candidate
          const voteCounts = votesData.reduce((acc, vote) => {
            acc[vote.candidate_id] = (acc[vote.candidate_id] || 0) + 1
            return acc
          }, {} as Record<string, number>)

          const totalVotes = votesData.length
          const voteResults: Vote[] = Object.entries(voteCounts).map(([candidateId, count]) => ({
            candidate_id: candidateId,
            count: count,
            percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          }))

          setVotes(voteResults.sort((a, b) => b.count - a.count))
        }

        // Check if user has voted
        const { data: myVoteData } = await supabase
          .from('leader_votes')
          .select('candidate_id')
          .eq('voting_round_id', roundData.id)
          .eq('voter_id', userId)
          .single()

        if (myVoteData) {
          setMyVote(myVoteData.candidate_id)
        }
      } else {
        setVotingRound(null)
      }
    } catch (error) {
      console.error('Error loading voting data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateTimeRemaining = () => {
    if (!votingRound) return

    const endsAt = new Date(votingRound.ends_at)
    const now = new Date()
    const diff = endsAt.getTime() - now.getTime()

    if (diff <= 0) {
      setTimeRemaining('Voting ended')
      // Check for completion
      checkVotingCompletion()
    } else {
      const minutes = Math.floor(diff / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setTimeRemaining(`${minutes}m ${seconds}s`)
    }
  }

  const checkVotingCompletion = async () => {
    if (!votingRound) return

    try {
      const { data, error } = await (supabase.rpc as any)('finalize_voting', {
        p_round_id: votingRound.id
      })

      if (data?.success) {
        // Reload data to show results
        await loadVotingData()
      }
    } catch (error) {
      console.error('Error finalizing voting:', error)
    }
  }

  const initiateVoting = async () => {
    setVoting(true)
    try {
      const { data, error } = await (supabase.rpc as any)('initiate_leader_vote', {
        p_team_id: teamId
      })

      if (error) throw error

      if (data?.success) {
        await loadVotingData()
      } else {
        alert(data?.error || 'Failed to start voting')
      }
    } catch (error) {
      console.error('Error initiating vote:', error)
      alert('Failed to start voting')
    } finally {
      setVoting(false)
    }
  }

  const castVote = async () => {
    if (!selectedCandidate || !votingRound) return

    setVoting(true)
    try {
      const { data, error } = await (supabase.rpc as any)('cast_vote', {
        p_voter_id: userId,
        p_team_id: teamId,
        p_candidate_id: selectedCandidate
      })

      if (error) throw error

      if (data?.success) {
        setMyVote(selectedCandidate)
        await loadVotingData()
      } else {
        alert(data?.error || 'Failed to cast vote')
      }
    } catch (error) {
      console.error('Error casting vote:', error)
      alert('Failed to cast vote')
    } finally {
      setVoting(false)
    }
  }

  const getMemberName = (profileId: string) => {
    const member = teamMembers.find(m => m.profile_id === profileId)
    return member?.profiles?.name || 'Unknown'
  }

  const getVoteCount = (candidateId: string) => {
    const vote = votes.find(v => v.candidate_id === candidateId)
    return vote?.count || 0
  }

  const getVotePercentage = (candidateId: string) => {
    const vote = votes.find(v => v.candidate_id === candidateId)
    return vote?.percentage || 0
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    )
  }

  // No leader and no voting
  if (!currentLeaderId && !votingRound) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-amber-50 border-2 border-amber-400 p-6 shadow-[4px_4px_0px_rgba(251,191,36,1)]"
      >
        <h3 className="text-xl font-black text-amber-800 mb-3">
          ⚠️ NO TEAM LEADER
        </h3>
        <p className="text-gray-700 mb-4">
          This team currently has no leader. Team members can vote to elect a new leader.
        </p>
        <button
          onClick={initiateVoting}
          disabled={voting}
          className="px-6 py-2 bg-amber-500 text-white font-black border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
        >
          {voting ? 'STARTING...' : '🗳️ START LEADER ELECTION'}
        </button>
      </motion.div>
    )
  }

  // Active voting
  if (votingRound && votingRound.status === 'active') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)]"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black text-gray-900">
            🗳️ LEADER ELECTION IN PROGRESS
          </h3>
          <div className="px-3 py-1 bg-red-500 text-white font-black rounded animate-pulse">
            {timeRemaining}
          </div>
        </div>

        <div className="space-y-4">
          {teamMembers.map((member) => (
            <div
              key={member.profile_id}
              className={`p-4 border-2 border-gray-300 ${
                myVote === member.profile_id
                  ? 'bg-amber-50 border-amber-500 shadow-[2px_2px_0px_rgba(251,191,36,1)]'
                  : selectedCandidate === member.profile_id
                  ? 'bg-gray-50 border-black'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="candidate"
                    value={member.profile_id}
                    checked={selectedCandidate === member.profile_id}
                    onChange={(e) => setSelectedCandidate(e.target.value)}
                    disabled={!!myVote}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-black text-gray-900">
                      {member.profiles.name}
                      {member.role === 'leader' && ' 👑'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Current role: {member.role}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-black text-2xl text-gray-900">
                    {getVoteCount(member.profile_id)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {getVotePercentage(member.profile_id)}%
                  </p>
                </div>
              </div>

              {getVoteCount(member.profile_id) > 0 && (
                <div className="mt-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-amber-500"
                    style={{ width: `${getVotePercentage(member.profile_id)}%` }}
                  />
                </div>
              )}

              {myVote === member.profile_id && (
                <p className="text-sm text-green-600 font-bold mt-2">
                  ✓ Your vote
                </p>
              )}
            </div>
          ))}
        </div>

        {!myVote && (
          <button
            onClick={castVote}
            disabled={!selectedCandidate || voting}
            className="mt-4 w-full px-6 py-3 bg-green-500 text-white font-black border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
          >
            {voting ? 'CASTING VOTE...' : 'CAST YOUR VOTE'}
          </button>
        )}

        {myVote && (
          <div className="mt-4 p-3 bg-green-50 border-2 border-green-500">
            <p className="text-green-700 font-bold">
              ✓ You have voted. You can change your vote until voting ends.
            </p>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-4">
          Total votes: {votingRound.total_votes} • Voting ends in {timeRemaining}
        </p>
      </motion.div>
    )
  }

  return null
}