'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface PresenceStatusProps {
  userId: string
  teamId: string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  editable?: boolean
}

export default function PresenceStatus({
  userId,
  teamId,
  showLabel = false,
  size = 'sm',
  editable = false
}: PresenceStatusProps) {
  const [status, setStatus] = useState<'online' | 'away' | 'busy' | 'offline'>('offline')
  const [isCurrentUser, setIsCurrentUser] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    loadStatus()
    checkCurrentUser()

    // Set up realtime subscription
    const channel = supabase
      .channel(`presence-${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'team_members',
        filter: `profile_id=eq.${userId},team_id=eq.${teamId}`
      }, (payload) => {
        if (payload.new) {
          setStatus(payload.new.presence || 'offline')
        }
      })
      .subscribe()

    // Update presence every 5 minutes if online
    const interval = setInterval(() => {
      if (isCurrentUser && status === 'online') {
        updatePresence('online')
      }
    }, 5 * 60 * 1000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [userId, teamId])

  const loadStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('presence, last_seen')
        .eq('profile_id', userId)
        .eq('team_id', teamId)
        .single()

      if (data) {
        // Check if last seen was more than 10 minutes ago
        const lastSeen = new Date((data as any).last_seen)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

        if ((data as any).presence === 'online' && lastSeen < tenMinutesAgo) {
          setStatus('offline')
        } else {
          setStatus((data as any).presence || 'offline')
        }
      }
    } catch (error) {
      console.error('Error loading presence status:', error)
    }
  }

  const checkCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single()

      setIsCurrentUser(profile?.id === user.id)
    }
  }

  const updatePresence = async (newStatus: typeof status) => {
    if (!isCurrentUser) return

    try {
      const { error } = await (supabase.rpc as any)('update_presence', {
        p_profile_id: userId,
        p_team_id: teamId,
        p_status: newStatus
      })

      if (!error) {
        setStatus(newStatus)
        setShowMenu(false)
      }
    } catch (error) {
      console.error('Error updating presence:', error)
    }
  }

  const statusConfig = {
    online: {
      color: 'bg-green-500',
      label: 'Online',
      icon: '🟢'
    },
    away: {
      color: 'bg-yellow-500',
      label: 'Away',
      icon: '🟡'
    },
    busy: {
      color: 'bg-red-500',
      label: 'Busy',
      icon: '🔴'
    },
    offline: {
      color: 'bg-gray-400',
      label: 'Offline',
      icon: '⚫'
    }
  }

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }

  const config = statusConfig[status]

  if (editable && isCurrentUser) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-3 py-1.5 border-2 border-black bg-white hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all"
        >
          <span className={`${sizeClasses[size]} ${config.color} rounded-full`} />
          {showLabel && (
            <span className="text-sm font-bold">{config.label}</span>
          )}
          <span className="text-xs">▼</span>
        </button>

        {showMenu && (
          <div className="absolute top-full left-0 mt-2 bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] z-50">
            {Object.entries(statusConfig).map(([key, value]) => (
              <button
                key={key}
                onClick={() => updatePresence(key as typeof status)}
                className="flex items-center gap-2 px-4 py-2 w-full text-left hover:bg-amber-100 font-bold text-sm"
              >
                <span className={`w-2 h-2 ${value.color} rounded-full`} />
                {value.label}
                {status === key && ' ✓'}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`${sizeClasses[size]} ${config.color} rounded-full`}
        title={config.label}
      />
      {showLabel && (
        <span className="text-sm font-bold text-gray-700">
          {config.label}
        </span>
      )}
    </div>
  )
}