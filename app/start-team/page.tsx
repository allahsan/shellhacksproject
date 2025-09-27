'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { EmojiConfetti } from '@/components/Confetti'
import { TeamFormationCelebration } from '@/components/SuccessAnimation'
import { playSuccessSound } from '@/lib/utils/soundManager'

export default function StartTeamPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'choose' | 'login' | 'create'>('create')
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCelebration, setShowCelebration] = useState(false)
  const [createdTeamName, setCreatedTeamName] = useState('')

  // Login data
  const [loginData, setLoginData] = useState({
    identifier: '',
    secretCode: ''
  })

  // Profile data
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    secretCode: '',
    confirmCode: '',
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
    'UI/UX', 'Data Science', 'ML/AI', 'Blockchain',
    'Cloud', 'Security', 'Game Dev', 'AR/VR', 'IoT', 'Pitch'
  ]

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

  const handleLogin = async () => {
    if (!loginData.identifier || !loginData.secretCode) {
      setError('Please enter your email/phone and secret code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data, error } = await (supabase.rpc as any)('login_with_secret', {
        p_identifier: loginData.identifier,
        p_secret_code: loginData.secretCode
      })

      if (error) throw error

      if (data && data.success) {
        // Store profile ID and move to team creation
        const profileId = data.profile.id
        sessionStorage.setItem('profileId', profileId)
        setStep(2)
        setMode('create')
      } else {
        setError('Invalid credentials. Please try again.')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login')
    } finally {
      setLoading(false)
    }
  }

  const validateProfileData = () => {
    if (!profileData.name || !profileData.secretCode || profileData.skills.length === 0) {
      setError('Please fill in all required fields')
      return false
    }

    if (!profileData.email && !profileData.phone) {
      setError('Please provide either email or phone number')
      return false
    }

    if (profileData.secretCode.length < 6 || profileData.secretCode.length > 12) {
      setError('Secret code must be 6-12 digits')
      return false
    }

    if (!/^\d+$/.test(profileData.secretCode)) {
      setError('Secret code must contain only numbers')
      return false
    }

    if (profileData.secretCode !== profileData.confirmCode) {
      setError('Secret codes do not match')
      return false
    }

    setError('')
    return true
  }

  const handleContinueToTeam = () => {
    if (validateProfileData()) {
      setStep(2)
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
      // First create the profile
      const { data: profileId, error: profileError } = await (supabase.rpc as any)('create_profile', {
        p_name: profileData.name,
        p_email: profileData.email || null,
        p_phone: profileData.phone || null,
        p_secret_code: profileData.secretCode,
        p_proficiencies: profileData.skills
      })

      if (profileError) {
        if (profileError.message?.includes('duplicate') || profileError.message?.includes('already exists')) {
          setError('This email or phone is already registered. Please use the Manage Team option to login.')
          return
        }
        throw profileError
      }

      // Store profile ID
      sessionStorage.setItem('profileId', profileId)

      // Then create the team
      const { data: teamId, error: teamError } = await (supabase.rpc as any)('create_team', {
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
        throw teamError
      }

      // Store team ID and show celebration
      sessionStorage.setItem('teamId', teamId)
      setCreatedTeamName(teamData.name)
      setShowCelebration(true)
      playSuccessSound()

      // Redirect after celebration
      setTimeout(() => {
        router.push('/manage-team')
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to create team')
    } finally {
      setLoading(false)
    }
  }


  // Login screen
  if (mode === 'login') {
    return (
      <div className="min-h-screen bg-white px-4 py-8">
        <button
          onClick={() => setMode('choose')}
          className="inline-flex items-center text-gray-600 mb-8"
        >
          ← Back
        </button>

        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-black text-center mb-2">
            Welcome Back! 👋
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Login to create your team
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="label">Email or Phone</label>
              <input
                type="text"
                className="input"
                value={loginData.identifier}
                onChange={(e) => setLoginData({...loginData, identifier: e.target.value})}
                placeholder="email@example.com or +1234567890"
              />
            </div>

            <div>
              <label className="label">Secret Code (6-12 digits)</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                className="input"
                value={loginData.secretCode}
                onChange={(e) => setLoginData({...loginData, secretCode: e.target.value})}
                placeholder="••••••"
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 bg-black text-white font-bold border-2 border-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login & Continue'}
            </button>

            <div className="text-center">
              <button
                onClick={() => setMode('create')}
                className="text-sm text-gray-600 underline"
              >
                Don't have a profile? Create one
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Create profile/team flow
  return (
    <div className="min-h-screen bg-white px-4 py-8">
      <Link href="/" className="inline-flex items-center text-gray-600 mb-4">
        ← Back to Home
      </Link>

      {/* Progress indicator */}
      <div className="mb-8 max-w-md mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-8 h-8 flex items-center justify-center font-bold border-2 ${
              step >= 1 ? 'bg-black text-white border-black' : 'bg-white text-gray-400 border-gray-300'
            }`}>
              1
            </div>
            <span className="ml-2 text-xs font-medium hidden sm:inline">Profile</span>
          </div>
          <div className={`flex-1 h-0.5 mx-2 ${step >= 2 ? 'bg-black' : 'bg-gray-300'}`} />
          <div className="flex items-center">
            <div className={`w-8 h-8 flex items-center justify-center font-bold border-2 ${
              step >= 2 ? 'bg-black text-white border-black' : 'bg-white text-gray-400 border-gray-300'
            }`}>
              2
            </div>
            <span className="ml-2 text-xs font-medium hidden sm:inline">Team</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 text-red-700 text-sm max-w-md mx-auto">
          {error}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-md mx-auto"
      >
        {step === 1 ? (
          <div className="bg-white border-2 border-black p-6">
            <h2 className="text-2xl font-black mb-6">Create Your Profile</h2>

            <div className="space-y-4">
              <div>
                <label className="label">Your Name *</label>
                <input
                  type="text"
                  className="input"
                  value={profileData.name}
                  onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={profileData.email}
                  onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  className="input"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                  placeholder="+1234567890"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Provide either email or phone (or both)
                </p>
              </div>

              <div>
                <label className="label">Create Secret Code * (6-12 digits)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={12}
                  className="input"
                  value={profileData.secretCode}
                  onChange={(e) => setProfileData({...profileData, secretCode: e.target.value})}
                  placeholder="Enter 6-12 digits"
                />
              </div>

              <div>
                <label className="label">Confirm Secret Code *</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={12}
                  className="input"
                  value={profileData.confirmCode}
                  onChange={(e) => setProfileData({...profileData, confirmCode: e.target.value})}
                  placeholder="Re-enter code"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Remember this! You'll need it to login later.
                </p>
              </div>

              <div>
                <label className="label">Your Skills * (Select at least one)</label>
                <div className="grid grid-cols-2 gap-2">
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
                      className={`px-3 py-2 text-xs font-medium border transition-all ${
                        profileData.skills.includes(skill)
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-black'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleContinueToTeam}
              disabled={loading}
              className="mt-6 w-full py-3 bg-black text-white font-bold border-2 border-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue to Team Setup →
            </button>

            <div className="mt-4 text-center">
              <button
                onClick={() => setMode('login')}
                className="text-sm text-gray-600 underline"
              >
                Already have a profile? Login instead
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border-2 border-black p-6">
            <h2 className="text-2xl font-black mb-6">Setup Your Team</h2>

            <div className="space-y-4">
              <div>
                <label className="label">Team Name *</label>
                <input
                  type="text"
                  className="input"
                  value={teamData.name}
                  onChange={(e) => setTeamData({...teamData, name: e.target.value})}
                  placeholder="Code Warriors"
                />
              </div>

              <div>
                <label className="label">Project Description *</label>
                <textarea
                  className="input min-h-[80px] resize-none"
                  rows={3}
                  value={teamData.description}
                  onChange={(e) => setTeamData({...teamData, description: e.target.value})}
                  placeholder="We're building an innovative solution for..."
                />
              </div>

              <div>
                <label className="label">Looking For * (Roles needed)</label>
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
                      className={`px-3 py-2 text-xs font-medium border transition-all ${
                        teamData.lookingFor.includes(role)
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-purple-600'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Tech Stack (Optional)</label>
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
                      className={`px-2 py-1 text-xs font-medium border transition-all ${
                        teamData.techStack.includes(tech)
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-green-600'
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
                className="flex-1 py-3 bg-white text-black border-2 border-gray-300 font-bold hover:border-black transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={loading}
                className="flex-1 py-3 bg-black text-white border-2 border-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Team 🚀'}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Celebration Animations */}
      <EmojiConfetti isActive={showCelebration} />
      <TeamFormationCelebration
        isVisible={showCelebration}
        teamName={createdTeamName}
        onComplete={() => setShowCelebration(false)}
      />
    </div>
  )
}