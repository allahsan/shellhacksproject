'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import TeamInfoModal from './TeamInfoModal'

type Post = {
  id: string
  content: string
  post_type: 'update' | 'milestone' | 'looking_for' | 'announcement' | 'achievement'
  likes_count: number
  comments_count: number
  created_at: string
  team: {
    id: string
    name: string
    description: string
    status: string
    looking_for_roles: string[]
    tech_stack: string[]
  }
  author: {
    id: string
    name: string
  }
  comments?: Comment[]
  isLiked?: boolean
}

type Comment = {
  id: string
  content: string
  author_name: string
  created_at: string
  session_id?: string
  parent_comment_id?: string | null
  edited_at?: string | null
  is_edited?: boolean
  replies?: Comment[]
}

interface TeamFeedProps {
  isUserLoggedIn?: boolean
  currentUser?: { id: string; name: string } | null
}

export default function TeamFeed({ isUserLoggedIn = false, currentUser }: TeamFeedProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState<Post['team'] | null>(null)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [newComment, setNewComment] = useState<{ [key: string]: string }>({})
  const [commentAuthor, setCommentAuthor] = useState<{ [key: string]: string }>({})
  const [editingComment, setEditingComment] = useState<{ [key: string]: string }>({})
  const [replyingTo, setReplyingTo] = useState<{ [key: string]: string }>({})
  const [replyContent, setReplyContent] = useState<{ [key: string]: string }>({})
  const [replyAuthor, setReplyAuthor] = useState<{ [key: string]: string }>({})
  const isLoggedIn = isUserLoggedIn
  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      let id = sessionStorage.getItem('anonymous_session_id')
      if (!id) {
        id = `anon_${Math.random().toString(36).substr(2, 9)}`
        sessionStorage.setItem('anonymous_session_id', id)
      }
      return id
    }
    return ''
  })

  useEffect(() => {
    loadPosts()
    setupRealtimeSubscription()
  }, [])

  const loadPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('team_posts')
        .select(`
          *,
          team:teams(
            id,
            name,
            description,
            status,
            looking_for_roles,
            tech_stack
          ),
          author:profiles(
            id,
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      // Check likes for current session
      if (data) {
        const postsWithLikes = await Promise.all(
          data.map(async (post) => {
            const { data: likeData } = await supabase
              .from('post_likes')
              .select('id')
              .eq('post_id', post.id)
              .eq('session_id', sessionId)
              .single()

            return {
              ...post,
              isLiked: !!likeData
            }
          })
        )
        setPosts(postsWithLikes as any)
      }
    } catch (error) {
      console.error('Error loading posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('feed-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_posts' },
        () => {
          loadPosts()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_likes' },
        () => {
          loadPosts()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const handleLike = async (postId: string) => {
    if (!isLoggedIn) {
      alert('Please login to like posts!')
      return
    }

    try {
      const { data, error } = await (supabase.rpc as any)('toggle_post_like', {
        p_post_id: postId,
        p_session_id: sessionId
      })

      if (error) throw error

      // Update local state
      setPosts(posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            isLiked: data.liked,
            likes_count: data.likes_count
          }
        }
        return post
      }))
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }

  const handleComment = async (postId: string) => {
    if (!isLoggedIn) {
      alert('Please login to comment on posts!')
      return
    }

    const content = newComment[postId]
    // Use logged-in user's name automatically
    const authorName = currentUser?.name || commentAuthor[postId] || 'Anonymous'

    if (!content?.trim()) return

    try {
      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          content: content.trim(),
          author_name: authorName,
          session_id: sessionId
        })

      if (error) throw error

      // Clear input
      setNewComment({ ...newComment, [postId]: '' })
      setCommentAuthor({ ...commentAuthor, [postId]: '' })

      // Reload the post to get updated count from database
      await reloadPost(postId)

      // Reload comments
      await loadComments(postId)
    } catch (error) {
      console.error('Error posting comment:', error)
    }
  }

  const handleEditComment = async (commentId: string, newContent: string) => {
    if (!newContent?.trim()) return

    try {
      const { data, error } = await (supabase.rpc as any)('edit_comment', {
        p_comment_id: commentId,
        p_session_id: sessionId,
        p_new_content: newContent.trim()
      })

      if (error) throw error

      if (data?.success) {
        // Clear editing state
        setEditingComment({})
        // Reload comments for the post
        const post = posts.find(p => p.comments?.some(c => c.id === commentId))
        if (post) await loadComments(post.id)
      } else {
        console.error('Could not edit comment:', data?.error)
      }
    } catch (error) {
      console.error('Error editing comment:', error)
    }
  }

  const handleDeleteComment = async (commentId: string, postId: string) => {
    try {
      const { data, error } = await (supabase.rpc as any)('delete_comment', {
        p_comment_id: commentId,
        p_session_id: sessionId
      })

      if (error) throw error

      if (data?.success) {
        // Reload the post to get updated count from database
        await reloadPost(postId)
        // Reload comments
        await loadComments(postId)
      } else {
        console.error('Could not delete comment:', data?.error)
      }
    } catch (error) {
      console.error('Error deleting comment:', error)
    }
  }

  const handleReplyComment = async (parentCommentId: string, postId: string) => {
    if (!isLoggedIn) {
      alert('Please login to reply to comments!')
      return
    }

    const content = replyContent[parentCommentId]
    // Use logged-in user's name automatically
    const authorName = currentUser?.name || replyAuthor[parentCommentId] || 'Anonymous'

    if (!content?.trim()) return

    try {
      const { data, error } = await (supabase.rpc as any)('reply_to_comment', {
        p_parent_comment_id: parentCommentId,
        p_post_id: postId,
        p_content: content.trim(),
        p_author_name: authorName,
        p_session_id: sessionId
      })

      if (error) throw error

      // Clear reply inputs
      setReplyContent({})
      setReplyAuthor({})
      setReplyingTo({})

      // Reload the post to get updated count from database
      await reloadPost(postId)

      // Reload comments
      await loadComments(postId)
    } catch (error) {
      console.error('Error replying to comment:', error)
    }
  }

  const reloadPost = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('team_posts')
        .select(`
          *,
          team:teams(
            id,
            name,
            description,
            status,
            looking_for_roles,
            tech_stack
          ),
          author:profiles(
            id,
            name
          )
        `)
        .eq('id', postId)
        .single()

      if (error) throw error

      if (data) {
        // Check if liked by current session
        const { data: likeData } = await supabase
          .from('post_likes')
          .select('id')
          .eq('post_id', postId)
          .eq('session_id', sessionId)
          .single()

        const updatedPost = {
          ...data,
          isLiked: !!likeData
        }

        // Update the post in the state
        setPosts(posts.map(post =>
          post.id === postId ? updatedPost as Post : post
        ))
      }
    } catch (error) {
      console.error('Error reloading post:', error)
    }
  }

  const loadComments = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .is('parent_comment_id', null) // Get only top-level comments
        .order('created_at', { ascending: false })

      if (error) throw error

      // Load replies for each comment
      const commentsWithReplies = await Promise.all(
        (data || []).map(async (comment) => {
          const { data: replies } = await supabase
            .from('post_comments')
            .select('*')
            .eq('parent_comment_id', comment.id)
            .order('created_at', { ascending: true })

          return {
            ...comment,
            replies: replies || []
          }
        })
      )

      setPosts(posts.map(post => {
        if (post.id === postId) {
          return { ...post, comments: commentsWithReplies as Comment[] }
        }
        return post
      }))
    } catch (error) {
      console.error('Error loading comments:', error)
    }
  }

  const toggleComments = async (postId: string) => {
    const newExpanded = new Set(expandedComments)
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId)
    } else {
      newExpanded.add(postId)
      // Load comments if not loaded
      const post = posts.find(p => p.id === postId)
      if (post && !post.comments) {
        await loadComments(postId)
      }
    }
    setExpandedComments(newExpanded)
  }

  const getPostTypeIcon = (type: Post['post_type']) => {
    switch (type) {
      case 'milestone': return '🎯'
      case 'looking_for': return '👀'
      case 'announcement': return '📢'
      case 'achievement': return '🏆'
      default: return '💬'
    }
  }

  const getPostTypeColor = (type: Post['post_type']) => {
    switch (type) {
      case 'milestone': return 'bg-green-500 text-white'
      case 'looking_for': return 'bg-blue-500 text-white'
      case 'announcement': return 'bg-amber-500 text-black'
      case 'achievement': return 'bg-yellow-400 text-black'
      default: return 'bg-gray-500 text-white'
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl p-6 animate-pulse">
            <div className="flex items-start space-x-3">
              <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="bg-white border-2 border-black p-8 text-center shadow-hard">
            <div className="text-4xl mb-2">📝</div>
            <h3 className="text-lg font-black text-gray-900 mb-1">
              No posts yet
            </h3>
            <p className="text-sm text-gray-600">
              Teams will start sharing updates soon!
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border-2 border-black shadow-hard hover:shadow-xl transition-shadow"
            >
              {/* Post Header */}
              <div className="p-4 pb-0">
                <div className="flex items-start justify-between">
                  <div
                    className="flex items-start space-x-2 cursor-pointer flex-1"
                    onClick={() => {
                      if (post.team) {
                        setSelectedTeam(post.team)
                        setShowTeamModal(true)
                      }
                    }}
                  >
                    <div className={`w-9 h-9 ${post.team ? 'bg-amber-500' : 'bg-purple-500'} rounded flex items-center justify-center text-black font-black text-sm`}>
                      {post.team ? post.team.name.charAt(0) : '🚀'}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-base text-gray-900 hover:text-amber-600 transition-colors">
                        {post.team ? post.team.name : 'Solo Hacker'}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-medium">{post.author.name}</span>
                        <span>•</span>
                        <span>{formatTime(post.created_at)}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getPostTypeColor(post.post_type)}`}>
                          {getPostTypeIcon(post.post_type)} {post.post_type.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Post Content */}
                <div className="mt-3">
                  <p className="text-[15px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {post.content}
                  </p>
                </div>

                {/* Team Info Tags */}
                {post.post_type === 'looking_for' && post.team && post.team.looking_for_roles && post.team.looking_for_roles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {post.team.looking_for_roles.slice(0, 3).map((role) => (
                      <span
                        key={role}
                        className="px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium"
                      >
                        📍 {role}
                      </span>
                    ))}
                    {post.team.looking_for_roles.length > 3 && (
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        +{post.team.looking_for_roles.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Engagement Stats */}
              <div className="px-4 py-1.5 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  {post.likes_count > 0 && (
                    <span>👍 {post.likes_count}</span>
                  )}
                  {post.comments_count > 0 && (
                    <span>💬 {post.comments_count}</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-4 py-1 border-t-2 border-black bg-gray-50">
                <div className="flex items-center justify-around">
                  {isLoggedIn ? (
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm font-bold transition-colors ${
                        post.isLiked
                          ? 'text-amber-600 hover:bg-white'
                          : 'text-gray-700 hover:bg-white'
                      }`}
                    >
                      <span>{post.isLiked ? '👎' : '👍'}</span>
                      <span>{post.isLiked ? 'Unlike' : 'Like'}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-1 text-gray-400 text-sm">
                      <span>👍</span>
                      <span>Like</span>
                    </div>
                  )}
                  {isLoggedIn ? (
                    <button
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-gray-700 font-bold hover:bg-white transition-colors text-sm"
                    >
                      <span>💬</span>
                      <span>Comment</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-1 text-gray-400 text-sm">
                      <span>💬</span>
                      <span>Comment</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Comments Section */}
              <AnimatePresence>
                {expandedComments.has(post.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-100 overflow-hidden"
                  >
                    <div className="p-4 space-y-3">
                      {/* Comment Input - only show if logged in */}
                      {isLoggedIn && (
                        <div className="flex gap-2 items-center">
                          {currentUser && (
                            <span className="text-sm font-bold text-gray-600">
                              {currentUser.name}:
                            </span>
                          )}
                          {!currentUser && (
                            <input
                              type="text"
                              placeholder="Your name (optional)"
                              className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-32"
                              value={commentAuthor[post.id] || ''}
                              onChange={(e) => setCommentAuthor({
                                ...commentAuthor,
                                [post.id]: e.target.value
                              })}
                            />
                          )}
                          <input
                            type="text"
                            placeholder="Write a comment..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            value={newComment[post.id] || ''}
                            onChange={(e) => setNewComment({
                              ...newComment,
                              [post.id]: e.target.value
                            })}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleComment(post.id)
                              }
                            }}
                          />
                          <button
                            onClick={() => handleComment(post.id)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                          >
                            Post
                          </button>
                        </div>
                      )}

                      {/* Comments List */}
                      {post.comments && post.comments.length > 0 && (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {post.comments.map((comment) => (
                            <div key={comment.id} className="bg-gray-50 p-3 rounded-lg">
                              <div className="flex items-start gap-2">
                                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-xs font-bold text-white">
                                  {comment.author_name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{comment.author_name}</span>
                                      <span className="text-xs text-gray-500">
                                        {formatTime(comment.created_at)}
                                        {comment.is_edited && ' (edited)'}
                                      </span>
                                    </div>
                                    {/* Action buttons for own comments */}
                                    {comment.session_id === sessionId && !editingComment[comment.id] && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => setEditingComment({ [comment.id]: comment.content })}
                                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                          Edit
                                        </button>
                                        <span className="text-gray-400">•</span>
                                        <button
                                          onClick={() => handleDeleteComment(comment.id, post.id)}
                                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Comment content or edit form */}
                                  {editingComment[comment.id] !== undefined ? (
                                    <div className="mt-1">
                                      <textarea
                                        value={editingComment[comment.id]}
                                        onChange={(e) => setEditingComment({ ...editingComment, [comment.id]: e.target.value })}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm resize-none"
                                        rows={2}
                                      />
                                      <div className="flex gap-2 mt-1">
                                        <button
                                          onClick={() => handleEditComment(comment.id, editingComment[comment.id])}
                                          className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={() => setEditingComment({})}
                                          className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="text-sm text-gray-700 mt-1">
                                        {comment.content}
                                      </p>

                                      {/* Reply button - only show if logged in */}
                                      {isLoggedIn && (
                                        <button
                                          onClick={() => setReplyingTo({ [comment.id]: 'true' })}
                                          className="text-xs text-gray-600 hover:text-gray-800 font-medium mt-1"
                                        >
                                          ↳ Reply
                                        </button>
                                      )}
                                    </>
                                  )}

                                  {/* Reply form */}
                                  {replyingTo[comment.id] && (
                                    <div className="mt-2 ml-4 p-2 bg-white rounded border border-gray-200">
                                      <div className="flex gap-2">
                                        {!currentUser && (
                                          <input
                                            type="text"
                                            placeholder="Your name"
                                            className="px-2 py-1 border border-gray-300 rounded text-xs w-24"
                                            value={replyAuthor[comment.id] || ''}
                                            onChange={(e) => setReplyAuthor({ ...replyAuthor, [comment.id]: e.target.value })}
                                          />
                                        )}
                                        <input
                                          type="text"
                                          placeholder="Write a reply..."
                                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                                          value={replyContent[comment.id] || ''}
                                          onChange={(e) => setReplyContent({ ...replyContent, [comment.id]: e.target.value })}
                                          onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                              handleReplyComment(comment.id, post.id)
                                            }
                                          }}
                                        />
                                        <button
                                          onClick={() => handleReplyComment(comment.id, post.id)}
                                          className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                        >
                                          Reply
                                        </button>
                                        <button
                                          onClick={() => setReplyingTo({})}
                                          className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Replies */}
                                  {comment.replies && comment.replies.length > 0 && (
                                    <div className="ml-4 mt-2 space-y-2">
                                      {comment.replies.map((reply) => (
                                        <div key={reply.id} className="bg-white p-2 rounded border-l-2 border-gray-300">
                                          <div className="flex items-start gap-2">
                                            <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-xs font-bold text-white">
                                              {reply.author_name.charAt(0)}
                                            </div>
                                            <div className="flex-1">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-medium text-xs">{reply.author_name}</span>
                                                  <span className="text-xs text-gray-500">
                                                    {formatTime(reply.created_at)}
                                                    {reply.is_edited && ' (edited)'}
                                                  </span>
                                                </div>
                                                {/* Action buttons for own replies */}
                                                {reply.session_id === sessionId && !editingComment[reply.id] && (
                                                  <div className="flex items-center gap-1">
                                                    <button
                                                      onClick={() => setEditingComment({ [reply.id]: reply.content })}
                                                      className="text-xs text-blue-600 hover:text-blue-800"
                                                    >
                                                      Edit
                                                    </button>
                                                    <span className="text-gray-400 text-xs">•</span>
                                                    <button
                                                      onClick={() => handleDeleteComment(reply.id, post.id)}
                                                      className="text-xs text-red-600 hover:text-red-800"
                                                    >
                                                      Delete
                                                    </button>
                                                  </div>
                                                )}
                                              </div>

                                              {/* Reply content or edit form */}
                                              {editingComment[reply.id] !== undefined ? (
                                                <div className="mt-1">
                                                  <textarea
                                                    value={editingComment[reply.id]}
                                                    onChange={(e) => setEditingComment({ ...editingComment, [reply.id]: e.target.value })}
                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs resize-none"
                                                    rows={2}
                                                  />
                                                  <div className="flex gap-2 mt-1">
                                                    <button
                                                      onClick={() => handleEditComment(reply.id, editingComment[reply.id])}
                                                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                                    >
                                                      Save
                                                    </button>
                                                    <button
                                                      onClick={() => setEditingComment({})}
                                                      className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                                                    >
                                                      Cancel
                                                    </button>
                                                  </div>
                                                </div>
                                              ) : (
                                                <p className="text-xs text-gray-700 mt-1">
                                                  {reply.content}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>

      {/* Team Info Modal */}
      {selectedTeam && (
        <TeamInfoModal
          isOpen={showTeamModal}
          onClose={() => {
            setShowTeamModal(false)
            setSelectedTeam(null)
          }}
          team={selectedTeam}
        />
      )}
    </>
  )
}