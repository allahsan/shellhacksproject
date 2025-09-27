'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import DiscordButton from './DiscordButton'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'login' | 'signup'
}

export default function AuthModal({ isOpen, onClose, mode }: AuthModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'credentials' | 'profile'>('credentials')
  const [lastAttempt, setLastAttempt] = useState(0)
  const [attemptCount, setAttemptCount] = useState(0)

  // Login data
  const [loginData, setLoginData] = useState({
    identifier: '',
    secretCode: ''
  })

  // Signup data
  const [signupData, setSignupData] = useState({
    name: '',
    email: '',
    phone: '',
    secretCode: '',
    confirmCode: '',
    skills: [] as string[]
  })

  const availableSkills = [
    'Frontend', 'Backend', 'Full Stack', 'Mobile', 'DevOps',
    'UI/UX', 'Data Science', 'ML/AI', 'Blockchain',
    'Cloud', 'Security', 'Game Dev', 'AR/VR', 'IoT', 'Pitch'
  ]

  // Security: Input sanitization
  const sanitizeInput = (text: string): string => {
    // Remove SQL injection attempts
    let cleaned = text.replace(/[';"\\]/g, '')
    // Remove script tags and HTML
    cleaned = cleaned.replace(/<script[^>]*>.*?<\/script>/gi, '')
    cleaned = cleaned.replace(/<[^>]+>/g, '')
    // Remove excessive whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim()
    return cleaned
  }

  // Security: Validate email
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Security: Format phone
  const formatPhone = (value: string): string => {
    const phoneNumber = value.replace(/\D/g, '')
    if (phoneNumber.length <= 3) {
      return phoneNumber
    } else if (phoneNumber.length <= 6) {
      return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`
    } else {
      return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
    }
  }

  const handleLogin = async () => {
    // Rate limiting: 3 seconds between attempts
    const now = Date.now()
    if (now - lastAttempt < 3000) {
      const secondsLeft = Math.ceil((3000 - (now - lastAttempt)) / 1000)
      setError(`Please wait ${secondsLeft} seconds before trying again`)
      return
    }

    // Max 5 attempts per minute
    if (attemptCount >= 5) {
      setError('Too many attempts. Please wait a minute.')
      setTimeout(() => setAttemptCount(0), 60000)
      return
    }

    if (!loginData.identifier || !loginData.secretCode) {
      setError('Please enter your name/email and secret code')
      return
    }

    // Security: Validate inputs
    if (loginData.identifier.length > 100 || loginData.secretCode.length > 50) {
      setError('Invalid input length')
      return
    }

    setLoading(true)
    setError('')
    setLastAttempt(now)
    setAttemptCount(prev => prev + 1)

    try {
      // Sanitize inputs
      const sanitizedIdentifier = sanitizeInput(loginData.identifier)
      const sanitizedCode = sanitizeInput(loginData.secretCode)

      const { data: profile, error: authError } = await (supabase.rpc as any)('authenticate_user', {
        p_identifier: sanitizedIdentifier,
        p_secret_code: sanitizedCode
      })

      if (authError) throw authError

      if (profile) {
        // Store session
        sessionStorage.setItem('teamdock_profile_id', profile.profile_id)
        sessionStorage.setItem('teamdock_user_name', profile.profile_name)

        // Check if user is in a team
        const { data: teamMember } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('profile_id', profile.profile_id)
          .single()

        if (teamMember) {
          router.push('/manage-team')
        } else {
          router.push('/join-team')
        }
        onClose()
      } else {
        setError('Invalid credentials')
      }
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async () => {
    if (step === 'credentials') {
      // Rate limiting
      const now = Date.now()
      if (now - lastAttempt < 3000) {
        const secondsLeft = Math.ceil((3000 - (now - lastAttempt)) / 1000)
        setError(`Please wait ${secondsLeft} seconds`)
        return
      }

      if (!signupData.name || !signupData.email || !signupData.phone || !signupData.secretCode || !signupData.confirmCode) {
        setError('Please fill in all required fields')
        return
      }

      // Security: Length validation
      if (signupData.name.length > 100 || signupData.email.length > 100 ||
          signupData.phone.length > 20 || signupData.secretCode.length > 12) {
        setError('Input exceeds maximum length')
        return
      }

      if (signupData.secretCode !== signupData.confirmCode) {
        setError('Secret codes do not match')
        return
      }

      if (signupData.secretCode.length < 6 || signupData.secretCode.length > 12) {
        setError('Secret code must be 6-12 digits')
        return
      }

      if (!/^\d+$/.test(signupData.secretCode)) {
        setError('Secret code must contain only numbers')
        return
      }

      // Email validation
      if (!validateEmail(signupData.email)) {
        setError('Please enter a valid email address')
        return
      }

      // Phone validation (10 digits)
      const phoneDigits = signupData.phone.replace(/\D/g, '')
      if (phoneDigits.length !== 10) {
        setError('Phone number must be 10 digits')
        return
      }

      setLastAttempt(now)

      setError('')
      setStep('profile')
      return
    }

    // Create profile
    if (signupData.skills.length === 0) {
      setError('Please select at least one skill')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Sanitize all inputs
      const sanitizedName = sanitizeInput(signupData.name)
      const sanitizedEmail = sanitizeInput(signupData.email)
      const sanitizedPhone = signupData.phone.replace(/\D/g, '') // Keep only digits
      const sanitizedCode = sanitizeInput(signupData.secretCode)

      const { data: profileId, error: profileError } = await (supabase.rpc as any)('create_profile', {
        p_name: sanitizedName,
        p_email: sanitizedEmail,
        p_phone: sanitizedPhone,
        p_secret_code: sanitizedCode,
        p_proficiencies: signupData.skills.slice(0, 20) // Limit skills
      })

      if (profileError) throw profileError

      if (profileId) {
        // Store session
        sessionStorage.setItem('teamdock_profile_id', profileId)
        sessionStorage.setItem('teamdock_user_name', signupData.name)

        // Redirect to join or create team
        router.push('/join-team')
        onClose()
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const toggleSkill = (skill: string) => {
    setSignupData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : prev.skills.length < 20 ? [...prev.skills, skill] : prev.skills // Max 20 skills
    }))
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-x-4 top-[50%] translate-y-[-50%] md:inset-x-auto md:left-[50%] md:translate-x-[-50%] max-w-md w-full bg-white rounded-xl shadow-2xl z-50"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-xl">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl"
              >
                ✕
              </button>

              <h2 className="text-2xl font-bold">
                {mode === 'login' ? 'Welcome Back!' : 'Join TeamDock'}
              </h2>
              <p className="text-white/90 text-sm mt-1">
                {mode === 'login'
                  ? 'Login to manage your team'
                  : step === 'credentials'
                    ? 'Create your account'
                    : 'Complete your profile'}
              </p>
            </div>

            {/* Body */}
            <div className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {mode === 'login' ? (
                <div className="space-y-4">
                  {/* Discord Login Button */}
                  <DiscordButton
                    text="Login with Discord"
                    className="mb-2"
                  />

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">Or continue with email</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name or Email
                    </label>
                    <input
                      type="text"
                      value={loginData.identifier}
                      onChange={(e) => setLoginData({ ...loginData, identifier: e.target.value.slice(0, 100) })}
                      onPaste={(e) => {
                        e.preventDefault()
                        const pasted = e.clipboardData.getData('text/plain')
                        setLoginData({ ...loginData, identifier: sanitizeInput(pasted.slice(0, 100)) })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                      placeholder="Enter your name or email"
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Secret Code
                    </label>
                    <input
                      type="password"
                      value={loginData.secretCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 12)
                        setLoginData({ ...loginData, secretCode: value })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                      placeholder="Enter your 6-12 digit code"
                      maxLength={12}
                    />
                  </div>

                  <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {loading ? 'Logging in...' : 'Login'}
                  </button>

                  <p className="text-center text-sm text-gray-600">
                    Don't have an account?{' '}
                    <button
                      onClick={() => {
                        setError('')
                        setLoginData({ identifier: '', secretCode: '' })
                        onClose()
                        setTimeout(() => {
                          const signupBtn = document.querySelector('[data-signup-btn]')
                          if (signupBtn) (signupBtn as HTMLElement).click()
                        }, 100)
                      }}
                      className="text-purple-600 hover:underline"
                    >
                      Sign up
                    </button>
                  </p>
                </div>
              ) : (
                <>
                  {step === 'credentials' ? (
                    <div className="space-y-4">
                      {/* Discord Signup Button */}
                      <DiscordButton
                        text="Sign up with Discord"
                        className="mb-2"
                      />

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-white text-gray-500">Or sign up manually</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name *
                        </label>
                        <input
                          type="text"
                          value={signupData.name}
                          onChange={(e) => setSignupData({ ...signupData, name: e.target.value.slice(0, 100) })}
                          onPaste={(e) => {
                            e.preventDefault()
                            const pasted = e.clipboardData.getData('text/plain')
                            setSignupData({ ...signupData, name: sanitizeInput(pasted.slice(0, 100)) })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                          placeholder="Your full name"
                          maxLength={100}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email *
                        </label>
                        <input
                          type="email"
                          value={signupData.email}
                          onChange={(e) => setSignupData({ ...signupData, email: e.target.value.slice(0, 100) })}
                          onPaste={(e) => {
                            e.preventDefault()
                            const pasted = e.clipboardData.getData('text/plain')
                            setSignupData({ ...signupData, email: sanitizeInput(pasted.slice(0, 100)) })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                          placeholder="your@email.com"
                          maxLength={100}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone *
                        </label>
                        <input
                          type="tel"
                          value={signupData.phone}
                          onChange={(e) => {
                            const formatted = formatPhone(e.target.value)
                            setSignupData({ ...signupData, phone: formatted })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                          placeholder="305-555-0189"
                          maxLength={12}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Create Secret Code * (6-12 digits)
                        </label>
                        <input
                          type="password"
                          value={signupData.secretCode}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 12)
                            setSignupData({ ...signupData, secretCode: value })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                          placeholder="Enter 6-12 digit code"
                          maxLength={12}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Confirm Secret Code *
                        </label>
                        <input
                          type="password"
                          value={signupData.confirmCode}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 12)
                            setSignupData({ ...signupData, confirmCode: value })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                          placeholder="Re-enter your code"
                          maxLength={12}
                        />
                      </div>

                      <button
                        onClick={handleSignup}
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
                      >
                        Next: Select Skills
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Select Your Skills *
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {availableSkills.map((skill) => (
                            <button
                              key={skill}
                              onClick={() => toggleSkill(skill)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                signupData.skills.includes(skill)
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {skill}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => setStep('credentials')}
                          className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleSignup}
                          disabled={loading}
                          className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {loading ? 'Creating...' : 'Create Account'}
                        </button>
                      </div>
                    </div>
                  )}

                  {step === 'credentials' && (
                    <p className="text-center text-sm text-gray-600 mt-4">
                      Already have an account?{' '}
                      <button
                        onClick={() => {
                          setError('')
                          setSignupData({
                            name: '',
                            email: '',
                            phone: '',
                            secretCode: '',
                            confirmCode: '',
                            skills: []
                          })
                          onClose()
                          setTimeout(() => {
                            const loginBtn = document.querySelector('[data-login-btn]')
                            if (loginBtn) (loginBtn as HTMLElement).click()
                          }, 100)
                        }}
                        className="text-purple-600 hover:underline"
                      >
                        Login
                      </button>
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}