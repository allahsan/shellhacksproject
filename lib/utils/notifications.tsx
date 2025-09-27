import React from 'react'
import { Howl } from 'howler'
import toast from 'react-hot-toast'

// Sound files - using base64 encoded simple sounds for now
const SOUNDS = {
  notification: 'data:audio/wav;base64,UklGRoQFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAAA',
  join: 'data:audio/wav;base64,UklGRkQFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAAA',
  alert: 'data:audio/wav;base64,UklGRhwFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAAA',
  success: 'data:audio/wav;base64,UklGRiQFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAAA'
}

// Vibration patterns
const VIBRATION_PATTERNS = {
  default: [200],
  join: [200, 100, 200],
  urgent: [500, 250, 500],
  success: [100, 50, 100],
  error: [300, 100, 300, 100, 300]
}

class NotificationManager {
  private sounds: Map<string, Howl> = new Map()
  private muted: boolean = false
  private vibrationEnabled: boolean = true

  constructor() {
    // Initialize sounds
    Object.entries(SOUNDS).forEach(([key, src]) => {
      this.sounds.set(key, new Howl({
        src: [src],
        volume: 0.5,
        preload: true
      }))
    })

    // Check for vibration API support
    this.vibrationEnabled = 'vibrate' in navigator

    // Load preferences from localStorage
    this.muted = localStorage.getItem('notificationsMuted') === 'true'
    this.vibrationEnabled = localStorage.getItem('vibrationEnabled') !== 'false'
  }

  // Play sound
  playSound(type: 'notification' | 'join' | 'alert' | 'success' = 'notification') {
    if (!this.muted) {
      const sound = this.sounds.get(type)
      sound?.play()
    }
  }

  // Trigger vibration
  vibrate(pattern: keyof typeof VIBRATION_PATTERNS = 'default') {
    if (this.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate(VIBRATION_PATTERNS[pattern])
    }
  }

  // Combined notification
  notify(
    message: string,
    options: {
      type?: 'success' | 'error' | 'info' | 'warning'
      sound?: 'notification' | 'join' | 'alert' | 'success'
      vibration?: keyof typeof VIBRATION_PATTERNS
      duration?: number
      action?: {
        label: string
        onClick: () => void
      }
    } = {}
  ) {
    const {
      type = 'info',
      sound = 'notification',
      vibration = 'default',
      duration = 4000,
      action
    } = options

    // Play sound
    this.playSound(sound)

    // Trigger vibration
    this.vibrate(vibration)

    // Show toast
    const toastOptions = {
      duration,
      style: {
        border: '2px solid black',
        padding: '16px',
        color: 'black',
        background: type === 'success' ? '#10b981' :
                    type === 'error' ? '#ef4444' :
                    type === 'warning' ? '#f59e0b' :
                    '#ffffff',
      }
    }

    if (action) {
      toast(
        (t) => (
          <div className="flex items-center justify-between">
            <span>{message}</span>
            <button
              onClick={() => {
                action.onClick()
                toast.dismiss(t.id)
              }}
              className="ml-4 px-3 py-1 bg-black text-white font-bold text-sm hover:bg-gray-800"
            >
              {action.label}
            </button>
          </div>
        ),
        toastOptions
      )
    } else {
      switch (type) {
        case 'success':
          toast.success(message, toastOptions)
          break
        case 'error':
          toast.error(message, toastOptions)
          break
        default:
          toast(message, toastOptions)
      }
    }
  }

  // Toggle mute
  toggleMute() {
    this.muted = !this.muted
    localStorage.setItem('notificationsMuted', this.muted.toString())
    return this.muted
  }

  // Toggle vibration
  toggleVibration() {
    this.vibrationEnabled = !this.vibrationEnabled
    localStorage.setItem('vibrationEnabled', this.vibrationEnabled.toString())
    return this.vibrationEnabled
  }

  // Get current settings
  getSettings() {
    return {
      muted: this.muted,
      vibrationEnabled: this.vibrationEnabled && 'vibrate' in navigator
    }
  }

  // Request browser notification permission
  async requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }
    return Notification.permission === 'granted'
  }

  // Send browser notification
  sendBrowserNotification(title: string, options: NotificationOptions = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        icon: '/icon.png',
        badge: '/badge.png',
        ...options
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      return notification
    }
  }

  // WhatsApp share link
  generateWhatsAppLink(message: string) {
    const encoded = encodeURIComponent(message)
    return `https://wa.me/?text=${encoded}`
  }

  // Share team invite via WhatsApp
  shareTeamInvite(teamName: string, teamId: string) {
    const message = `🚀 Join my team "${teamName}" on TeamDock!\n\nTeam ID: ${teamId}\n\nJoin here: ${window.location.origin}/join-team`
    window.open(this.generateWhatsAppLink(message), '_blank')
  }
}

// Create singleton instance
const notificationManager = new NotificationManager()

export default notificationManager