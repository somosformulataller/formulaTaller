// ============================================================================
// TypeScript types derived from the Supabase schema.
// Keep in sync with supabase/migrations/0001_init.sql
// ============================================================================

export type UserRole = 'admin' | 'mechanic';
export type OrderStatus = 'sin_mecanico' | 'con_mecanico' | 'lista';
export type StageStatus = 'pending' | 'in_progress' | 'done';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'>;
export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;

// A mechanic profile enriched with the auth email (email lives in auth.users,
// not in the profiles table).
export interface Mechanic extends Profile {
  email: string | null;
}

export interface Order {
  id: string;
  public_token: string;
  client_first_name: string;
  client_last_name: string;
  client_whatsapp: string;
  car_model: string;
  assigned_mechanic_id: string | null;
  status: OrderStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  assigned_mechanic?: Profile | null;
  stages?: OrderStage[];
}

export type OrderInsert = Omit<Order, 'id' | 'public_token' | 'created_at' | 'updated_at' | 'assigned_mechanic' | 'stages'>;
export type OrderUpdate = Partial<Omit<Order, 'id' | 'public_token' | 'created_at' | 'updated_at' | 'assigned_mechanic' | 'stages'>>;

export interface StageAttachment {
  id: string;
  stage_id: string;
  order_id: string;
  path: string;
  url: string;
  name: string | null;
  mime: string | null;
  created_by: string | null;
  created_at: string;
}

export interface OrderStage {
  id: string;
  order_id: string;
  name: string;
  description: string | null;
  position: number;
  status: StageStatus;
  completed_at: string | null;
  created_at: string;
  // joined
  attachments?: StageAttachment[];
}

export type OrderStageInsert = Omit<OrderStage, 'id' | 'created_at'>;
export type OrderStageUpdate = Partial<Omit<OrderStage, 'id' | 'order_id' | 'created_at'>>;

// ============================================================================
// Supabase Database type (used by createClient / createServerClient)
// ============================================================================
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: OrderInsert;
        Update: OrderUpdate;
        Relationships: [];
      };
      order_stages: {
        Row: OrderStage;
        Insert: OrderStageInsert;
        Update: OrderStageUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_staff: { Args: Record<never, never>; Returns: boolean };
      is_admin: { Args: Record<never, never>; Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      order_status: OrderStatus;
      stage_status: StageStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

// ============================================================================
// API payload types
// ============================================================================

export interface CreateOrderPayload {
  client_first_name: string;
  client_last_name: string;
  client_whatsapp: string;
  car_model: string;
  assigned_mechanic_id?: string | null;
  notes?: string | null;
}

export interface UpdateOrderPayload {
  client_first_name?: string;
  client_last_name?: string;
  client_whatsapp?: string;
  car_model?: string;
  assigned_mechanic_id?: string | null;
  status?: OrderStatus;
  notes?: string | null;
}

export interface CreateMechanicPayload {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface UpdateMechanicPayload {
  full_name?: string;
  phone?: string | null;
  active?: boolean;
  email?: string;
  password?: string;
}

export interface UpdateStagePayload {
  status?: StageStatus;
  name?: string;
  description?: string | null;
}

export interface CreateStagePayload {
  name: string;
  position?: number;
}
