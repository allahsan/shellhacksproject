'use client'

import { useState, useEffect } from 'react'
import soundManager from '@/lib/utils/soundManager'

export default function SoundSettings() {
  const [isEnabled, setIsEnabled] = useState(true)
  const [volume, setVolume] = useState(50)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Load initial settings
    setIsEnabled(soundManager.isEnabled())
    setVolume(soundManager.getVolume() * 100)
  }, [])

  const handleToggleSound = () => {
    const newEnabled = !isEnabled
    setIsEnabled(newEnabled)
    soundManager.setEnabled(newEnabled)

    // Play a test sound if enabling
    if (newEnabled) {
      soundManager.play('ping')
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value)
    setVolume(newVolume)
    soundManager.setVolume(newVolume / 100)

    // Play a test sound to hear the volume
    soundManager.play('ping')
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white border-2 border-black p-3 shadow-lg hover:shadow-xl transition-shadow"
        aria-label="Sound settings"
      >
        {isEnabled ? '🔊' : '🔇'}
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-white border-2 border-black p-4 w-64 shadow-xl">
          <h3 className="font-bold mb-3">Sound Settings</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Sound Effects</span>
              <button
                onClick={handleToggleSound}
                className={`w-12 h-6 rounded-full transition-colors ${
                  isEnabled ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  isEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {isEnabled && (
              <div>
                <label className="text-sm block mb-1">
                  Volume: {volume}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-full"
                />
              </div>
            )}

            <div className="pt-2 border-t">
              <button
                onClick={() => {
                  soundManager.play('notification')
                }}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 mr-2"
              >
                Test Notification
              </button>
              <button
                onClick={() => {
                  soundManager.play('join')
                }}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200"
              >
                Test Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}