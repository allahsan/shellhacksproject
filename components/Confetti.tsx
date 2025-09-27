'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ConfettiPiece {
  id: number
  x: number
  y: number
  rotation: number
  color: string
  delay: number
  duration: number
}

interface ConfettiProps {
  isActive: boolean
  duration?: number
  particleCount?: number
}

export default function Confetti({
  isActive,
  duration = 3000,
  particleCount = 50
}: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])
  const colors = ['#FFD700', '#FF69B4', '#00CED1', '#FF6347', '#9370DB', '#32CD32']

  useEffect(() => {
    if (isActive) {
      const newPieces = Array.from({ length: particleCount }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * window.innerWidth,
        y: -20,
        rotation: Math.random() * 360,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2
      }))
      setPieces(newPieces)

      const timer = setTimeout(() => {
        setPieces([])
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [isActive])

  return (
    <AnimatePresence>
      {pieces.map((piece) => (
        <motion.div
          key={piece.id}
          className="fixed pointer-events-none z-50"
          initial={{
            x: piece.x,
            y: piece.y,
            rotate: 0,
            opacity: 1
          }}
          animate={{
            x: piece.x + (Math.random() - 0.5) * 200,
            y: window.innerHeight + 100,
            rotate: piece.rotation * 3,
            opacity: 0
          }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            ease: 'easeOut'
          }}
          style={{
            left: 0,
            top: 0
          }}
        >
          <div
            className="w-3 h-3"
            style={{
              backgroundColor: piece.color,
              transform: `rotate(${piece.rotation}deg)`
            }}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  )
}

// Emoji confetti variant
export function EmojiConfetti({
  isActive,
  duration = 3000,
  particleCount = 30
}: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])
  const emojis = ['🎉', '🎊', '✨', '🌟', '💫', '🎯', '🚀', '💪', '🔥', '⭐']

  useEffect(() => {
    if (isActive) {
      const newPieces = Array.from({ length: particleCount }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * window.innerWidth,
        y: -20,
        rotation: Math.random() * 360,
        color: emojis[Math.floor(Math.random() * emojis.length)],
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2
      }))
      setPieces(newPieces)

      const timer = setTimeout(() => {
        setPieces([])
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [isActive])

  return (
    <AnimatePresence>
      {pieces.map((piece) => (
        <motion.div
          key={piece.id}
          className="fixed pointer-events-none z-50 text-2xl"
          initial={{
            x: piece.x,
            y: piece.y,
            rotate: 0,
            opacity: 1,
            scale: 1
          }}
          animate={{
            x: piece.x + (Math.random() - 0.5) * 200,
            y: window.innerHeight + 100,
            rotate: piece.rotation,
            opacity: 0,
            scale: 0.5
          }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            ease: 'easeOut'
          }}
          style={{
            left: 0,
            top: 0
          }}
        >
          {piece.color}
        </motion.div>
      ))}
    </AnimatePresence>
  )
}