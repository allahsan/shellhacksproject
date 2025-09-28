'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'

interface PostCreationModalProps {
  isOpen: boolean
  onClose: () => void
  profileId: string
  userName: string
  onPostCreated: () => void
}

export default function PostCreationModal({
  isOpen,
  onClose,
  profileId,
  userName,
  onPostCreated
}: PostCreationModalProps) {
  const [content, setContent] = useState('')
  const [postType, setPostType] = useState<'update' | 'milestone' | 'looking_for' | 'announcement' | 'achievement'>('update')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const postTypes = [
    { value: 'update', label: '💬 Update', description: 'Share what you\'re working on' },
    { value: 'milestone', label: '🎯 Milestone', description: 'Celebrate a achievement' },
    { value: 'looking_for', label: '👀 Looking For', description: 'Need team members?' },
    { value: 'announcement', label: '📢 Announcement', description: 'Important news' },
    { value: 'achievement', label: '🏆 Achievement', description: 'Share your win!' }
  ]

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('Come on, write something! Don\'t be shy 😊')
      return
    }

    if (content.length > 1000) {
      setError('Keep it under 1000 characters, we\'re not writing a novel here! 📚')
      return
    }

    setLoading(true)
    setError('')

    try {
      // First, check if user has a team
      let teamId = null

      const { data: teamMember } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('profile_id', profileId)
        .eq('status', 'active')
        .single()

      if (teamMember) {
        teamId = teamMember.team_id
      } else {
        // Check if user is a team leader
        const { data: team } = await supabase
          .from('teams')
          .select('id')
          .eq('leader_id', profileId)
          .single()

        if (team) {
          teamId = team.id
        }
        // If no team, that's okay - they're a Solo Hacker!
      }

      // Create the post (Solo Hackers have null team_id)
      const { error: postError } = await supabase
        .from('team_posts')
        .insert({
          team_id: teamId as string, // null for Solo Hackers - cast to satisfy type
          author_id: profileId,
          content: content.trim(),
          post_type: postType
        } as any)

      if (postError) throw postError

      // Success!
      setContent('')
      onPostCreated()
      onClose()
    } catch (err: any) {
      console.error('Error creating post:', err)
      setError('Oops! Something went wrong. Try again? 🔄')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[50%] translate-y-[-50%] md:inset-x-auto md:left-[50%] md:translate-x-[-50%] max-w-2xl w-full bg-white border-2 border-black shadow-2xl z-50"
          >
            {/* Header */}
            <div className="bg-amber-500 text-black p-6 border-b-2 border-black">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black">Share with the crowd!</h2>
                  <p className="text-sm mt-1 font-medium">Don\'t hold back, {userName.split(' ')[0]}!</p>
                </div>
                <button
                  onClick={onClose}
                  className="text-black hover:bg-amber-600 p-2 rounded transition-colors"
                >
                  <span className="text-2xl">✕</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Post Type Selection */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  What kind of update is this?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {postTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setPostType(type.value as any)}
                      className={`p-3 border-2 rounded-lg font-bold transition-all ${
                        postType === type.value
                          ? 'border-amber-500 bg-amber-50 text-black'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="text-lg">{type.label}</div>
                      <div className="text-xs font-normal mt-1 text-gray-600">
                        {type.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Input */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Spill the tea! ☕
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    postType === 'looking_for'
                      ? "We need a wizard who can make APIs dance! 🧙‍♂️"
                      : postType === 'milestone'
                      ? "We just crushed that bug that haunted us for 3 days! 🐛💀"
                      : postType === 'achievement'
                      ? "WE WON BEST UI/UX! MOM GET THE CAMERA! 📸"
                      : postType === 'announcement'
                      ? "ATTENTION EVERYONE: Free pizza at booth 42! 🍕"
                      : "Just deployed our MVP and only broke production twice! 🚀"
                  }
                  className="w-full px-4 py-3 border-2 border-black rounded-lg focus:outline-none focus:border-amber-500 transition-colors resize-none h-32 font-medium"
                  maxLength={1000}
                />
                <div className="flex justify-between mt-2">
                  <p className="text-xs text-gray-500">
                    {content.length > 800 ? '⚠️' : '✍️'} {content.length}/1000 characters
                  </p>
                  {content.length > 0 && (
                    <p className="text-xs text-gray-500">
                      {content.length < 50 ? "That's it? Come on, give us more! 😅" :
                       content.length < 100 ? "Getting there... 👍" :
                       content.length < 500 ? "Nice! Keep going! 🔥" :
                       "Now we're talking! 🚀"}
                    </p>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 rounded-lg text-red-700 font-medium">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-3 px-6 bg-gray-200 hover:bg-gray-300 text-black font-black border-2 border-black rounded-lg transition-colors disabled:opacity-50"
                >
                  Nah, changed my mind
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !content.trim()}
                  className="flex-1 py-3 px-6 bg-amber-500 hover:bg-amber-600 text-black font-black border-2 border-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Posting...' : 'Ship it! 🚀'}
                </button>
              </div>
            </div>

            {/* Footer Tip */}
            <div className="px-6 py-3 bg-gray-50 border-t-2 border-gray-200">
              <p className="text-xs text-center text-gray-600 font-medium">
                💡 Pro tip: Teams that post updates get 3x more collaboration requests!
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}