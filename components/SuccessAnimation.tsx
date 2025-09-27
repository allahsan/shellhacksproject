'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface SuccessAnimationProps {
  isVisible: boolean
  message?: string
  emoji?: string
  onComplete?: () => void
}

export default function SuccessAnimation({
  isVisible,
  message = 'Success!',
  emoji = '✅',
  onComplete
}: SuccessAnimationProps) {
  useEffect(() => {
    if (isVisible && onComplete) {
      const timer = setTimeout(onComplete, 2000)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onComplete])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white border-4 border-black shadow-2xl p-8 rounded-lg"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20
            }}
          >
            <motion.div
              className="text-6xl mb-4 text-center"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              {emoji}
            </motion.div>
            <motion.p
              className="text-xl font-bold text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {message}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Team formation celebration
export function TeamFormationCelebration({
  isVisible,
  teamName,
  onComplete
}: {
  isVisible: boolean
  teamName?: string
  onComplete?: () => void
}) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onComplete}
        >
          <motion.div
            className="bg-gradient-to-br from-purple-500 to-pink-500 p-1 rounded-2xl"
            initial={{ scale: 0, rotate: -360 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 360 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15
            }}
          >
            <div className="bg-white p-12 rounded-2xl">
              <motion.div
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <motion.div
                  className="text-8xl mb-6"
                  animate={{
                    rotate: [0, -10, 10, -10, 10, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{
                    duration: 0.5,
                    delay: 0.5,
                    repeat: 2,
                    repeatType: "reverse"
                  }}
                >
                  🚀
                </motion.div>
                <h2 className="text-3xl font-black mb-3 text-gray-900">
                  Team Created!
                </h2>
                {teamName && (
                  <p className="text-xl text-gray-700 font-semibold">
                    {teamName} is ready to build amazing things!
                  </p>
                )}
                <motion.div
                  className="flex justify-center gap-3 mt-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <span className="text-3xl">🎉</span>
                  <span className="text-3xl">🎊</span>
                  <span className="text-3xl">✨</span>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Member join animation
export function MemberJoinAnimation({
  isVisible,
  memberName,
  role,
  onComplete
}: {
  isVisible: boolean
  memberName?: string
  role?: string
  onComplete?: () => void
}) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed top-20 right-4 z-50"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          onAnimationComplete={onComplete}
        >
          <motion.div
            className="bg-green-500 text-white p-4 rounded-lg shadow-lg border-2 border-green-600"
            initial={{ scale: 0.8 }}
            animate={{ scale: [0.8, 1.1, 1] }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-3">
              <motion.span
                className="text-2xl"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 0.5 }}
              >
                🤝
              </motion.span>
              <div>
                <p className="font-bold">
                  {memberName || 'New member'} joined!
                </p>
                {role && (
                  <p className="text-sm text-green-100">
                    as {role}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}