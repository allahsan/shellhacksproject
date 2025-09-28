import { NextResponse } from 'next/server'
import { getDiscordOAuthURL } from '@/lib/discord'

export async function GET() {
  try {
    const url = getDiscordOAuthURL()
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('Discord OAuth error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize Discord OAuth' },
      { status: 500 }
    )
  }
}