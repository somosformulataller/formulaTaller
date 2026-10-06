// ============================================================================
// TypeScript types derived from the Supabase schema.
// Keep in sync with supabase/migrations/0001_init.sql
// ============================================================================

export type UserRole = 'admin' | 'mechanic';
export type OrderStatus = 'sin_mecanico' | 'con_mecanico' | 'lista';
export type StageStatus = 'pending' | 'in_progress' | 'done';

export interface Workshop {
  id: string;
  name: string;
  slug: string;
  whatsapp: string | null;
  logo_url: string | null;
  // Override del límite gratuito para este taller; null = usar el global.
  order_limit: number | null;
  is_subscribed: boolean;
  // Taller de prueba (QA/demo): se excluye del conteo total en el panel de superadmin.
  is_test: boolean;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

// Fila del panel de superadmin: taller + métricas derivadas.
export interface WorkshopAdminRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  is_subscribed: boolean;
  is_test: boolean;
  // Override por taller (null = usa el límite global del plan gratuito).
  order_limit: number | null;
  /** Saldo prepagado (0025). */
  balance_usd: number;
  owner_name: string | null;
  owner_email: string | null;
  whatsapp: string | null;
  order_count: number;
  // ---- Ficha de registro (lo que el taller puso al darse de alta, más lo que
  // la cuenta cuenta de sí misma). El superadmin la abre desde cada tarjeta.
  /** Teléfono guardado en el perfil del dueño; al registrarse es el mismo WhatsApp. */
  owner_phone: string | null;
  /** Cuándo se creó la cuenta del dueño y cuándo entró por última vez. */
  owner_created_at: string | null;
  owner_last_sign_in_at: string | null;
  /** null = el correo nunca se confirmó. */
  owner_email_confirmed_at: string | null;
  /** Cuánta gente tiene dentro: el dueño cuenta aparte de los mecánicos. */
  mechanic_count: number;
  /** Si subió logo, señal de que se tomó en serio la configuración. */
  has_logo: boolean;
}

// ---- CRM de ventas (panel superadmin) --------------------------------------

export type CrmTagColor = 'neutral' | 'gold' | 'green' | 'red' | 'blue';

// Etiqueta reutilizable del catálogo (crm_tags).
export interface CrmTag {
  id: string;
  label: string;
  color: CrmTagColor;
  sort: number;
  created_at: string;
}

// Fila de la pestaña "Ventas": taller como cliente de Formula Taller.
export interface SalesClientRow {
  id: string;
  name: string;
  owner_name: string | null;
  whatsapp: string | null;
  created_at: string;
  order_count: number;
  is_subscribed: boolean;
  is_test: boolean;
  tutorial_sent_at: string | null;
  tag_ids: string[];
}

export type WorkshopUpdate = Partial<Pick<Workshop, 'name' | 'whatsapp'>>;

export interface Profile {
  id: string;
  workshop_id: string;
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
  workshop_id: string;
  public_token: string;
  client_first_name: string;
  client_last_name: string;
  client_whatsapp: string;
  car_model: string;
  /**
   * ESPEJO, no la verdad. Desde la 0021 la asignación vive en la tabla
   * `order_mechanics` (varios mecánicos por orden) y esta columna la mantiene
   * al día un trigger con el primero de la lista. Se lee; no se escribe.
   * Para saber quién trabaja el carro, usa `mechanics`.
   */
  assigned_mechanic_id: string | null;
  /**
   * true = en el seguimiento del CLIENTE, donde irían los nombres de los
   * mecánicos se enseña el nombre del taller (migración 0020).
   */
  show_workshop_as_mechanic: boolean;
  status: OrderStatus;
  notes: string | null;
  /** Cliente del taller (0023); lo pone un trigger a partir del WhatsApp. */
  client_id: string | null;
  /** Condiciones previas marcadas al recibir el carro (copia del texto). */
  vehicle_conditions: VehicleCondition[];
  mileage: number | null;
  fuel_level: FuelLevel | null;
  /** Condiciones previas dictadas por voz y redactadas (0024). */
  vehicle_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  assigned_mechanic?: Profile | null;
  /** Todos los mecánicos asignados, sin jerarquía (tabla order_mechanics, 0021). */
  mechanics?: Profile[];
  stages?: OrderStage[];
  workshop?: { name: string; logo_url?: string | null } | null;
}

export type OrderInsert = Omit<Order, 'id' | 'client_id' | 'vehicle_conditions' | 'mileage' | 'fuel_level' | 'vehicle_notes' | 'public_token' | 'created_at' | 'updated_at' | 'assigned_mechanic' | 'mechanics' | 'stages' | 'workshop'>;
export type OrderUpdate = Partial<Omit<Order, 'id' | 'public_token' | 'created_at' | 'updated_at' | 'assigned_mechanic' | 'mechanics' | 'stages' | 'workshop'>>;

/**
 * Una fila de `order_mechanics`: «esta persona trabaja este carro». Varias por
 * orden, todas iguales (migración 0021).
 */
export interface OrderMechanic {
  order_id: string;
  mechanic_id: string;
  created_at: string;
}

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

// ---- Presupuesto de la orden ----------------------------------------------

// Un renglón del presupuesto: qué se cobra y cuánto, en dólares.
// `amount` llega de Postgres como number (numeric); el total nunca se guarda,
// se suma siempre desde estos ítems (ver migración 0018).
export type BudgetDecision = 'pendiente' | 'aprobado' | 'rechazado';

