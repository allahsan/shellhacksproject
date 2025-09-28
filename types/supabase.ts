export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          actor_id: string | null
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          profile_id: string | null
          team_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          profile_id?: string | null
          team_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          profile_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          profile_id: string
          requested_role: string
          responded_at: string | null
          responded_by: string | null
          response_message: string | null
          status: string | null
          team_id: string
          withdrawn_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          profile_id: string
          requested_role: string
          responded_at?: string | null
          responded_by?: string | null
          response_message?: string | null
          status?: string | null
          team_id: string
          withdrawn_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          profile_id?: string
          requested_role?: string
          responded_at?: string | null
          responded_by?: string | null
          response_message?: string | null
          status?: string | null
          team_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      leader_votes: {
        Row: {
          candidate_id: string
          created_at: string | null
          id: string
          team_id: string
          updated_at: string | null
          voter_id: string
          voting_round: number | null
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          id?: string
          team_id: string
          updated_at?: string | null
          voter_id: string
          voting_round?: number | null
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          id?: string
          team_id?: string
          updated_at?: string | null
          voter_id?: string
          voting_round?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leader_votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leader_votes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leader_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_read: boolean | null
          join_request_id: string | null
          message: string
          metadata: Json | null
          priority: string | null
          profile_id: string
          read_at: string | null
          related_profile_id: string | null
          team_id: string | null
          title: string
          type: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          join_request_id?: string | null
          message: string
          metadata?: Json | null
          priority?: string | null
          profile_id: string
          read_at?: string | null
          related_profile_id?: string | null
          team_id?: string | null
          title: string
          type: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          join_request_id?: string | null
          message?: string
          metadata?: Json | null
          priority?: string | null
          profile_id?: string
          read_at?: string | null
          related_profile_id?: string | null
          team_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_join_request_id_fkey"
            columns: ["join_request_id"]
            isOneToOne: false
            referencedRelation: "join_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_profile_id_fkey"
            columns: ["related_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string | null
          author_name: string | null
          content: string
          created_at: string | null
          edited_at: string | null
          id: string
          is_edited: boolean | null
          parent_comment_id: string | null
          post_id: string
          session_id: string | null
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          content: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
          parent_comment_id?: string | null
          post_id: string
          session_id?: string | null
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          content?: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
          parent_comment_id?: string | null
          post_id?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "team_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          profile_id: string | null
          session_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          profile_id?: string | null
          session_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          profile_id?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "team_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          current_team_id: string | null
          discord_username: string | null
          email: string | null
          github_username: string | null
          id: string
          is_available: boolean | null
          last_active_at: string | null
          name: string
          other_proficiency: string | null
          phone: string | null
          proficiencies: string[] | null
          profile_type: string | null
          secret_code: string
          slack_username: string | null
          telegram_username: string | null
          updated_at: string | null
          user_status: string | null
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string | null
          current_team_id?: string | null
          discord_username?: string | null
          email?: string | null
          github_username?: string | null
          id?: string
          is_available?: boolean | null
          last_active_at?: string | null
          name: string
          other_proficiency?: string | null
          phone?: string | null
          proficiencies?: string[] | null
          profile_type?: string | null
          secret_code: string
          slack_username?: string | null
          telegram_username?: string | null
          updated_at?: string | null
          user_status?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string | null
          current_team_id?: string | null
          discord_username?: string | null
          email?: string | null
          github_username?: string | null
          id?: string
          is_available?: boolean | null
          last_active_at?: string | null
          name?: string
          other_proficiency?: string | null
          phone?: string | null
          proficiencies?: string[] | null
          profile_type?: string | null
          secret_code?: string
          slack_username?: string | null
          telegram_username?: string | null
          updated_at?: string | null
          user_status?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_current_team"
            columns: ["current_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          can_manage_requests: boolean | null
          created_at: string | null
          id: string
          joined_at: string | null
          profile_id: string
          role: string
          status: string | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          can_manage_requests?: boolean | null
          created_at?: string | null
          id?: string
          joined_at?: string | null
          profile_id: string
          role: string
          status?: string | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          can_manage_requests?: boolean | null
          created_at?: string | null
          id?: string
          joined_at?: string | null
          profile_id?: string
          role?: string
          status?: string | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_posts: {
        Row: {
          author_id: string
          comments_count: number | null
          content: string
          created_at: string | null
          id: string
          likes_count: number | null
          post_type: string | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          comments_count?: number | null
          content: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          post_type?: string | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          comments_count?: number | null
          content?: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          post_type?: string | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_posts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          auto_accept_requests: boolean | null
          created_at: string | null
          description: string
          disbanded_at: string | null
          id: string
          leader_id: string
          looking_for_roles: string[] | null
          max_members: number | null
          min_members: number | null
          name: string
          status: string | null
          tags: string[] | null
          tech_stack: string[] | null
          updated_at: string | null
          voting_ends_at: string | null
          voting_started_at: string | null
        }
        Insert: {
          auto_accept_requests?: boolean | null
          created_at?: string | null
          description: string
          disbanded_at?: string | null
          id?: string
          leader_id: string
          looking_for_roles?: string[] | null
          max_members?: number | null
          min_members?: number | null
          name: string
          status?: string | null
          tags?: string[] | null
          tech_stack?: string[] | null
          updated_at?: string | null
          voting_ends_at?: string | null
          voting_started_at?: string | null
        }
        Update: {
          auto_accept_requests?: boolean | null
          created_at?: string | null
          description?: string
          disbanded_at?: string | null
          id?: string
          leader_id?: string
          looking_for_roles?: string[] | null
          max_members?: number | null
          min_members?: number | null
          name?: string
          status?: string | null
          tags?: string[] | null
          tech_stack?: string[] | null
          updated_at?: string | null
          voting_ends_at?: string | null
          voting_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cast_vote: {
        Args: { p_candidate_id: string; p_team_id: string; p_voter_id: string }
        Returns: Json
      }
      check_voting_complete: {
        Args: { p_team_id: string }
        Returns: undefined
      }
      create_profile: {
        Args: {
          p_email: string
          p_name: string
          p_phone: string
          p_proficiencies: string[]
          p_secret_code: string
        }
        Returns: string
      }
      create_team: {
        Args: {
          p_description: string
          p_leader_id: string
          p_looking_for_roles: string[]
          p_name: string
          p_tech_stack?: string[]
        }
        Returns: string
      }
      debug_skill_data: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      delete_comment: {
        Args: { p_comment_id: string; p_session_id: string }
        Returns: Json
      }
      edit_comment: {
        Args: {
          p_comment_id: string
          p_new_content: string
          p_session_id: string
        }
        Returns: Json
      }
      finalize_voting: {
        Args: { p_team_id: string }
        Returns: Json
      }
      get_hackathon_statistics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_live_activity_feed: {
        Args: { p_limit?: number }
        Returns: Json
      }
      get_skill_distribution: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_skill_supply_demand: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      initiate_leader_voting: {
        Args: { p_leaving_leader_id: string; p_team_id: string }
        Returns: Json
      }
      leave_team: {
        Args: { p_profile_id: string; p_team_id: string }
        Returns: Json
      }
      login_with_secret: {
        Args: { p_identifier: string; p_secret_code: string }
        Returns: Json
      }
      reply_to_comment: {
        Args: {
          p_author_name: string
          p_content: string
          p_parent_comment_id: string
          p_post_id: string
          p_session_id: string
        }
        Returns: string
      }
      request_to_join: {
        Args: {
          p_message?: string
          p_profile_id: string
          p_requested_role: string
          p_team_id: string
        }
        Returns: Json
      }
      respond_to_request: {
        Args: {
          p_accept: boolean
          p_leader_id: string
          p_request_id: string
          p_response_message?: string
        }
        Returns: Json
      }
      share_team_contacts: {
        Args: { p_team_id: string }
        Returns: undefined
      }
      toggle_post_like: {
        Args: {
          p_post_id: string
          p_profile_id?: string
          p_session_id?: string
        }
        Returns: Json
      }
      update_secret_code: {
        Args: {
          p_current_code: string
          p_new_code: string
          p_profile_id: string
        }
        Returns: boolean
      }
      update_user_status: {
        Args: { p_profile_id: string; p_status: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
