import { NextResponse, NextRequest } from 'next/server'
import { getDiscordOAuthURL } from '@/lib/discord'

export async function GET(request: NextRequest) {
  try {
    // Get the origin from the request headers
    const host = request.headers.get('host')
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const redirectUri = `${protocol}://${host}/api/auth/discord/callback`

    const url = getDiscordOAuthURL(redirectUri)
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('Discord OAuth error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize Discord OAuth' },
      { status: 500 }
    )
  }
}