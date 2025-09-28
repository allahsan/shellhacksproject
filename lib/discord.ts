import axios from 'axios'

const DISCORD_API_ENDPOINT = 'https://discord.com/api/v10'
const CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'PLACEHOLDER'
const REDIRECT_URI = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI!

export interface DiscordUser {
  id: string
  username: string
  discriminator: string
  avatar?: string
  email?: string
  verified?: boolean
  locale?: string
  mfa_enabled?: boolean
}

export interface DiscordTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  scope: string
}

// Generate OAuth2 URL
export const getDiscordOAuthURL = () => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email',
    prompt: 'none'  // Skip authorization if user already authorized
  })

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`
}

// Exchange code for tokens
export const exchangeCodeForTokens = async (code: string): Promise<DiscordTokenResponse> => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI
  })

  try {
    const response = await axios.post(
      `${DISCORD_API_ENDPOINT}/oauth2/token`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    )

    return response.data
  } catch (error) {
    console.error('Failed to exchange code for tokens:', error)
    throw new Error('Failed to authenticate with Discord')
  }
}

// Get user info from Discord
export const getDiscordUser = async (accessToken: string): Promise<DiscordUser> => {
  try {
    const response = await axios.get(`${DISCORD_API_ENDPOINT}/users/@me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    return response.data
  } catch (error) {
    console.error('Failed to get Discord user:', error)
    throw new Error('Failed to get user information from Discord')
  }
}

// Helper to get avatar URL
export const getDiscordAvatarURL = (user: DiscordUser) => {
  if (!user.avatar) {
    // Default avatar based on discriminator
    const defaultAvatarNumber = parseInt(user.discriminator || '0') % 5
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`
  }

  // Custom avatar
  const format = user.avatar.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${format}`
}