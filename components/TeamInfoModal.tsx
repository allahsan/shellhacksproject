'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

type TeamMember = {
  id: string
  role: string
  profile: {
    name: string
    proficiencies: string[]
  }
}

type Team = {
  id: string
  name: string
  description: string
  status: string
  looking_for_roles: string[]
  tech_stack: string[]
}

interface TeamInfoModalProps {
  isOpen: boolean
  onClose: () => void
  team: Team
  currentUserId?: string
}

export default function TeamInfoModal({ isOpen, onClose, team, currentUserId }: TeamInfoModalProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [recentPosts, setRecentPosts] = useState<any[]>([])

  useEffect(() => {
    if (isOpen && team) {
      loadTeamDetails()
    }
  }, [isOpen, team])

  const loadTeamDetails = async () => {
    setLoadingMembers(true)
    try {
      // Load team members
      const { data: membersData } = await supabase
        .from('team_members')
        .select(`
          id,
          role,
          profile:profiles(
            name,
            proficiencies
          )
        `)
        .eq('team_id', team.id)
        .eq('status', 'active')

      if (membersData) {
        setMembers(membersData as any)
      }

      // Load recent posts from this team
      const { data: postsData } = await supabase
        .from('team_posts')
        .select('*')
        .eq('team_id', team.id)
        .order('created_at', { ascending: false })
        .limit(3)

      if (postsData) {
        setRecentPosts(postsData)
      }
    } catch (error) {
      console.error('Error loading team details:', error)
    } finally {
      setLoadingMembers(false)
    }
  }

  if (!isOpen) return null

  const isRecruiting = team.status === 'recruiting' || team.status === 'forming'
  const openRoles = team.looking_for_roles.filter(
    role => !members.some(m => m.role === role)
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[55%] translate-y-[-50%] md:inset-x-auto md:left-[55%] md:translate-x-[-50%] max-w-3xl w-full max-h-[80vh] overflow-hidden bg-white/95 backdrop-blur-md border-2 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] z-50"
          >
            {/* Header */}
            <div className="relative bg-amber-500 text-black p-4 border-b-2 border-black">
              <button
                onClick={onClose}
                className="absolute top-2 right-2 text-black hover:bg-amber-600 p-1 rounded transition-colors"
              >
                <span className="text-lg font-black">✕</span>
              </button>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-black text-amber-500 flex items-center justify-center text-xl font-black">
                    {team.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black">{team.name}</h2>
                    <span className="text-sm font-bold">{members.length} HACKERS</span>
                  </div>
                </div>
                <div className="mr-8">
                  <span className={`px-3 py-1.5 rounded text-sm font-bold border-2 ${
                    isRecruiting ? 'bg-green-400 border-black text-black shadow-[2px_2px_0px_rgba(0,0,0,1)]' : 'bg-gray-300 border-black text-black'
                  }`}>
                    {isRecruiting ? '🔥 RECRUITING' : '🔒 LOCKED'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3 bg-gradient-to-br from-amber-50/90 to-orange-50/90 max-h-[calc(80vh-80px)] overflow-y-auto modal-scroll">
              {/* Description */}
              <div className="bg-white p-3 border border-gray-300">
                <h3 className="font-bold text-sm text-black mb-1">🚀 PROJECT</h3>
                <p className="text-sm text-gray-800 leading-snug">
                  {team.description}
                </p>
              </div>

              {/* Tech Stack */}
              {team.tech_stack.length > 0 && (
                <div className="bg-white p-3 border border-gray-300">
                  <h3 className="font-bold text-sm text-black mb-2">⚡ TECH</h3>
                  <div className="flex flex-wrap gap-2">
                    {team.tech_stack.map((tech) => (
                      <span
                        key={tech}
                        className="px-2 py-1 bg-amber-100 text-amber-800 border border-amber-600 text-xs font-medium"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Team Members */}
              <div className="bg-white p-3 border border-gray-300">
                <h3 className="font-bold text-sm text-black mb-2">👥 SQUAD</h3>
                {loadingMembers ? (
                  <div className="text-sm text-gray-600">Loading...</div>
                ) : members.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="bg-gray-50 p-2 border border-gray-200"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-black text-sm truncate">
                              {member.profile.name}
                            </span>
                            <span className="text-xs text-amber-700">
                              • {member.role}
                            </span>
                          </div>
                          {member.profile.proficiencies.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              <span className="px-1 py-0.5 bg-black text-amber-500 text-[10px]">
                                {member.profile.proficiencies[0]}
                              </span>
                              {member.profile.proficiencies.length > 1 && (
                                <span className="px-1 py-0.5 bg-gray-600 text-white text-[10px]">
                                  +{member.profile.proficiencies.length - 1}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No members yet</p>
                )}
              </div>

              {/* Open Positions */}
              {isRecruiting && openRoles.length > 0 && (
                <div className="bg-green-50 p-3 border border-gray-300">
                  <h3 className="font-bold text-sm text-black mb-2">🎯 OPEN ROLES</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {openRoles.map((role) => (
                      <div
                        key={role}
                        className="bg-white border border-green-600 border-dashed p-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-xs text-green-800 truncate">
                            {role}
                          </span>
                          <span className="text-[10px] text-green-600 ml-1">OPEN</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              {recentPosts.length > 0 && (
                <div className="bg-white p-3 border border-gray-300">
                  <h3 className="font-bold text-sm text-black mb-2">📢 UPDATES</h3>
                  <div className="space-y-2">
                    {recentPosts.slice(0, 2).map((post) => (
                      <div key={post.id} className="bg-gray-50 border-l-2 border-amber-500 pl-2 py-1">
                        <p className="text-xs text-gray-800 line-clamp-2">
                          {post.content}
                        </p>
                        <span className="text-[10px] text-gray-500">
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 pb-2 border-t border-gray-300">
                {isRecruiting && openRoles.length > 0 && currentUserId && (
                  <Link
                    href="/join-team"
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-black text-center py-2 px-4 border-2 border-black font-bold text-sm transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_rgba(0,0,0,1)]"
                  >
                    JOIN TEAM 🚀
                  </Link>
                )}
                <button
                  onClick={onClose}
                  className="flex-1 bg-white hover:bg-gray-100 text-black py-2 px-4 border-2 border-black font-bold text-sm transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_rgba(0,0,0,1)]"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}