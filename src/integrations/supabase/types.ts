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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          event_type: string
          id: string
          note: string | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          event_type: string
          id?: string
          note?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          event_type?: string
          id?: string
          note?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      admin_email_allowlist: {
        Row: {
          created_at: string
          email: string
          id: string
          label: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          label?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          label?: string | null
        }
        Relationships: []
      }
      admin_messages: {
        Row: {
          admin_reply: string | null
          category: string
          created_at: string
          id: string
          message: string
          status: string
          subject: string
          updated_at: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          category?: string
          created_at?: string
          id?: string
          message: string
          status?: string
          subject: string
          updated_at?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_weekly_reports: {
        Row: {
          created_at: string
          delivered_at: string | null
          id: string
          period_end: string
          period_start: string
          status: string
          summary: Json
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          id?: string
          period_end: string
          period_start: string
          status?: string
          summary?: Json
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          id?: string
          period_end?: string
          period_start?: string
          status?: string
          summary?: Json
        }
        Relationships: []
      }
      ai_memory_entries: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          summary: string | null
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          summary?: string | null
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          summary?: string | null
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read?: boolean
          title: string
          type?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: []
      }
      automation_approvals: {
        Row: {
          action_type: string
          admin_note: string | null
          created_at: string
          decided_at: string | null
          details: Json
          id: string
          status: string
          title: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          admin_note?: string | null
          created_at?: string
          decided_at?: string | null
          details?: Json
          id?: string
          status?: string
          title: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          admin_note?: string | null
          created_at?: string
          decided_at?: string | null
          details?: Json
          id?: string
          status?: string
          title?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          mode: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_usage: {
        Row: {
          action: string
          amount: number
          created_at: string
          description: string | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          metadata: Json
          source: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          metadata?: Json
          source?: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          metadata?: Json
          source?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_controls: {
        Row: {
          id: string
          kill_switch: boolean
          reason: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          kill_switch?: boolean
          reason?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          kill_switch?: boolean
          reason?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_secret: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_secret?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_secret?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_by: string
          created_at: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          blocked_by: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          blocked_by?: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          approval_note: string | null
          approval_status: string
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          credits: number
          display_name: string | null
          email: string | null
          github_token: string | null
          id: string
          last_active: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_note?: string | null
          approval_status?: string
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string | null
          github_token?: string | null
          id?: string
          last_active?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_note?: string | null
          approval_status?: string
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string | null
          github_token?: string | null
          id?: string
          last_active?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          name: string
          status: string | null
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          status?: string | null
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          status?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_secrets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_block_user: {
        Args: { block_reason?: string; target_user_id: string }
        Returns: undefined
      }
      admin_dashboard_stats: { Args: never; Returns: Json }
      admin_list_messages: {
        Args: never
        Returns: {
          admin_reply: string | null
          category: string
          created_at: string
          id: string
          message: string
          status: string
          subject: string
          updated_at: string
          user_email: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "admin_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_profiles: {
        Args: never
        Returns: {
          approval_note: string | null
          approval_status: string
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          credits: number
          display_name: string | null
          email: string | null
          github_token: string | null
          id: string
          last_active: string | null
          role: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_user_projects: {
        Args: never
        Returns: {
          blocked: boolean
          created_at: string
          description: string
          id: string
          name: string
          status: string
          type: string
          updated_at: string
          user_email: string
          user_id: string
        }[]
      }
      admin_unblock_user: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      admin_update_credits: {
        Args: { new_credits: number; target_user_id: string }
        Returns: undefined
      }
      admin_update_user_access: {
        Args: {
          admin_note?: string
          block_reason?: string
          block_user?: boolean
          new_approval_status?: string
          new_approved?: boolean
          new_credits?: number
          target_user_id: string
        }
        Returns: {
          approval_note: string | null
          approval_status: string
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          credits: number
          display_name: string | null
          email: string | null
          github_token: string | null
          id: string
          last_active: string | null
          role: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      deduct_credits: {
        Args: { amount: number; reason?: string }
        Returns: number
      }
      ensure_user_profile: { Args: never; Returns: undefined }
      get_kill_switch_state: {
        Args: never
        Returns: {
          kill_switch: boolean
          reason: string
          updated_at: string
        }[]
      }
      get_my_role: { Args: never; Returns: string }
      is_user_blocked: { Args: { target_user_id: string }; Returns: boolean }
      log_auth_event: {
        Args: { detail?: Json; event: string }
        Returns: undefined
      }
      log_emergency_contact_view: {
        Args: { target_ids: string[] }
        Returns: undefined
      }
      log_system_recovery_event: {
        Args: { detail?: Json; event: string }
        Returns: undefined
      }
      promote_admin_by_email: {
        Args: { target_email: string }
        Returns: string
      }
      search_ai_memory: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          content: string
          created_at: string
          id: string
          metadata: Json
          similarity: number
          summary: string
          topic: string
        }[]
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
  public: {
    Enums: {},
  },
} as const
