// Database function return types
export interface HackathonStatistics {
  active_teams: number
  total_members: number
  solo_hackers: number
  teams_recruiting: number
  teams_locked: number
}

export interface ActivityFeedItem {
  type: 'member_signup' | 'member_joined' | 'member_left' | 'team_post' | 'team_created' | 'team_locked'
  created_at: string
  data: {
    icon: string
    message: string
    time_ago: string
    member_name?: string
    team_name?: string
    skills?: string[]
    role?: string
    content_preview?: string
    looking_for?: string[]
    member_count?: number
  }
}

export interface SkillSupplyDemand {
  high_demand_skills: Array<{
    skill: string
    needed: number
    available: number
    status: string
  }>
  oversupplied_skills: Array<{
    skill: string
    needed: number
    available: number
  }>
  summary: {
    total_skills_in_demand: number
    total_skills_available: number
    critical_gaps: number
    high_demand_count: number
  }
}

// RPC function types
export interface DatabaseFunctions {
  get_hackathon_statistics: {
    Args: Record<string, never>
    Returns: HackathonStatistics
  }
  get_live_activity_feed: {
    Args: { p_limit?: number }
    Returns: ActivityFeedItem[]
  }
  get_skill_supply_demand: {
    Args: Record<string, never>
    Returns: SkillSupplyDemand
  }
}