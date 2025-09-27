'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'

type UserStatusType = 'available' | 'busy' | 'break' | 'offline'

interface UserStatusProps {
  profileId: string
  initialStatus?: UserStatusType
  compact?: boolean
  showLabel?: boolean
  onStatusChange?: (status: UserStatusType) => void
}

const statusConfig = {
  available: {
    label: 'Available',
    icon: '🟢',
    color: 'bg-green-500',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700'
  },
  busy: {
    label: 'Busy',
    icon: '🔴',
    color: 'bg-red-500',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700'
  },
  break: {
    label: 'On Break',
    icon: '🟡',
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700'
  },
  offline: {
    label: 'Offline',
    icon: '⚫',
    color: 'bg-gray-500',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700'
  }
}

export default function UserStatus({
  profileId,
  initialStatus = 'available',
  compact = false,
  showLabel = true,
  onStatusChange
}: UserStatusProps) {
  const [status, setStatus] = useState<UserStatusType>(initialStatus)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadStatus()
    const subscription = setupRealtimeSubscription()

    return () => {
      subscription?.unsubscribe()
    }
  }, [profileId])

  const loadStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', profileId)
        .single()

      if (!error && data) {
        setStatus((data as any).status || 'available')
      }
    } catch (error) {
      console.error('Error loading status:', error)
    }
  }

  const setupRealtimeSubscription = () => {
    return supabase
      .channel(`profile-status-${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profileId}`
        },
        (payload: any) => {
          if (payload.new.status) {
            setStatus(payload.new.status)
          }
        }
      )
      .subscribe()
  }

  const updateStatus = async (newStatus: UserStatusType) => {
    if (loading || newStatus === status) return

    setLoading(true)
    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          status: newStatus,
          last_seen: new Date().toISOString()
        })
        .eq('id', profileId)

      if (!error) {
        setStatus(newStatus)
        setIsOpen(false)
        if (onStatusChange) onStatusChange(newStatus)

        // Play a subtle sound for status change
        if ('Audio' in window) {
          try {
            const audio = new Audio('/sounds/ping.mp3')
            audio.volume = 0.2
            audio.play().catch(() => {})
          } catch {}
        }
      }
    } catch (error) {
      console.error('Error updating status:', error)
    } finally {
      setLoading(false)
    }
  }

  const config = statusConfig[status]

  if (compact) {
    return (
      <div className="relative inline-block">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-sm"
          aria-label={`Status: ${config.label}`}
        >
          <span className={`inline-block w-2 h-2 rounded-full ${config.color}`} />
          {showLabel && <span className={config.textColor}>{config.label}</span>}
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute top-full left-0 mt-1 bg-white border-2 border-black shadow-lg z-50 min-w-[150px]"
            >
              {Object.entries(statusConfig).map(([key, conf]) => (
                <button
                  key={key}
                  onClick={() => updateStatus(key as UserStatusType)}
                  disabled={loading}
                  className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-100 disabled:opacity-50 ${
                    status === key ? conf.bgColor : ''
                  }`}
                >
                  <span>{conf.icon}</span>
                  <span className="text-sm">{conf.label}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-4 py-2 border-2 border-black flex items-center gap-2 ${config.bgColor} ${config.textColor} font-medium hover:shadow-md transition-shadow`}
      >
        <span className="text-lg">{config.icon}</span>
        <span>{config.label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-black shadow-xl z-50"
          >
            <div className="p-2">
              <p className="text-xs text-gray-600 px-3 py-1 border-b mb-2">
                Update your status
              </p>
              {Object.entries(statusConfig).map(([key, conf]) => (
                <button
                  key={key}
                  onClick={() => updateStatus(key as UserStatusType)}
                  disabled={loading}
                  className={`w-full px-3 py-3 text-left flex items-center gap-3 hover:bg-gray-50 disabled:opacity-50 transition-colors ${
                    status === key ? `${conf.bgColor} ${conf.textColor}` : ''
                  }`}
                >
                  <span className="text-xl">{conf.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium">{conf.label}</p>
                    <p className="text-xs text-gray-500">
                      {key === 'available' && 'Ready to collaborate'}
                      {key === 'busy' && 'Focused on tasks'}
                      {key === 'break' && 'Taking a short break'}
                      {key === 'offline' && 'Not currently active'}
                    </p>
                  </div>
                  {status === key && (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Status indicator component for showing other users' status
export function StatusIndicator({ status = 'offline' as UserStatusType, size = 'sm' }) {
  const config = statusConfig[status]

  const sizeClasses = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }

  return (
    <span
      className={`inline-block rounded-full ${config.color} ${sizeClasses[size as keyof typeof sizeClasses]} ${
        status === 'available' ? 'animate-pulse' : ''
      }`}
      title={config.label}
      aria-label={`Status: ${config.label}`}
    />
  )
}