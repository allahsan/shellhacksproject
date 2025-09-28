'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { format, formatDistanceToNow } from 'date-fns'

type Activity = {
  id: string
  type: 'team_created' | 'member_joined' | 'role_filled' | 'voting_started' | 'new_leader'
  team_id: string
  team_name: string
  actor_name?: string
  metadata?: any
  created_at: string
}

interface ActivityFeedProps {
  limit?: number
  showHeader?: boolean
  compact?: boolean
}

export default function ActivityFeed({
  limit = 10,
  showHeader = true,
  compact = false
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActivities()
    const subscription = setupRealtimeSubscription()

    return () => {
      subscription?.unsubscribe()
    }
  }, [limit])

  const loadActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (!error && data) {
        setActivities(data as any)
      }
    } catch (error) {
      console.error('Error loading activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    return supabase
      .channel('activity-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activities'
        },
        (payload) => {
          const newActivity = payload.new as Activity
          setActivities(prev => [newActivity, ...prev.slice(0, limit - 1)])
        }
      )
      .subscribe()
  }

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'team_created': return '🚀'
      case 'member_joined': return '🤝'
      case 'role_filled': return '✅'
      case 'voting_started': return '🗳️'
      case 'new_leader': return '👑'
      default: return '📢'
    }
  }

  const getActivityMessage = (activity: Activity) => {
    switch (activity.type) {
      case 'team_created':
        return (
          <>
            <strong>{activity.actor_name}</strong> created team{' '}
            <strong className="text-blue-600">{activity.team_name}</strong>
          </>
        )
      case 'member_joined':
        return (
          <>
            <strong>{activity.actor_name}</strong> joined{' '}
            <strong className="text-blue-600">{activity.team_name}</strong>
            {activity.metadata?.role && (
              <> as <span className="text-purple-600">{activity.metadata.role}</span></>
            )}
          </>
        )
      case 'role_filled':
        return (
          <>
            Role <span className="text-purple-600">{activity.metadata?.role}</span> filled in{' '}
            <strong className="text-blue-600">{activity.team_name}</strong>
          </>
        )
      case 'voting_started':
        return (
          <>
            Voting started in{' '}
            <strong className="text-blue-600">{activity.team_name}</strong>
          </>
        )
      case 'new_leader':
        return (
          <>
            <strong>{activity.actor_name}</strong> is now the leader of{' '}
            <strong className="text-blue-600">{activity.team_name}</strong>
          </>
        )
      default:
        return 'New activity'
    }
  }

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'team_created': return 'border-green-500 bg-green-50'
      case 'member_joined': return 'border-blue-500 bg-blue-50'
      case 'role_filled': return 'border-purple-500 bg-purple-50'
      case 'voting_started': return 'border-red-500 bg-red-50'
      case 'new_leader': return 'border-yellow-500 bg-yellow-50'
      default: return 'border-gray-500 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className={`${compact ? 'p-3' : 'p-4'}`}>
        <div className="animate-pulse space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`${compact ? '' : 'bg-white border-2 border-black'}`}>
      {showHeader && (
        <div className={`${compact ? 'mb-3' : 'p-4 border-b-2 border-black'}`}>
          <h2 className="text-lg font-black flex items-center gap-2">
            <span className="animate-pulse">🔴</span>
            Live Activity Feed
          </h2>
        </div>
      )}

      <div className={`${compact ? '' : 'p-4'} space-y-2 max-h-96 overflow-y-auto`}>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-3xl mb-2">🦗</div>
            <p>No activity yet. Be the first to create a team!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {activities.map((activity) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex items-start gap-3 p-3 border-l-4 ${getActivityColor(activity.type)}`}
              >
                <span className="text-xl flex-shrink-0">
                  {getActivityIcon(activity.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm break-words">
                    {getActivityMessage(activity)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {!compact && activities.length > 0 && (
        <div className="p-3 border-t-2 border-black bg-gray-50 text-center">
          <p className="text-xs text-gray-600">
            Showing latest {activities.length} activities
          </p>
        </div>
      )}
    </div>
  )
}