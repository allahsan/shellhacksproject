'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'

interface CreateTeamViewProps {
  profileId: string
  profileName: string
  onTeamCreated: () => void
}

export default function CreateTeamView({ profileId, profileName, onTeamCreated }: CreateTeamViewProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [teamData, setTeamData] = useState({
    name: '',
    description: '',
    lookingFor: [] as string[],
    techStack: [] as string[],
  })

  const availableRoles = [
    'Frontend Dev', 'Backend Dev', 'Full Stack',
    'Mobile Dev', 'UI/UX Designer', 'Data Scientist',
    'ML Engineer', 'DevOps', 'Product Manager',
    'Business', 'Marketing', 'Pitch Expert'
  ]

  const techStackOptions = [
    'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Python',
    'Django', 'Flask', 'FastAPI', 'Java', 'Spring', 'Go',
    'Rust', 'Swift', 'Kotlin', 'Flutter', 'React Native',
    'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'AWS', 'Firebase'
  ]

  const handleCreateTeam = async () => {
    if (!teamData.name || !teamData.description || teamData.lookingFor.length === 0) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Create the team using the RPC function
      const { data, error: teamError } = await (supabase.rpc as any)('create_team', {
        p_leader_id: profileId,
        p_name: teamData.name,
        p_description: teamData.description,
        p_looking_for_roles: teamData.lookingFor,
        p_tech_stack: teamData.techStack.length > 0 ? teamData.techStack : null
      })

      if (teamError) {
        if (teamError.message?.includes('already exists')) {
          setError('A team with this name already exists. Please choose another name.')
          return
        }
        if (teamError.message?.includes('already leading')) {
          setError('You are already leading a team. You cannot create another one.')
          return
        }
        if (teamError.message?.includes('already in a team')) {
          setError('You are already a member of a team. Leave your current team first.')
          return
        }
        throw teamError
      }

      // Check if the creation was successful
      if (data && data.success) {
        // Success! Call the callback
        onTeamCreated()
      } else {
        setError('Failed to create team. Please try again.')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create team')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)]"
    >
      {/* Header */}
      <div className="bg-amber-400 border-b-2 border-black p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-black">CREATE YOUR TEAM</h2>
        <p className="text-sm font-medium mt-1">Welcome {profileName}! Let's set up your team.</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-6 p-4 bg-red-50 border-2 border-red-500 text-red-700 font-bold">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Team Name */}
        <div>
          <label className="block text-xs font-black text-gray-700 mb-2">
            TEAM NAME *
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border-2 border-black font-bold focus:outline-none focus:ring-4 focus:ring-amber-400"
            value={teamData.name}
            onChange={(e) => setTeamData({...teamData, name: e.target.value})}
            placeholder="Code Warriors"
          />
        </div>

        {/* Project Description */}
        <div>
          <label className="block text-xs font-black text-gray-700 mb-2">
            PROJECT DESCRIPTION *
          </label>
          <textarea
            className="w-full px-3 py-2 border-2 border-black font-bold focus:outline-none focus:ring-4 focus:ring-amber-400 min-h-[100px] resize-none"
            rows={4}
            value={teamData.description}
            onChange={(e) => setTeamData({...teamData, description: e.target.value})}
            placeholder="We're building an innovative solution for..."
          />
        </div>

        {/* Looking For Roles */}
        <div>
          <label className="block text-xs font-black text-gray-700 mb-2">
            LOOKING FOR * (Select roles you need)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {availableRoles.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  if (teamData.lookingFor.includes(role)) {
                    setTeamData({
                      ...teamData,
                      lookingFor: teamData.lookingFor.filter(r => r !== role)
                    })
                  } else {
                    setTeamData({
                      ...teamData,
                      lookingFor: [...teamData.lookingFor, role]
                    })
                  }
                }}
                className={`px-3 py-2 text-sm font-bold border-2 transition-all ${
                  teamData.lookingFor.includes(role)
                    ? 'bg-amber-500 text-black border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-black'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div>
          <label className="block text-xs font-black text-gray-700 mb-2">
            TECH STACK (Optional)
          </label>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {techStackOptions.map((tech) => (
              <button
                key={tech}
                type="button"
                onClick={() => {
                  if (teamData.techStack.includes(tech)) {
                    setTeamData({
                      ...teamData,
                      techStack: teamData.techStack.filter(t => t !== tech)
                    })
                  } else {
                    setTeamData({
                      ...teamData,
                      techStack: [...teamData.techStack, tech]
                    })
                  }
                }}
                className={`px-2 py-1 text-xs font-bold border-2 transition-all ${
                  teamData.techStack.includes(tech)
                    ? 'bg-green-500 text-white border-black'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
                }`}
              >
                {tech}
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleCreateTeam}
          disabled={loading}
          className="w-full py-3 bg-black text-white font-black text-lg border-2 border-black hover:bg-amber-500 hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[4px_4px_0px_rgba(0,0,0,1)]"
        >
          {loading ? 'CREATING...' : 'CREATE TEAM 🚀'}
        </button>

        {/* Info Box */}
        <div className="p-4 bg-amber-50 border-2 border-amber-300">
          <p className="text-sm font-bold text-gray-700">
            <span className="text-amber-600">ℹ️ Note:</span> You can only lead one team at a time.
            Team members will be able to join once you share your team details.
          </p>
        </div>
      </div>
    </motion.div>
  )
}