'use client'

import { motion } from 'framer-motion'

type VotingResultsProps = {
  winnerName: string
  winnerRole: string
  totalVotes: number
  wasTie: boolean
  onClose: () => void
}

export default function VotingResults({
  winnerName,
  winnerRole,
  totalVotes,
  wasTie,
  onClose
}: VotingResultsProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white border-2 border-black w-full max-w-md p-6"
      >
        <div className="text-center">
          <div className="text-6xl mb-4">👑</div>
          <h2 className="text-2xl font-black mb-2">New Leader Elected!</h2>

          <div className="my-6 p-4 bg-yellow-50 border-2 border-yellow-400">
            <p className="text-lg font-bold text-gray-900">{winnerName}</p>
            <p className="text-sm text-gray-600">{winnerRole}</p>
          </div>

          <div className="text-sm text-gray-600 mb-6">
            <p>Total votes cast: {totalVotes}</p>
            {wasTie && (
              <p className="mt-1 text-yellow-600">
                ⚠️ There was a tie. Winner selected randomly.
              </p>
            )}
          </div>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
            className="mb-6"
          >
            <div className="text-4xl">🎉</div>
          </motion.div>

          <button
            onClick={onClose}
            className="w-full py-3 bg-black text-white font-bold border-2 border-black"
          >
            Continue
          </button>
        </div>
      </motion.div>
    </div>
  )
}