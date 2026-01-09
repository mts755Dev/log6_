import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not found. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Database types for TypeScript
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          role: 'admin' | 'installer' | 'assessor';
          full_name: string | null;
          company_id: string | null;
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role: 'admin' | 'installer' | 'assessor';
          full_name?: string | null;
          company_id?: string | null;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: 'admin' | 'installer' | 'assessor';
          full_name?: string | null;
          company_id?: string | null;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      installer_documents: {
        Row: {
          id: string;
          user_id: string;
          document_type: 'competency_cards' | 'certificates' | 'insurance' | 'mcs_certificate' | 'consumer_code' | 'insurance_backed_guarantee' | 'waste_license';
          file_name: string;
          file_path: string;
          file_size: number;
          version: number;
          issued_date: string | null;
          expiry_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_type: 'competency_cards' | 'certificates' | 'insurance' | 'mcs_certificate' | 'consumer_code' | 'insurance_backed_guarantee' | 'waste_license';
          file_name: string;
          file_path: string;
          file_size: number;
          version?: number;
          issued_date?: string | null;
          expiry_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          document_type?: 'competency_cards' | 'certificates' | 'insurance' | 'mcs_certificate' | 'consumer_code' | 'insurance_backed_guarantee' | 'waste_license';
          file_name?: string;
          file_path?: string;
          file_size?: number;
          version?: number;
          issued_date?: string | null;
          expiry_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      installer_settings: {
        Row: {
          id: string;
          user_id: string;
          use_external_waste_carrier: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          use_external_waste_carrier: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          use_external_waste_carrier?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};