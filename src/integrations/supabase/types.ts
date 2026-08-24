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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      menu_items: {
        Row: {
          allergens: string[] | null
          available: boolean
          badge: string | null
          category: string
          created_at: string
          description: string | null
          dietary_tags: string[] | null
          id: string
          image_url: string | null
          is_deleted: boolean | null
          is_featured: boolean | null
          name: string
          price: number
          restaurant_id: string
          sort_order: number | null
        }
        Insert: {
          allergens?: string[] | null
          available?: boolean
          badge?: string | null
          category: string
          created_at?: string
          description?: string | null
          dietary_tags?: string[] | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean | null
          is_featured?: boolean | null
          name: string
          price?: number
          restaurant_id: string
          sort_order?: number | null
        }
        Update: {
          allergens?: string[] | null
          available?: boolean
          badge?: string | null
          category?: string
          created_at?: string
          description?: string | null
          dietary_tags?: string[] | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean | null
          is_featured?: boolean | null
          name?: string
          price?: number
          restaurant_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          added_by_device_token: string | null
          added_by_name: string | null
          added_by_user_id: string | null
          allergy_override_ack: boolean | null
          created_at: string | null
          customizations: Json | null
          id: string
          menu_item_id: string
          note: string | null
          order_id: string
          participant_name: string | null
          qty: number
          session_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          added_by_device_token?: string | null
          added_by_name?: string | null
          added_by_user_id?: string | null
          allergy_override_ack?: boolean | null
          created_at?: string | null
          customizations?: Json | null
          id?: string
          menu_item_id: string
          note?: string | null
          order_id: string
          participant_name?: string | null
          qty?: number
          session_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          added_by_device_token?: string | null
          added_by_name?: string | null
          added_by_user_id?: string | null
          allergy_override_ack?: boolean | null
          created_at?: string | null
          customizations?: Json | null
          id?: string
          menu_item_id?: string
          note?: string | null
          order_id?: string
          participant_name?: string | null
          qty?: number
          session_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_settings: {
        Row: {
          enabled: boolean | null
          id: string
          max_points_redeemable_per_order: number | null
          min_order_value_to_redeem: number | null
          points_expiry_days: number | null
          points_for_comment: number | null
          points_for_question: number | null
          points_for_rating: number | null
          points_per_rupee: number | null
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          enabled?: boolean | null
          id?: string
          max_points_redeemable_per_order?: number | null
          min_order_value_to_redeem?: number | null
          points_expiry_days?: number | null
          points_for_comment?: number | null
          points_for_question?: number | null
          points_for_rating?: number | null
          points_per_rupee?: number | null
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          enabled?: boolean | null
          id?: string
          max_points_redeemable_per_order?: number | null
          min_order_value_to_redeem?: number | null
          points_expiry_days?: number | null
          points_for_comment?: number | null
          points_for_question?: number | null
          points_for_rating?: number | null
          points_per_rupee?: number | null
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          session_id: string
          status: string
          subtotal: number
          tax: number
          total: number
          user_id: string | null
          use_credits: boolean | null
          credits_applied: number | null
          points_redeemed: number | null
          guest_email: string | null
          kitchen_status: string | null
          discount_amount: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          user_id?: string | null
          use_credits?: boolean | null
          credits_applied?: number | null
          points_redeemed?: number | null
          guest_email?: string | null
          kitchen_status?: string | null
          discount_amount?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          user_id?: string | null
          use_credits?: boolean | null
          credits_applied?: number | null
          points_redeemed?: number | null
          guest_email?: string | null
          kitchen_status?: string | null
          discount_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allergens: string[] | null
          avatar_url: string | null
          created_at: string | null
          dietary_info: Json | null
          dietary_tags: string[] | null
          full_name: string | null
          id: string
          name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          allergens?: string[] | null
          avatar_url?: string | null
          created_at?: string | null
          dietary_info?: Json | null
          dietary_tags?: string[] | null
          full_name?: string | null
          id: string
          name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          allergens?: string[] | null
          avatar_url?: string | null
          created_at?: string | null
          dietary_info?: Json | null
          dietary_tags?: string[] | null
          full_name?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          cuisine_type: string | null
          id: string
          is_active: boolean | null
          deactivated_at: string | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          owner_id: string | null
          tagline: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          cuisine_type?: string | null
          id?: string
          is_active?: boolean | null
          deactivated_at?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          owner_id?: string | null
          tagline?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          cuisine_type?: string | null
          id?: string
          is_active?: boolean | null
          deactivated_at?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          owner_id?: string | null
          tagline?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          access_token: string
          created_at: string
          id: string
          last_activity_at: string | null
          participant_count: number | null
          status: string
          table_id: string
        }
        Insert: {
          access_token?: string
          created_at?: string
          id?: string
          last_activity_at?: string | null
          participant_count?: number | null
          status?: string
          table_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          last_activity_at?: string | null
          participant_count?: number | null
          status?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          label: string | null
          qr_token: string
          restaurant_id: string
          seat_count: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          label?: string | null
          qr_token: string
          restaurant_id: string
          seat_count?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          label?: string | null
          qr_token?: string
          restaurant_id?: string
          seat_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          id: string
          order_id: string | null
          points: number | null
          reason: string | null
          restaurant_id: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          points?: number | null
          reason?: string | null
          restaurant_id?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          points?: number | null
          reason?: string | null
          restaurant_id?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          id: string
          restaurant_id: string
          name: string
          description: string | null
          rule_json: Json
          valid_from: string | null
          valid_to: string | null
          active: boolean
        }
        Insert: {
          id?: string
          restaurant_id: string
          name: string
          description?: string | null
          rule_json?: Json
          valid_from?: string | null
          valid_to?: string | null
          active?: boolean
        }
        Update: {
          id?: string
          restaurant_id?: string
          name?: string
          description?: string | null
          rule_json?: Json
          valid_from?: string | null
          valid_to?: string | null
          active?: boolean
        }
        Relationships: []
      }
      feedback: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          micro_answers: Json | null
          order_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          micro_answers?: Json | null
          order_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          micro_answers?: Json | null
          order_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: []
      }
      order_discounts: {
        Row: {
          applied_at: string | null
          coupon_id: string
          discount_amount: number
          id: string
          order_id: string
        }
        Insert: {
          applied_at?: string | null
          coupon_id: string
          discount_amount: number
          id?: string
          order_id: string
        }
        Update: {
          applied_at?: string | null
          coupon_id?: string
          discount_amount?: number
          id?: string
          order_id?: string
        }
        Relationships: []
      }
      recommendation_logs: {
        Row: {
          added_to_cart: boolean | null
          created_at: string | null
          id: string
          item_id: string
          reason: string | null
          session_id: string
          source: string | null
          user_id: string | null
        }
        Insert: {
          added_to_cart?: boolean | null
          created_at?: string | null
          id?: string
          item_id: string
          reason?: string | null
          session_id: string
          source?: string | null
          user_id?: string | null
        }
        Update: {
          added_to_cart?: boolean | null
          created_at?: string | null
          id?: string
          item_id?: string
          reason?: string | null
          session_id?: string
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      session_participants: {
        Row: {
          created_at: string | null
          device_token: string | null
          guest_name: string | null
          id: string
          name: string | null
          session_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_token?: string | null
          guest_name?: string | null
          id?: string
          name?: string | null
          session_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_token?: string | null
          guest_name?: string | null
          id?: string
          name?: string | null
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      waiter_calls: {
        Row: {
          created_at: string | null
          id: string
          reason: string | null
          resolved_at: string | null
          restaurant_id: string
          session_id: string
          status: string | null
          table_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason?: string | null
          resolved_at?: string | null
          restaurant_id: string
          session_id: string
          status?: string | null
          table_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string | null
          resolved_at?: string | null
          restaurant_id?: string
          session_id?: string
          status?: string | null
          table_id?: string
        }
        Relationships: []
      }
      otp_verifications: {
        Row: {
          id: string
          user_id: string
          purpose: string
          code_hash: string
          salt: string
          attempts: number
          max_attempts: number
          expires_at: string
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          purpose: string
          code_hash: string
          salt: string
          attempts?: number
          max_attempts?: number
          expires_at: string
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          purpose?: string
          code_hash?: string
          salt?: string
          attempts?: number
          max_attempts?: number
          expires_at?: string
          used_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_restaurant_account: {
        Args: {
          owner_id_param: string
        }
        Returns: undefined
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
