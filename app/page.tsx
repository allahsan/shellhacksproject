'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function HomePage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const pathCards = [
    {
      title: 'Start Team',
      emoji: '🚀',
      description: 'Create your team and recruit talented members',
      href: '/start-team',
      color: 'from-blue-500 to-cyan-400',
      features: [
        'Set your team name & vision',
        'Define roles you need',
        'Review & approve members',
        'Lead your team to victory'
      ]
    },
    {
      title: 'Join Team',
      emoji: '🤝',
      description: 'Find and join the perfect team for your skills',
      href: '/join-team',
      color: 'from-purple-500 to-pink-400',
      features: [
        'Browse available teams',
        'Filter by tech stack',
        'Request to join',
        'Contribute your skills'
      ]
    },
    {
      title: 'Manage Team',
      emoji: '⚡',
      description: 'Access your team dashboard and collaborate',
      href: '/manage-team',
      color: 'from-amber-500 to-orange-400',
      features: [
        'View team members',
        'Coordinate efforts',
        'Track progress',
        'Team communication'
      ]
    }
  ]

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-6xl font-bold text-gray-900 mb-4">
            TeamDock
          </h1>
          <p className="text-2xl text-gray-600 mb-2">
            Find Your Perfect Hackathon Team in Real-Time
          </p>
          <p className="text-lg text-gray-500">
            No more chaos. No more confusion. Just seamless team formation.
          </p>
        </motion.div>

        {/* Three Path Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {pathCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="relative"
            >
              <Link href={card.href}>
                <div className="h-full bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-shadow duration-300 cursor-pointer">
                  {/* Gradient Header */}
                  <div className={`h-32 bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                    <span className="text-6xl">{card.emoji}</span>
                  </div>
                  
                  {/* Card Content */}
                  <div className="p-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-3">
                      {card.title}
                    </h2>
                    <p className="text-gray-600 mb-6">
                      {card.description}
                    </p>
                    
                    {/* Features List */}
                    <ul className="space-y-2 mb-6">
                      {card.features.map((feature) => (
                        <li key={feature} className="flex items-start">
                          <span className="text-green-500 mr-2">✓</span>
                          <span className="text-gray-700 text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    {/* Action Button */}
                    <div className={`inline-flex items-center justify-center w-full py-3 px-6 rounded-lg bg-gradient-to-r ${card.color} text-white font-semibold hover:opacity-90 transition-opacity`}>
                      Get Started →
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-20 text-center"
        >
          <div className="inline-flex items-center bg-white rounded-full px-6 py-3 shadow-lg">
            <span className="animate-pulse mr-2 h-2 w-2 bg-green-500 rounded-full"></span>
            <span className="text-gray-700">
              <strong>Live Now:</strong> Real-time updates • Instant notifications • Zero refresh needed
            </span>
          </div>
        </motion.div>

        {/* Bottom Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
        >
          <div className="text-center">
            <div className="text-4xl mb-3">🔐</div>
            <h3 className="font-semibold text-gray-900 mb-2">Secure Access</h3>
            <p className="text-gray-600 text-sm">
              Simple 6-12 digit secret codes. No passwords, no hassle.
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="font-semibold text-gray-900 mb-2">Real-Time Updates</h3>
            <p className="text-gray-600 text-sm">
              See team changes instantly with sound & vibration alerts.
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="font-semibold text-gray-900 mb-2">Perfect Matches</h3>
            <p className="text-gray-600 text-sm">
              Find teams that match your skills and interests.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}