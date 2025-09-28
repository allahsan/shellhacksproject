import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, getDiscordUser, getDiscordAvatarURL } from '@/lib/discord'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // Get the origin dynamically
  const host = request.headers.get('host')
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  const origin = `${protocol}://${host}`
  const redirectUri = `${origin}/api/auth/discord/callback`

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(
      `${origin}/?error=discord_auth_failed`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/?error=no_code`
    )
  }

  try {
    // Parallel fetch: Exchange code for tokens AND prepare base redirect URL
    const [tokens] = await Promise.all([
      exchangeCodeForTokens(code, redirectUri)
    ])

    // Get user info from Discord
    const discordUser = await getDiscordUser(tokens.access_token)

    // Optimized: Check if user exists with Discord ID or email in a single query
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id, discord_id, email, name')
      .or(`discord_id.eq.${discordUser.id},email.eq.${discordUser.email}`)
      .single()

    let profileId: string
    let userName: string = discordUser.username
    let isNewUser = false

    if (existingUser) {
      // User exists, quick update
      if (existingUser.discord_id === discordUser.id) {
        // Already linked, just update last active
        await supabase
          .from('profiles')
          .update({
            last_active_at: new Date().toISOString(),
            discord_avatar: getDiscordAvatarURL(discordUser)
          })
          .eq('id', existingUser.id)

        profileId = existingUser.id
        userName = existingUser.name || discordUser.username
      } else {
        // Link Discord to existing email account
        const { data: linkedProfile } = await supabase
          .from('profiles')
          .update({
            discord_id: discordUser.id,
            discord_username: discordUser.username,
            discord_avatar: getDiscordAvatarURL(discordUser),
            discord_email: discordUser.email,
            last_active_at: new Date().toISOString()
          })
          .eq('id', existingUser.id)
          .select('id, name')
          .single()

        if (linkedProfile) {
          profileId = linkedProfile.id
          userName = linkedProfile.name || discordUser.username
        } else {
          throw new Error('Failed to update profile with Discord information')
        }
      }
    } else {
      // Create new user with Discord - this is a first-time signup
      isNewUser = true
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          name: discordUser.username,
          email: discordUser.email,
          discord_id: discordUser.id,
          discord_username: discordUser.username,
          discord_avatar: getDiscordAvatarURL(discordUser),
          discord_email: discordUser.email,
          // Generate a random secret code for backwards compatibility
          secret_code: Math.random().toString(36).substring(2, 15),
          proficiencies: [],
          profile_type: 'looking',
          is_available: true,
          user_status: 'available'
        })
        .select('id')
        .single()

      if (createError) {
        console.error('Failed to create profile:', createError)
        throw createError
      }

      profileId = newProfile.id
    }

    // Fast redirect with minimal data
    const redirectUrl = new URL('/', origin)
    redirectUrl.searchParams.set('discord_auth', 'success')
    redirectUrl.searchParams.set('profile_id', profileId)
    redirectUrl.searchParams.set('username', userName)
    if (isNewUser) {
      redirectUrl.searchParams.set('is_new_user', 'true')
    }

    // Set a cookie for faster future logins
    const response = NextResponse.redirect(redirectUrl.toString())
    response.cookies.set('discord_session', profileId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    return response
  } catch (error) {
    console.error('Discord callback error:', error)
    return NextResponse.redirect(
      `${origin}/?error=discord_callback_failed`
    )
  }
}