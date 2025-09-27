import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TeamDock - Find Your Perfect Hackathon Team',
  description: 'Real-time team formation platform for hackathons. Start a team, join a team, or manage your team with ease.',
  keywords: 'hackathon, team formation, team building, collaboration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}