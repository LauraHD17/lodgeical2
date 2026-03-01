// src/types/supabase.ts
// TypeScript types derived from the Lodge-ical database schema.
// In production, generate this file with:
//   supabase gen types typescript --local > src/types/supabase.ts

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
      properties: {
        Row: {
          id: string
          name: string
          slug: string
          is_active: boolean
          is_public: boolean
          timezone: string
          location: string | null
          images: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          is_active?: boolean
          is_public?: boolean
          timezone?: string
          location?: string | null
          images?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          is_active?: boolean
          is_public?: boolean
          timezone?: string
          location?: string | null
          images?: string[] | null
          created_at?: string
          updated_at?: string
        }
      }
      rooms: {
        Row: {
          id: string
          property_id: string
          name: string
          type: string
          max_guests: number
          base_rate_cents: number
          is_active: boolean
          description: string | null
          images: string[] | null
          amenities: string[] | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          property_id: string
          name: string
          type?: string
          max_guests: number
          base_rate_cents: number
          is_active?: boolean
          description?: string | null
          images?: string[] | null
          amenities?: string[] | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          name?: string
          type?: string
          max_guests?: number
          base_rate_cents?: number
          is_active?: boolean
          description?: string | null
          images?: string[] | null
          amenities?: string[] | null
          sort_order?: number
          created_at?: string
        }
      }
      guests: {
        Row: {
          id: string
          property_id: string
          first_name: string
          last_name: string
          email: string
          phone: string | null
          is_tax_exempt: boolean
          notes: string | null
          tags: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          property_id: string
          first_name: string
          last_name: string
          email: string
          phone?: string | null
          is_tax_exempt?: boolean
          notes?: string | null
          tags?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          first_name?: string
          last_name?: string
          email?: string
          phone?: string | null
          is_tax_exempt?: boolean
          notes?: string | null
          tags?: string[] | null
          created_at?: string
        }
      }
      reservations: {
        Row: {
          id: string
          property_id: string
          guest_id: string
          room_ids: string[]
          check_in: string
          check_out: string
          num_guests: number
          status: 'confirmed' | 'pending' | 'cancelled' | 'no_show'
          origin: 'direct' | 'widget' | 'import' | 'phone'
          total_due_cents: number
          is_tax_exempt: boolean
          confirmation_number: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          property_id: string
          guest_id: string
          room_ids: string[]
          check_in: string
          check_out: string
          num_guests: number
          status?: 'confirmed' | 'pending' | 'cancelled' | 'no_show'
          origin?: 'direct' | 'widget' | 'import' | 'phone'
          total_due_cents: number
          is_tax_exempt?: boolean
          confirmation_number: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          guest_id?: string
          room_ids?: string[]
          check_in?: string
          check_out?: string
          num_guests?: number
          status?: 'confirmed' | 'pending' | 'cancelled' | 'no_show'
          origin?: 'direct' | 'widget' | 'import' | 'phone'
          total_due_cents?: number
          is_tax_exempt?: boolean
          confirmation_number?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          reservation_id: string
          property_id: string
          type: 'charge' | 'refund'
          amount_cents: number
          status: 'succeeded' | 'pending' | 'failed' | 'requires_action'
          method: 'stripe' | 'manual' | 'cash' | 'check'
          stripe_payment_intent_id: string | null
          stripe_charge_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          reservation_id: string
          property_id: string
          type: 'charge' | 'refund'
          amount_cents: number
          status?: 'succeeded' | 'pending' | 'failed' | 'requires_action'
          method: 'stripe' | 'manual' | 'cash' | 'check'
          stripe_payment_intent_id?: string | null
          stripe_charge_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          reservation_id?: string
          property_id?: string
          type?: 'charge' | 'refund'
          amount_cents?: number
          status?: 'succeeded' | 'pending' | 'failed' | 'requires_action'
          method?: 'stripe' | 'manual' | 'cash' | 'check'
          stripe_payment_intent_id?: string | null
          stripe_charge_id?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      settings: {
        Row: {
          id: string
          property_id: string
          tax_rate: number
          currency: string
          cancellation_policy: 'flexible' | 'moderate' | 'strict'
          stripe_account_id: string | null
          stripe_publishable_key: string | null
          check_in_time: string
          check_out_time: string
          min_stay_nights: number
          require_payment_at_booking: boolean
          allow_partial_payment: boolean
        }
        Insert: {
          id?: string
          property_id: string
          tax_rate?: number
          currency?: string
          cancellation_policy?: 'flexible' | 'moderate' | 'strict'
          stripe_account_id?: string | null
          stripe_publishable_key?: string | null
          check_in_time?: string
          check_out_time?: string
          min_stay_nights?: number
          require_payment_at_booking?: boolean
          allow_partial_payment?: boolean
        }
        Update: {
          id?: string
          property_id?: string
          tax_rate?: number
          currency?: string
          cancellation_policy?: 'flexible' | 'moderate' | 'strict'
          stripe_account_id?: string | null
          stripe_publishable_key?: string | null
          check_in_time?: string
          check_out_time?: string
          min_stay_nights?: number
          require_payment_at_booking?: boolean
          allow_partial_payment?: boolean
        }
      }
      user_property_access: {
        Row: {
          id: string
          user_id: string
          property_id: string
          role: 'owner' | 'manager' | 'staff'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          property_id: string
          role?: 'owner' | 'manager' | 'staff'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string
          role?: 'owner' | 'manager' | 'staff'
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      reservation_status: 'confirmed' | 'pending' | 'cancelled' | 'no_show'
      reservation_origin: 'direct' | 'widget' | 'import' | 'phone'
      payment_type: 'charge' | 'refund'
      payment_status: 'succeeded' | 'pending' | 'failed' | 'requires_action'
      payment_method: 'stripe' | 'manual' | 'cash' | 'check'
      cancellation_policy: 'flexible' | 'moderate' | 'strict'
      user_role: 'owner' | 'manager' | 'staff'
    }
  }
}

// Convenience type aliases
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

export type Property = Tables<'properties'>
export type Room = Tables<'rooms'>
export type Guest = Tables<'guests'>
export type Reservation = Tables<'reservations'>
export type Payment = Tables<'payments'>
export type Settings = Tables<'settings'>
export type UserPropertyAccess = Tables<'user_property_access'>

export type ReservationStatus = Database['public']['Enums']['reservation_status']
export type ReservationOrigin = Database['public']['Enums']['reservation_origin']
export type PaymentType = Database['public']['Enums']['payment_type']
export type PaymentStatus = Database['public']['Enums']['payment_status']
export type PaymentMethod = Database['public']['Enums']['payment_method']
export type UserRole = Database['public']['Enums']['user_role']
