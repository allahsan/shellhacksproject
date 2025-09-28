'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { verifyTOTP, getQRCodeURL } from '@/lib/totp'
import QRCode from 'qrcode'

type User = {
  id: string
  name: string
  email: string
  phone: string
  profile_type: string
  team_name?: string
  team_id?: string
  team_role?: string
}

export default function GodModePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [error, setError] = useState('')
  const [qrCodeData, setQrCodeData] = useState('')
  const [showQR, setShowQR] = useState(false)

  // Admin features state
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<any>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    // Check if already authenticated
    const authTime = sessionStorage.getItem('god_mode_auth')
    if (authTime) {
      const authTimestamp = parseInt(authTime)
      const now = Date.now()
      // 15 minutes timeout
      if (now - authTimestamp < 15 * 60 * 1000) {
        setIsAuthenticated(true)
        loadData()
      } else {
        sessionStorage.removeItem('god_mode_auth')
      }
    }
  }, [])

  const generateQRCode = async () => {
    try {
      const url = getQRCodeURL()
      const qrData = await QRCode.toDataURL(url)
      setQrCodeData(qrData)
      setShowQR(true)
    } catch (err) {
      console.error('QR Code generation failed:', err)
    }
  }

  const handleTOTPSubmit = () => {
    if (verifyTOTP(totpCode)) {
      setIsAuthenticated(true)
      sessionStorage.setItem('god_mode_auth', Date.now().toString())
      setError('')
      loadData()
    } else {
      setError('Invalid TOTP code. Please try again.')
    }
  }

  const loadData = async () => {
    // Load users
    const { data: usersData } = await (supabase.rpc as any)('get_all_users', {
      p_limit: 100,
      p_offset: 0
    })

    if (usersData?.users) {
      setUsers(usersData.users)
    }

    // Load stats
    const { data: statsData } = await (supabase.rpc as any)('get_system_stats')
    if (statsData) {
      setStats(statsData)
    }
  }

  const handlePasswordReset = async () => {
    if (!selectedUser || !newPassword) {
      setError('Please select a user and enter a new password')
      return
    }

    setLoading(true)
    setError('')
    setSuccessMessage('')

    try {
      const { data, error } = await (supabase.rpc as any)('reset_user_password', {
        p_identifier: selectedUser.email || selectedUser.phone,
        p_new_password: newPassword
      })

      if (error) throw error

      if (data?.success) {
        setSuccessMessage(`Password reset successful for ${selectedUser.name}`)
        setNewPassword('')
        setSelectedUser(null)
      } else {
        setError(data?.error || 'Password reset failed')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      const { data, error } = await (supabase.rpc as any)('delete_user', {
        p_user_id: userId
      })

      if (error) throw error

      if (data?.success) {
        setSuccessMessage('User deleted successfully')
        loadData()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete user')
    }
  }

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true

    return (
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.phone?.includes(query) ||
      user.team_name?.toLowerCase().includes(query) ||
      user.team_role?.toLowerCase().includes(query)
    )
  })

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-green-400 p-8 font-mono">
        <div className="max-w-md mx-auto mt-20">
          <h1 className="text-3xl mb-8 text-center">
            🔱 GOD MODE ACCESS 🔱
          </h1>

          <div className="bg-gray-900 p-6 rounded-lg border border-green-400">
            <p className="mb-4 text-sm">Enter TOTP code from your authenticator app:</p>

            <input
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="000000"
              maxLength={6}
              className="w-full p-3 bg-black border border-green-400 rounded text-green-400 text-center text-2xl tracking-widest mb-4"
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleTOTPSubmit()
              }}
            />

            <button
              onClick={handleTOTPSubmit}
              className="w-full bg-green-400 text-black p-3 rounded font-bold hover:bg-green-300"
            >
              AUTHENTICATE
            </button>

            {error && (
              <div className="mt-4 text-red-400 text-sm">{error}</div>
            )}

          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-green-400 p-8 font-mono">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl mb-8 text-center">
          🔱 GOD MODE - SHELLHACK CONTROL PANEL 🔱
        </h1>

        {/* System Stats */}
        {stats && (
          <div className="bg-gray-900 p-4 rounded-lg border border-green-400 mb-8">
            <h2 className="text-xl mb-4">SYSTEM STATISTICS</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-gray-400">Total Users:</span>
                <div className="text-2xl">{stats.total_users}</div>
              </div>
              <div>
                <span className="text-gray-400">Active Teams:</span>
                <div className="text-2xl">{stats.active_teams}</div>
              </div>
              <div>
                <span className="text-gray-400">Users in Teams:</span>
                <div className="text-2xl">{stats.users_in_teams}</div>
              </div>
              <div>
                <span className="text-gray-400">Pending Requests:</span>
                <div className="text-2xl">{stats.total_join_requests}</div>
              </div>
            </div>
          </div>
        )}

        {/* Password Reset Section */}
        <div className="bg-gray-900 p-4 rounded-lg border border-green-400 mb-8">
          <h2 className="text-xl mb-4">PASSWORD RESET</h2>

          {selectedUser && (
            <div className="mb-4 p-3 bg-gray-800 rounded">
              <p>Selected: {selectedUser.name} ({selectedUser.email})</p>
            </div>
          )}

          <div className="flex gap-4 mb-4">
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="flex-1 p-2 bg-black border border-green-400 rounded text-green-400"
            />
            <button
              onClick={handlePasswordReset}
              disabled={loading || !selectedUser}
              className="px-6 py-2 bg-green-400 text-black rounded font-bold hover:bg-green-300 disabled:opacity-50"
            >
              {loading ? 'RESETTING...' : 'RESET PASSWORD'}
            </button>
          </div>

          {successMessage && (
            <div className="text-green-300 mb-4">{successMessage}</div>
          )}
          {error && (
            <div className="text-red-400 mb-4">{error}</div>
          )}
        </div>

        {/* User Management */}
        <div className="bg-gray-900 p-4 rounded-lg border border-green-400">
          <h2 className="text-xl mb-4">USER MANAGEMENT</h2>

          <div className="relative mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone, team, or role..."
              className="w-full p-2 pr-10 bg-black border border-green-400 rounded text-green-400"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-green-400"
              >
                ✕
              </button>
            )}
          </div>
          <div className="text-sm text-gray-400 mb-4">
            Showing {filteredUsers.length} of {users.length} users
            {searchQuery && ` matching "${searchQuery}"`}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Phone</th>
                  <th className="p-2 text-left">Team</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-gray-500">
                      {searchQuery ? `No users found matching "${searchQuery}"` : 'No users found'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                  <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800">
                    <td className="p-2">{user.name}</td>
                    <td className="p-2">{user.email}</td>
                    <td className="p-2">{user.phone || '-'}</td>
                    <td className="p-2">{user.team_name || 'No team'}</td>
                    <td className="p-2">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="text-yellow-400 hover:text-yellow-300 mr-4"
                      >
                        Reset PW
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <button
          onClick={() => {
            sessionStorage.removeItem('god_mode_auth')
            setIsAuthenticated(false)
          }}
          className="mt-8 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500"
        >
          EXIT GOD MODE
        </button>
      </div>
    </div>
  )
}