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
  const [lastPostTime, setLastPostTime] = useState(0)
  const [attempts, setAttempts] = useState(0)

  const postTypes = [
    { value: 'update', label: '💬 Update', description: 'Share what you\'re working on' },
    { value: 'milestone', label: '🎯 Milestone', description: 'Celebrate a achievement' },
    { value: 'looking_for', label: '👀 Looking For', description: 'Need team members?' },
    { value: 'announcement', label: '📢 Announcement', description: 'Important news' },
    { value: 'achievement', label: '🏆 Achievement', description: 'Share your win!' }
  ]

  // Security: Sanitize and validate input
  const sanitizeInput = (text: string): string => {
    // Remove any potential SQL injection attempts
    let cleaned = text.replace(/[';"\\]/g, '')
    // Remove script tags and other HTML
    cleaned = cleaned.replace(/<script[^>]*>.*?<\/script>/gi, '')
    cleaned = cleaned.replace(/<[^>]+>/g, '')
    // Remove excessive whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim()
    return cleaned
  }

  // Security: Check for spam patterns
  const isSpam = (text: string): boolean => {
    const spamPatterns = [
      /viagra|cialis|crypto|bitcoin|nft|casino|lottery|winner/gi,
      /(https?:\/\/[^\s]+){3,}/g, // Too many URLs
      /([A-Z]{2,}\s+){5,}/g, // Excessive caps
      /(.)\1{9,}/g, // Character repeated 10+ times
    ]
    return spamPatterns.some(pattern => pattern.test(text))
  }

  const handleSubmit = async () => {
    // Rate limiting: 30 seconds between posts
    const now = Date.now()
    if (now - lastPostTime < 30000) {
      const secondsLeft = Math.ceil((30000 - (now - lastPostTime)) / 1000)
      setError(`Whoa there! Wait ${secondsLeft} more seconds before posting again 🚦`)
      return
    }

    // Security: Check attempt rate (max 5 attempts per minute)
    if (attempts >= 5) {
      setError('Too many attempts! Take a breather and try again in a minute 🛑')
      setTimeout(() => setAttempts(0), 60000)
      return
    }
    setAttempts(prev => prev + 1)

    if (!content.trim()) {
      setError('Come on, write something! Don\'t be shy 😊')
      return
    }

    if (content.length > 1000) {
      setError('Keep it under 1000 characters, we\'re not writing a novel here! 📚')
      return
    }

    // Security: Check for spam
    if (isSpam(content)) {
      setError('Your post looks a bit spammy. Try writing something more genuine! 🤖')
      return
    }

    // Security: Minimum content length to prevent spam
    if (content.trim().length < 10) {
      setError('Give us a bit more detail! At least 10 characters please 📝')
      return
    }

    // Sanitize the content
    const sanitizedContent = sanitizeInput(content)

    setLoading(true)
    setError('')

    try {
      // First, check if user has a team
      let teamId = null

      const { data: teamMember } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('profile_id', profileId)
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
          content: sanitizedContent,
          post_type: postType
        } as any)

      if (postError) throw postError

      // Success!
      setContent('')
      setLastPostTime(Date.now())
      setAttempts(0)
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
            className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[92%] sm:w-[90%] md:w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] z-50"
          >
            {/* Header */}
            <div className="bg-amber-500 text-black p-4 sm:p-6 border-b-2 border-black">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl md:text-2xl font-black">Share with the crowd!</h2>
                  <p className="text-xs sm:text-sm mt-0.5 sm:mt-1 font-medium">Don't hold back, {userName.split(' ')[0]}!</p>
                </div>
                <button
                  onClick={onClose}
                  className="text-black hover:bg-black hover:text-white p-1.5 sm:p-2 transition-colors"
                >
                  <span className="text-xl sm:text-2xl font-bold">✕</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6">
              {/* Post Type Selection */}
              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5 sm:mb-2">
                  What kind of update is this?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                  {postTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setPostType(type.value as any)}
                      className={`p-2 sm:p-3 border-2 rounded-lg font-bold transition-all ${
                        postType === type.value
                          ? 'border-amber-500 bg-amber-50 text-black'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="text-sm sm:text-lg">{type.label}</div>
                      <div className="text-[10px] sm:text-xs font-normal mt-0.5 sm:mt-1 text-gray-600">
                        {type.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Input */}
              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5 sm:mb-2">
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
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-black rounded-lg focus:outline-none focus:border-amber-500 transition-colors resize-none h-28 sm:h-32 text-sm sm:text-base font-medium"
                  maxLength={1000}
                  onPaste={(e) => {
                    // Security: Sanitize pasted content
                    e.preventDefault()
                    const pastedText = e.clipboardData.getData('text/plain')
                    const sanitized = sanitizeInput(pastedText.slice(0, 1000))
                    setContent(prev => {
                      const newContent = prev + sanitized
                      return newContent.slice(0, 1000)
                    })
                  }}
                />
                <div className="flex justify-between mt-1 sm:mt-2">
                  <p className="text-[10px] sm:text-xs text-gray-500">
                    {content.length > 800 ? '⚠️' : '✍️'} {content.length}/1000
                  </p>
                  {content.length > 0 && (
                    <p className="text-[10px] sm:text-xs text-gray-500">
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
                <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-red-50 border-2 border-red-500 rounded-lg text-red-700 text-xs sm:text-sm font-medium">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-2 sm:py-3 px-3 sm:px-6 bg-gray-200 hover:bg-gray-300 text-black font-black border-2 border-black rounded-lg transition-colors disabled:opacity-50 text-xs sm:text-base"
                >
                  <span className="hidden sm:inline">Nah, changed my mind</span>
                  <span className="sm:hidden">Cancel</span>
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !content.trim()}
                  className="flex-1 py-2 sm:py-3 px-3 sm:px-6 bg-amber-500 hover:bg-amber-600 text-black font-black border-2 border-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-base"
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