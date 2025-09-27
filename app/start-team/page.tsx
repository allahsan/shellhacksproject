'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

export default function StartTeamPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Profile data
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    secretCode: '',
    skills: [] as string[],
  })
  
  // Team data
  const [teamData, setTeamData] = useState({
    name: '',
    description: '',
    lookingFor: [] as string[],
    techStack: [] as string[],
  })

  const availableSkills = [
    'Frontend', 'Backend', 'Full Stack', 'Mobile', 'DevOps',
    'UI/UX Design', 'Data Science', 'Machine Learning', 'Blockchain',
    'Cloud', 'Security', 'Game Dev', 'AR/VR', 'IoT', 'Other'
  ]

  const availableRoles = [
    'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
    'Mobile Developer', 'UI/UX Designer', 'Data Scientist',
    'ML Engineer', 'DevOps Engineer', 'Product Manager',
    'Business Analyst', 'Marketing', 'Other'
  ]

  const techStackOptions = [
    'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Python',
    'Django', 'Flask', 'FastAPI', 'Java', 'Spring', 'Go',
    'Rust', 'C++', 'Swift', 'Kotlin', 'Flutter', 'React Native',
    'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS',
    'GCP', 'Azure', 'TensorFlow', 'PyTorch', 'Other'
  ]

  const handleCreateProfile = async () => {
    if (!profileData.name || !profileData.secretCode || profileData.skills.length === 0) {
      setError('Please fill in all required fields')
      return
    }
    
    if (profileData.secretCode.length < 6 || profileData.secretCode.length > 12) {
      setError('Secret code must be 6-12 digits')
      return
    }
    
    if (!/^\d+$/.test(profileData.secretCode)) {
      setError('Secret code must contain only numbers')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.rpc('create_profile', {
        p_name: profileData.name,
        p_email: profileData.email || null,
        p_phone: profileData.phone || null,
        p_secret_code: profileData.secretCode,
        p_proficiencies: profileData.skills
      })

      if (error) throw error

      // Store profile ID in session storage
      sessionStorage.setItem('profileId', data)
      setStep(2)
    } catch (err: any) {
      setError(err.message || 'Failed to create profile')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTeam = async () => {
    if (!teamData.name || !teamData.description || teamData.lookingFor.length === 0) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError('')

    try {
      const profileId = sessionStorage.getItem('profileId')
      if (!profileId) throw new Error('Profile not found')

      const { data, error } = await supabase.rpc('create_team', {
        p_leader_id: profileId,
        p_name: teamData.name,
        p_description: teamData.description,
        p_looking_for_roles: teamData.lookingFor,
        p_tech_stack: teamData.techStack
      })

      if (error) throw error

      // Store team ID and redirect
      sessionStorage.setItem('teamId', data)
      router.push('/manage-team')
    } catch (err: any) {
      setError(err.message || 'Failed to create team')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">
            Start Your Team 🚀
          </h1>
          <p className="text-gray-600 mt-2">
            Create your dream hackathon team in just 2 steps
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-2xl">
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                1
              </div>
              <span className="ml-2 text-sm font-medium">Create Profile</span>
            </div>
            <div className={`flex-1 h-1 mx-4 ${
              step >= 2 ? 'bg-blue-600' : 'bg-gray-300'
            }`} />
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                2
              </div>
              <span className="ml-2 text-sm font-medium">Setup Team</span>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-2xl mx-auto"
        >
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {step === 1 ? (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6">Step 1: Create Your Profile</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={profileData.name}
                    onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={profileData.email}
                    onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                    placeholder="+1234567890"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secret Code * (6-12 digits)
                  </label>
                  <input
                    type="password"
                    maxLength={12}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={profileData.secretCode}
                    onChange={(e) => setProfileData({...profileData, secretCode: e.target.value})}
                    placeholder="Enter 6-12 digit code"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Remember this code! You'll need it to access your team later.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Skills * (Select at least one)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {availableSkills.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => {
                          if (profileData.skills.includes(skill)) {
                            setProfileData({
                              ...profileData,
                              skills: profileData.skills.filter(s => s !== skill)
                            })
                          } else {
                            setProfileData({
                              ...profileData,
                              skills: [...profileData.skills, skill]
                            })
                          }
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          profileData.skills.includes(skill)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreateProfile}
                disabled={loading}
                className="mt-6 w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Profile...' : 'Continue to Team Setup →'}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6">Step 2: Setup Your Team</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Team Name *
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={teamData.name}
                    onChange={(e) => setTeamData({...teamData, name: e.target.value})}
                    placeholder="Code Warriors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Team Description *
                  </label>
                  <textarea
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    value={teamData.description}
                    onChange={(e) => setTeamData({...teamData, description: e.target.value})}
                    placeholder="We're building an innovative solution for..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Looking For * (Roles needed)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
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
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          teamData.lookingFor.includes(role)
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tech Stack (Optional)
                  </label>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
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
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          teamData.techStack.includes(tech)
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {tech}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleCreateTeam}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 px-6 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating Team...' : 'Create Team 🚀'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}