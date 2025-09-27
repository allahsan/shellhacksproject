export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          secret_code_hash: string
          profile_type: 'individual' | 'recruiter'
          user_status: 'available' | 'busy' | 'break' | 'offline'
          proficiencies: string[]
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      teams: {
        Row: {
          id: string
          name: string
          description: string
          status: 'forming' | 'locked' | 'disbanded'
          leader_id: string
          looking_for_roles: string[]
          tech_stack: string[]
          project_idea: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['teams']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['teams']['Insert']>
      }
      team_members: {
        Row: {
          id: string
          team_id: string
          profile_id: string
          role: string
          joined_at: string
        }
        Insert: Omit<Database['public']['Tables']['team_members']['Row'], 'id' | 'joined_at'>
        Update: Partial<Database['public']['Tables']['team_members']['Insert']>
      }
      join_requests: {
        Row: {
          id: string
          team_id: string
          requester_id: string
          requested_role: string
          message: string | null
          status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
          requested_at: string
          responded_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['join_requests']['Row'], 'id' | 'requested_at' | 'responded_at'>
        Update: Partial<Database['public']['Tables']['join_requests']['Insert']>
      }
      leader_votes: {
        Row: {
          id: string
          team_id: string
          voter_id: string
          candidate_id: string
          voting_session: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['leader_votes']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['leader_votes']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          profile_id: string
          type: string
          title: string
          message: string
          data: Json | null
          read: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      activities: {
        Row: {
          id: string
          team_id: string
          actor_id: string
          action: string
          details: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['activities']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['activities']['Insert']>
      }
    }
    Functions: {
      login_with_secret: {
        Args: {
          p_identifier: string
          p_secret_code: string
        }
        Returns: string
      }
      create_profile: {
        Args: {
          p_name: string
          p_email: string | null
          p_phone: string | null
          p_secret_code: string
          p_proficiencies: string[]
        }
        Returns: string
      }
      create_team: {
        Args: {
          p_leader_id: string
          p_name: string
          p_description: string
          p_looking_for_roles: string[]
          p_tech_stack: string[]
        }
        Returns: string
      }
      request_to_join: {
        Args: {
          p_requester_id: string
          p_team_id: string
          p_requested_role: string
          p_message: string | null
        }
        Returns: string
      }
      respond_to_request: {
        Args: {
          p_leader_id: string
          p_request_id: string
          p_accepted: boolean
        }
        Returns: boolean
      }
      claim_role: {
        Args: {
          p_member_id: string
          p_new_role: string
        }
        Returns: boolean
      }
      leave_team: {
        Args: {
          p_member_id: string
        }
        Returns: boolean
      }
      start_voting: {
        Args: {
          p_team_id: string
        }
        Returns: string
      }
      cast_vote: {
        Args: {
          p_voter_id: string
          p_candidate_id: string
          p_voting_session: string
        }
        Returns: boolean
      }
      finalize_voting: {
        Args: {
          p_voting_session: string
        }
        Returns: string | null
      }
      disband_team: {
        Args: {
          p_leader_id: string
        }
        Returns: boolean
      }
    }
  }
}