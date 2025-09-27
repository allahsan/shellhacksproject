'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import ActivityFeed from '@/components/ActivityFeed'

export default function HomePage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const pathCards = [
    {
      title: 'Team Member Login',
      emoji: '⚡',
      description: 'Dashboard & collaborate',
      href: '/manage-team',
      gradient: 'gradient-green',
      color: 'bg-green-500'
    },
    {
      title: 'Start Team',
      emoji: '🚀',
      description: 'Create & lead your team',
      href: '/start-team',
      gradient: 'gradient-blue',
      color: 'bg-blue-500'
    },
    {
      title: 'Join Team',
      emoji: '🤝',
      description: 'Find your perfect match',
      href: '/join-team',
      gradient: 'gradient-purple',
      color: 'bg-purple-500'
    }
  ]

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile-optimized Hero */}
      <div className="relative px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            ease: "easeOut"
          }}
          className="text-center mb-8"
        >
          <div className="mb-4">
            <span className="inline-block px-3 py-1 text-[10px] font-bold text-black border-2 border-black bg-yellow-300 shadow-hard-sm uppercase tracking-wider">
              Hackathon 2024
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-black text-black mb-3 tracking-tight">
            TeamDock
          </h1>
          <p className="text-base sm:text-lg text-gray-700 font-medium mb-2">
            Form Teams in Seconds
          </p>
          <p className="text-sm text-gray-600 px-4">
            Real-time team formation made simple
          </p>
        </motion.div>

        {/* Mobile-optimized Cards - Stack on mobile */}
        <div className="space-y-4 mb-12 max-w-md mx-auto">
          {pathCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link href={card.href}>
                <div className="block bg-white border-2 border-black shadow-hard hover:shadow-xl transition-all duration-200">
                  <div className={`flex items-center p-4 ${card.gradient}`}>
                    <span className="text-4xl mr-4">{card.emoji}</span>
                    <div className="flex-1 text-left">
                      <h2 className="text-xl font-black text-white mb-1">
                        {card.title}
                      </h2>
                      <p className="text-white/90 text-sm">
                        {card.description}
                      </p>
                    </div>
                    <span className="text-white text-2xl">→</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Quick Stats - Centered grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="mb-12 max-w-md mx-auto"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border-2 border-black p-4 text-center">
              <span className="inline-block h-2 w-2 bg-green-500 rounded-full animate-pulse mb-2"></span>
              <div className="text-lg font-black">LIVE</div>
              <div className="text-xs text-gray-600">Real-time</div>
            </div>
            <div className="bg-white border-2 border-black p-4 text-center">
              <div className="text-xl mb-2">⚡</div>
              <div className="text-lg font-black">FAST</div>
              <div className="text-xs text-gray-600">60 seconds</div>
            </div>
            <div className="bg-white border-2 border-black p-4 text-center">
              <div className="text-xl mb-2">🔐</div>
              <div className="text-lg font-black">SECURE</div>
              <div className="text-xs text-gray-600">Simple codes</div>
            </div>
            <div className="bg-white border-2 border-black p-4 text-center">
              <div className="text-xl mb-2">📱</div>
              <div className="text-lg font-black">MOBILE</div>
              <div className="text-xs text-gray-600">Phone first</div>
            </div>
          </div>
        </motion.div>

        {/* Key Features - Compact grid for mobile */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="mb-12"
        >
          <h2 className="text-2xl font-black text-center mb-6">Features</h2>
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
            {[
              { icon: '🔔', title: 'Sound Alerts' },
              { icon: '📳', title: 'Vibration' },
              { icon: '🗳️', title: 'Voting' },
              { icon: '💬', title: 'WhatsApp' },
              { icon: '🎯', title: 'Role Match' },
              { icon: '🏷️', title: 'Tech Filter' }
            ].map((feature, i) => (
              <div key={i} className="bg-gray-50 border border-gray-200 p-3 text-center">
                <div className="text-2xl mb-1">{feature.icon}</div>
                <div className="font-bold text-xs">{feature.title}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Live Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.45 }}
          className="mb-12 max-w-md mx-auto"
        >
          <ActivityFeed limit={5} />
        </motion.div>

        {/* How It Works - Mobile optimized */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="mb-12 max-w-md mx-auto"
        >
          <h2 className="text-2xl font-black text-center mb-6">How It Works</h2>
          <div className="space-y-3">
            <div className="flex items-start">
              <div className="flex-none w-8 h-8 bg-black text-white font-bold flex items-center justify-center mr-3">
                1
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm mb-1">Create Profile</div>
                <div className="text-xs text-gray-600">Set your name & secret code</div>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-none w-8 h-8 bg-black text-white font-bold flex items-center justify-center mr-3">
                2
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm mb-1">Choose Path</div>
                <div className="text-xs text-gray-600">Start, join, or manage team</div>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-none w-8 h-8 bg-black text-white font-bold flex items-center justify-center mr-3">
                3
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm mb-1">Connect</div>
                <div className="text-xs text-gray-600">Get instant notifications</div>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-none w-8 h-8 bg-black text-white font-bold flex items-center justify-center mr-3">
                4
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm mb-1">Build Together</div>
                <div className="text-xs text-gray-600">Share contacts & collaborate</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Mobile-optimized CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.6 }}
          className="text-center pb-8"
        >
          <div className="border-t-2 border-black pt-8 mb-6">
            <h2 className="text-2xl font-black mb-3">Ready to Start?</h2>
            <p className="text-sm text-gray-600 mb-6 px-4">
              Join your hackathon team now
            </p>
          </div>

          {/* Full-width mobile buttons */}
          <div className="space-y-3 max-w-sm mx-auto px-4">
            <Link href="/start-team" className="block">
              <button className="w-full py-4 bg-black text-white font-bold border-2 border-black active:scale-[0.98] transition-transform">
                START A TEAM
              </button>
            </Link>
            <Link href="/join-team" className="block">
              <button className="w-full py-4 bg-white text-black font-bold border-2 border-black active:scale-[0.98] transition-transform">
                BROWSE TEAMS
              </button>
            </Link>
          </div>

          {/* Quick login for returning users */}
          <div className="mt-6">
            <Link href="/manage-team">
              <span className="text-sm text-gray-600 underline">
                Already have a team? Login →
              </span>
            </Link>
          </div>

          {/* Organizer Metrics Link */}
          <div className="mt-4">
            <Link href="/metrics">
              <span className="text-xs text-gray-500 underline">
                📊 Organizer Dashboard
              </span>
            </Link>
          </div>
        </motion.div>

        {/* Desktop view - Hidden on mobile, shown on larger screens */}
        <div className="hidden md:block">
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">This platform is optimized for mobile devices</p>
            <p className="text-xs mt-2">Best experienced on your phone 📱</p>
          </div>
        </div>
      </div>
    </div>
  )
}