export interface BudgetItem {
  id: string;
  order_id: string;
  description: string;
  /** Costo del repuesto o servicio (USD). */
  amount: number;
  /** Costo de la mano de obra (USD), migración 0023. */
  labor_amount: number;
  /** Lo que decidió el cliente desde su enlace de seguimiento. */
  client_decision: BudgetDecision;
  decided_at: string | null;
  /** El taller cambió el monto después de que el cliente decidiera. */
  revised_at: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Fila de la pantalla "Presupuestos": una orden con su total ya sumado.
export interface BudgetSummary {
  order_id: string;
  client_name: string;
  car_model: string;
  status: OrderStatus;
  created_at: string;
  item_count: number;
  total: number;
  parts_total: number;
  labor_total: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
}

// ---- Condiciones previas del vehículo (0023) -------------------------------

export type FuelLevel = 'reserva' | '1/4' | '1/2' | '3/4' | 'lleno';

/** Un ítem marcado en la orden: copia del texto, no referencia. */
export interface VehicleCondition {
  group: string;
  label: string;
  note?: string;
}

// ---- Clientes y recordatorios (0023) ---------------------------------------

export interface Client {
  id: string;
  workshop_id: string;
  first_name: string;
  last_name: string;
  whatsapp: string;
  notes: string | null;
  created_at: string;
}

export interface ClientRow extends Client {
  order_count: number;
  last_order_at: string | null;
  last_car_model: string | null;
  pending_reminders: number;
}

export type ReminderTagColor = 'neutral' | 'gold' | 'green' | 'red' | 'blue';

export interface ReminderTag {
  id: string;
  /** null = etiqueta de la plataforma, igual para todos los talleres. */
  workshop_id: string | null;
  label: string;
  color: ReminderTagColor;
  sort: number;
  active: boolean;
}

export type NotifyOffset = 'mismo_dia' | '3_dias' | '7_dias' | '1_mes';
export type ReminderStatus = 'pendiente' | 'enviado' | 'hecho';

export interface Reminder {
  id: string;
  workshop_id: string;
  client_id: string;
  order_id: string | null;
  title: string;
  body: string | null;
  audio_path: string | null;
  transcript: string | null;
  image_path: string | null;
  tag_id: string | null;
  due_date: string;
  notify_offset: NotifyOffset;
  notify_on: string;
  status: ReminderStatus;
  sent_at: string | null;
  created_at: string;
  // Resueltos por la API
  audio_url?: string | null;
  image_url?: string | null;
  client?: Pick<Client, 'id' | 'first_name' | 'last_name' | 'whatsapp'> | null;
  tag?: Pick<ReminderTag, 'id' | 'label' | 'color'> | null;
}

export interface AppNotification {
  id: string;
  order_id: string | null;
  kind: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export type OrderStageInsert = Omit<OrderStage, 'id' | 'created_at'>;
export type OrderStageUpdate = Partial<Omit<OrderStage, 'id' | 'order_id' | 'created_at'>>;

// ============================================================================
// Supabase Database type (used by createClient / createServerClient)
// ============================================================================
export type Database = {
  public: {
    Tables: {
      workshops: {
        Row: Workshop;
        Insert: Omit<Workshop, 'id' | 'created_at' | 'updated_at'>;
        Update: WorkshopUpdate;
        Relationships: [];
      };
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
      order_mechanics: {
        Row: OrderMechanic;
        Insert: Omit<OrderMechanic, 'created_at'>;
        Update: never;
        Relationships: [];
      };
      order_stages: {
        Row: OrderStage;
        Insert: OrderStageInsert;
        Update: OrderStageUpdate;
        Relationships: [];
      };
      stage_attachments: {
        Row: StageAttachment;
        Insert: Omit<StageAttachment, 'id' | 'created_at'>;
        Update: Partial<Omit<StageAttachment, 'id' | 'created_at'>>;
        Relationships: [];
      };
      order_budget_items: {
        Row: BudgetItem;
        Insert: Omit<BudgetItem, 'id' | 'created_at' | 'updated_at' | 'client_decision' | 'decided_at' | 'revised_at'>;
        Update: Partial<Omit<BudgetItem, 'id' | 'order_id' | 'created_at' | 'updated_at'>>;
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
  /** Los mecánicos asignados. Lista vacía = sin asignar (0021). */
  mechanic_ids?: string[];
  show_workshop_as_mechanic?: boolean;
  notes?: string | null;
  vehicle_conditions?: VehicleCondition[];
  mileage?: number | null;
  fuel_level?: FuelLevel | null;
  vehicle_notes?: string | null;
}

export interface UpdateOrderPayload {
  client_first_name?: string;
  client_last_name?: string;
  client_whatsapp?: string;
  car_model?: string;
  /** Reemplaza la lista completa de mecánicos asignados (0021). */
  mechanic_ids?: string[];
  show_workshop_as_mechanic?: boolean;
  status?: OrderStatus;
  notes?: string | null;
  vehicle_conditions?: VehicleCondition[];
  mileage?: number | null;
  fuel_level?: FuelLevel | null;
  vehicle_notes?: string | null;
}

export interface RegisterWorkshopPayload {
  workshop_name: string;
  email: string;
  whatsapp: string;
  first_name: string;
  last_name: string;
  password: string;
  password_confirm: string;
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

export interface CreateBudgetItemPayload {
  description: string;
  amount: number;
  labor_amount?: number;
}

export interface UpdateBudgetItemPayload {
  description?: string;
  amount?: number;
  labor_amount?: number;
}
