export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      adherence_logs: {
        Row: {
          child_id: string
          created_at: string
          id: string
          log_date: string
          logged_by: string | null
          note: string | null
          status: Database["public"]["Enums"]["adherence_status"]
          treatment_id: string
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          log_date: string
          logged_by?: string | null
          note?: string | null
          status?: Database["public"]["Enums"]["adherence_status"]
          treatment_id: string
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          log_date?: string
          logged_by?: string | null
          note?: string | null
          status?: Database["public"]["Enums"]["adherence_status"]
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adherence_logs_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adherence_logs_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          archived_at: string | null
          avatar_key: string | null
          birth_date: string
          chart_ref: string | null
          created_at: string
          family_id: string
          first_name: string
          id: string
        }
        Insert: {
          archived_at?: string | null
          avatar_key?: string | null
          birth_date: string
          chart_ref?: string | null
          created_at?: string
          family_id: string
          first_name: string
          id?: string
        }
        Update: {
          archived_at?: string | null
          avatar_key?: string | null
          birth_date?: string
          chart_ref?: string | null
          created_at?: string
          family_id?: string
          first_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_terms: {
        Row: {
          active: boolean
          content_md: string
          content_sha256: string
          id: string
          published_at: string
          version: string
        }
        Insert: {
          active?: boolean
          content_md: string
          content_sha256: string
          id?: string
          published_at?: string
          version: string
        }
        Update: {
          active?: boolean
          content_md?: string
          content_sha256?: string
          id?: string
          published_at?: string
          version?: string
        }
        Relationships: []
      }
      consents: {
        Row: {
          app_version: string | null
          child_id: string
          granted_at: string
          guardian_name_snapshot: string
          id: string
          revoked_at: string | null
          term_id: string
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          child_id: string
          granted_at?: string
          guardian_name_snapshot: string
          id?: string
          revoked_at?: string | null
          term_id: string
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          child_id?: string
          granted_at?: string
          guardian_name_snapshot?: string
          id?: string
          revoked_at?: string | null
          term_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "consent_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          id: string
          notes: string | null
          processed_at: string | null
          requested_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notes?: string | null
          processed_at?: string | null
          requested_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notes?: string | null
          processed_at?: string | null
          requested_at?: string
          user_id?: string
        }
        Relationships: []
      }
      families: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      family_invites: {
        Row: {
          accepted_at: string | null
          email: string
          expires_at: string
          family_id: string
          id: string
          invited_at: string
          invited_by: string
        }
        Insert: {
          accepted_at?: string | null
          email: string
          expires_at?: string
          family_id: string
          id?: string
          invited_at?: string
          invited_by: string
        }
        Update: {
          accepted_at?: string | null
          email?: string
          expires_at?: string
          family_id?: string
          id?: string
          invited_at?: string
          invited_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      guardians: {
        Row: {
          created_at: string
          display_name: string
          family_id: string
          is_primary: boolean
          relationship: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          family_id: string
          is_primary?: boolean
          relationship?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          family_id?: string
          is_primary?: boolean
          relationship?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardians_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      measurements: {
        Row: {
          child_id: string
          created_at: string
          doctor_note: string | null
          id: string
          measured_on: string
          od_axial_mm: number | null
          od_cylinder: number | null
          od_se: number | null
          od_sphere: number | null
          oe_axial_mm: number | null
          oe_cylinder: number | null
          oe_se: number | null
          oe_sphere: number | null
          recorded_by: string
          status: Database["public"]["Enums"]["clinical_status"]
        }
        Insert: {
          child_id: string
          created_at?: string
          doctor_note?: string | null
          id?: string
          measured_on: string
          od_axial_mm?: number | null
          od_cylinder?: number | null
          od_se?: number | null
          od_sphere?: number | null
          oe_axial_mm?: number | null
          oe_cylinder?: number | null
          oe_se?: number | null
          oe_sphere?: number | null
          recorded_by: string
          status?: Database["public"]["Enums"]["clinical_status"]
        }
        Update: {
          child_id?: string
          created_at?: string
          doctor_note?: string | null
          id?: string
          measured_on?: string
          od_axial_mm?: number | null
          od_cylinder?: number | null
          od_se?: number | null
          od_sphere?: number | null
          oe_axial_mm?: number | null
          oe_cylinder?: number | null
          oe_se?: number | null
          oe_sphere?: number | null
          recorded_by?: string
          status?: Database["public"]["Enums"]["clinical_status"]
        }
        Relationships: [
          {
            foreignKeyName: "measurements_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurements_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          expo_token: string
          platform: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          expo_token: string
          platform?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          expo_token?: string
          platform?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminder_prefs: {
        Row: {
          enabled: boolean
          guardian_user_id: string
          reminder_time: string
          treatment_id: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          guardian_user_id: string
          reminder_time: string
          treatment_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          guardian_user_id?: string
          reminder_time?: string
          treatment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_prefs_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: []
      }
      treatments: {
        Row: {
          active: boolean
          child_id: string
          created_at: string
          created_by: string | null
          days_of_week: number[]
          ends_on: string | null
          id: string
          instructions: string | null
          starts_on: string
          suggested_time: string | null
          type: Database["public"]["Enums"]["treatment_type"]
        }
        Insert: {
          active?: boolean
          child_id: string
          created_at?: string
          created_by?: string | null
          days_of_week?: number[]
          ends_on?: string | null
          id?: string
          instructions?: string | null
          starts_on?: string
          suggested_time?: string | null
          type: Database["public"]["Enums"]["treatment_type"]
        }
        Update: {
          active?: boolean
          child_id?: string
          created_at?: string
          created_by?: string | null
          days_of_week?: number[]
          ends_on?: string | null
          id?: string
          instructions?: string | null
          starts_on?: string
          suggested_time?: string | null
          type?: Database["public"]["Enums"]["treatment_type"]
        }
        Relationships: [
          {
            foreignKeyName: "treatments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      adherence_status: "feito" | "pulado"
      clinical_status: "controle_adequado" | "atencao" | "sem_avaliacao"
      staff_role: "medica" | "secretaria" | "admin"
      treatment_type: "atropina" | "ortho_k" | "oculos_lentes"
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
    Enums: {
      adherence_status: ["feito", "pulado"],
      clinical_status: ["controle_adequado", "atencao", "sem_avaliacao"],
      staff_role: ["medica", "secretaria", "admin"],
      treatment_type: ["atropina", "ortho_k", "oculos_lentes"],
    },
  },
} as const

