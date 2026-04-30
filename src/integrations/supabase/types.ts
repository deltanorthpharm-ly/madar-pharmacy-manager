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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cash_drawers: {
        Row: {
          closed_at: string | null
          closing_balance: number | null
          expected_balance: number
          id: string
          is_open: boolean
          opened_at: string
          opening_balance: number
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          closing_balance?: number | null
          expected_balance?: number
          id?: string
          is_open?: boolean
          opened_at?: string
          opening_balance?: number
          user_id: string
        }
        Update: {
          closed_at?: string | null
          closing_balance?: number | null
          expected_balance?: number
          id?: string
          is_open?: boolean
          opened_at?: string
          opening_balance?: number
          user_id?: string
        }
        Relationships: []
      }
      cash_transactions: {
        Row: {
          amount: number
          created_at: string
          drawer_id: string
          id: string
          notes: string | null
          reference_id: string | null
          type: Database["public"]["Enums"]["cash_tx_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          drawer_id: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          type: Database["public"]["Enums"]["cash_tx_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          drawer_id?: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          type?: Database["public"]["Enums"]["cash_tx_type"]
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_drawer_id_fkey"
            columns: ["drawer_id"]
            isOneToOne: false
            referencedRelation: "cash_drawers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          balance: number
          created_at: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      edit_log: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          edited_at: string
          edited_by: string | null
          id: string
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          edited_at?: string
          edited_by?: string | null
          id?: string
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          edited_at?: string
          edited_by?: string | null
          id?: string
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          drawer_id: string | null
          id: string
          notes: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          drawer_id?: string | null
          id?: string
          notes?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          drawer_id?: string | null
          id?: string
          notes?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_drawer_id_fkey"
            columns: ["drawer_id"]
            isOneToOne: false
            referencedRelation: "cash_drawers"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_withdrawals: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          partner_name: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          partner_name: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          partner_name?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          sale_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batches: {
        Row: {
          batch_number: string | null
          cost_price: number
          created_at: string
          expiry_date: string | null
          id: string
          product_id: string
          quantity: number
        }
        Insert: {
          batch_number?: string | null
          cost_price?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          product_id: string
          quantity?: number
        }
        Update: {
          batch_number?: string | null
          cost_price?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          created_at: string
          current_stock: number
          has_expiry: boolean
          id: string
          is_active: boolean
          min_stock: number
          name: string
          pack_size: number
          purchase_price: number
          scientific_name: string | null
          selling_price: number
          sku: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          current_stock?: number
          has_expiry?: boolean
          id?: string
          is_active?: boolean
          min_stock?: number
          name: string
          pack_size?: number
          purchase_price?: number
          scientific_name?: string | null
          selling_price?: number
          sku?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          current_stock?: number
          has_expiry?: boolean
          id?: string
          is_active?: boolean
          min_stock?: number
          name?: string
          pack_size?: number
          purchase_price?: number
          scientific_name?: string | null
          selling_price?: number
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          pin_hash: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          pin_hash?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          pin_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          batch_id: string | null
          cost_price: number
          id: string
          product_id: string
          purchase_id: string
          quantity: number
          total: number
        }
        Insert: {
          batch_id?: string | null
          cost_price: number
          id?: string
          product_id: string
          purchase_id: string
          quantity: number
          total: number
        }
        Update: {
          batch_id?: string | null
          cost_price?: number
          id?: string
          product_id?: string
          purchase_id?: string
          quantity?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          id: string
          invoice_number: string | null
          paid_amount: number
          supplier_id: string | null
          supplier_name: string | null
          total_amount: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_number?: string | null
          paid_amount?: number
          supplier_id?: string | null
          supplier_name?: string | null
          total_amount?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invoice_number?: string | null
          paid_amount?: number
          supplier_id?: string | null
          supplier_name?: string | null
          total_amount?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          batch_id: string | null
          cost_price: number
          id: string
          product_id: string
          quantity: number
          sale_id: string
          selling_price: number
          total: number
        }
        Insert: {
          batch_id?: string | null
          cost_price: number
          id?: string
          product_id: string
          quantity: number
          sale_id: string
          selling_price: number
          total: number
        }
        Update: {
          batch_id?: string | null
          cost_price?: number
          id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          selling_price?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          customer_id: string | null
          discount: number
          drawer_id: string | null
          id: string
          invoice_number: string
          is_voided: boolean
          profit: number
          total_amount: number
          total_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          discount?: number
          drawer_id?: string | null
          id?: string
          invoice_number: string
          is_voided?: boolean
          profit?: number
          total_amount?: number
          total_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          discount?: number
          drawer_id?: string | null
          id?: string
          invoice_number?: string
          is_voided?: boolean
          profit?: number
          total_amount?: number
          total_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_drawer_id_fkey"
            columns: ["drawer_id"]
            isOneToOne: false
            referencedRelation: "cash_drawers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          type: Database["public"]["Enums"]["movement_type"]
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          type: Database["public"]["Enums"]["movement_type"]
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          balance: number
          created_at: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      system_rebuilds: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          progress: number
          report: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["rebuild_status"]
          triggered_by: string | null
          type: Database["public"]["Enums"]["rebuild_type"]
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          progress?: number
          report?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["rebuild_status"]
          triggered_by?: string | null
          type: Database["public"]["Enums"]["rebuild_type"]
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          progress?: number
          report?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["rebuild_status"]
          triggered_by?: string | null
          type?: Database["public"]["Enums"]["rebuild_type"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "cashier"
      cash_tx_type:
        | "opening"
        | "sale"
        | "expense"
        | "withdrawal"
        | "deposit"
        | "closing"
      movement_type: "sale" | "purchase" | "adjustment" | "return" | "rebuild"
      payment_method:
        | "cash"
        | "card"
        | "mobicash"
        | "yusrpay"
        | "edfaali"
        | "mobinab"
        | "transfer"
      rebuild_status: "queued" | "running" | "completed" | "failed"
      rebuild_type:
        | "inventory"
        | "financials"
        | "product_integrity"
        | "anomalies"
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
    Enums: {
      app_role: ["admin", "cashier"],
      cash_tx_type: [
        "opening",
        "sale",
        "expense",
        "withdrawal",
        "deposit",
        "closing",
      ],
      movement_type: ["sale", "purchase", "adjustment", "return", "rebuild"],
      payment_method: [
        "cash",
        "card",
        "mobicash",
        "yusrpay",
        "edfaali",
        "mobinab",
        "transfer",
      ],
      rebuild_status: ["queued", "running", "completed", "failed"],
      rebuild_type: [
        "inventory",
        "financials",
        "product_integrity",
        "anomalies",
      ],
    },
  },
} as const
