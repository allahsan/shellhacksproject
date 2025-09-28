import { Howl, Howler } from 'howler'

export type SoundType = 'notification' | 'join' | 'alert' | 'success' | 'error' | 'ping' | 'whoosh'

interface SoundConfig {
  src: string[]
  volume: number
  preload: boolean
}

class SoundManager {
  private sounds: Map<SoundType, Howl>
  private enabled: boolean = false // Disabled by default until sound files are added
  private globalVolume: number = 0.5

  constructor() {
    this.sounds = new Map()
    // Only initialize sounds in browser environment
    if (typeof window !== 'undefined') {
      this.loadSounds()
      this.loadSettings()
    }
  }

  private loadSounds() {
    // Skip loading sounds until files are available
    return;

    const soundConfigs: Record<SoundType, SoundConfig> = {
      notification: {
        src: ['/sounds/notification.mp3', '/sounds/notification.ogg'],
        volume: 0.6,
        preload: true
      },
      join: {
        src: ['/sounds/join.mp3', '/sounds/join.ogg'],
        volume: 0.7,
        preload: true
      },
      alert: {
        src: ['/sounds/alert.mp3', '/sounds/alert.ogg'],
        volume: 0.8,
        preload: true
      },
      success: {
        src: ['/sounds/success.mp3', '/sounds/success.ogg'],
        volume: 0.5,
        preload: true
      },
      error: {
        src: ['/sounds/error.mp3', '/sounds/error.ogg'],
        volume: 0.6,
        preload: true
      },
      ping: {
        src: ['/sounds/ping.mp3', '/sounds/ping.ogg'],
        volume: 0.4,
        preload: true
      },
      whoosh: {
        src: ['/sounds/whoosh.mp3', '/sounds/whoosh.ogg'],
        volume: 0.3,
        preload: false
      }
    }

    // Initialize Howl instances for each sound
    Object.entries(soundConfigs).forEach(([type, config]) => {
      this.sounds.set(type as SoundType, new Howl({
        src: config.src,
        volume: config.volume,
        preload: config.preload,
        html5: true, // Use HTML5 Audio for better mobile support
        onloaderror: (id, error) => {
          console.warn(`Failed to load sound: ${type}`, error)
        }
      }))
    })
  }

  private loadSettings() {
    // Load saved settings from localStorage
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const savedEnabled = localStorage.getItem('soundEnabled')
      const savedVolume = localStorage.getItem('soundVolume')

      if (savedEnabled !== null) {
        this.enabled = savedEnabled === 'true'
      }

      if (savedVolume !== null) {
        this.globalVolume = parseFloat(savedVolume)
        Howler.volume(this.globalVolume)
      }
    }
  }

  play(type: SoundType, options?: { volume?: number; loop?: boolean }) {
    if (!this.enabled) return

    const sound = this.sounds.get(type)
    if (!sound) {
      console.warn(`Sound not found: ${type}`)
      return
    }

    // Set temporary volume if provided
    if (options?.volume !== undefined) {
      sound.volume(options.volume * this.globalVolume)
    }

    // Set loop if provided
    if (options?.loop !== undefined) {
      sound.loop(options.loop)
    }

    try {
      sound.play()
    } catch (error) {
      console.warn(`Failed to play sound: ${type}`, error)
    }
  }

  stop(type?: SoundType) {
    if (type) {
      const sound = this.sounds.get(type)
      if (sound) sound.stop()
    } else {
      // Stop all sounds
      this.sounds.forEach(sound => sound.stop())
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('soundEnabled', enabled.toString())
    }

    if (!enabled) {
      this.stop() // Stop all playing sounds when disabled
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setVolume(volume: number) {
    this.globalVolume = Math.max(0, Math.min(1, volume))
    Howler.volume(this.globalVolume)
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('soundVolume', this.globalVolume.toString())
    }
  }

  getVolume(): number {
    return this.globalVolume
  }

  mute(muted?: boolean) {
    Howler.mute(muted ?? true)
  }

  // Preload all sounds (useful for mobile)
  preloadAll() {
    this.sounds.forEach((sound, type) => {
      if (!sound.state() || sound.state() === 'unloaded') {
        sound.load()
      }
    })
  }

  // Play sound with vibration (for mobile)
  playWithVibration(type: SoundType, vibrationPattern?: number | number[]) {
    this.play(type)

    if ('navigator' in window && 'vibrate' in navigator) {
      navigator.vibrate(vibrationPattern || [100])
    }
  }
}

// Create singleton instance lazily
let soundManagerInstance: SoundManager | null = null

// Get or create singleton instance
const getSoundManager = (): SoundManager => {
  if (!soundManagerInstance) {
    soundManagerInstance = new SoundManager()
  }
  return soundManagerInstance
}

// Export getter function as default
const soundManager = typeof window !== 'undefined' ? getSoundManager() : ({
  play: () => {},
  stop: () => {},
  setEnabled: () => {},
  isEnabled: () => false,
  setVolume: () => {},
  getVolume: () => 0.5,
  mute: () => {},
  preloadAll: () => {},
  playWithVibration: () => {}
} as unknown as SoundManager)

export default soundManager

// Helper functions for common sound events
export const playNotificationSound = () => {
  soundManager.playWithVibration('notification', [100, 50, 100])
}

export const playJoinSound = () => {
  soundManager.playWithVibration('join', [200, 100, 200])
}

export const playAlertSound = () => {
  soundManager.playWithVibration('alert', [500, 250, 500])
}

export const playSuccessSound = () => {
  soundManager.playWithVibration('success', 100)
}

export const playErrorSound = () => {
  soundManager.playWithVibration('error', [50, 50, 50])
}

export const playPingSound = () => {
  soundManager.play('ping')
}

export const playWhooshSound = () => {
  soundManager.play('whoosh')
}