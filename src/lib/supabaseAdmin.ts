import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('⚠️ Supabase admin credentials not found. Admin operations will not work.');
}

/**
 * ⚠️ WARNING: This admin client should ONLY be used in secure contexts!
 * 
 * For production:
 * - Move this to a backend API/Supabase Edge Function
 * - Never expose service role key in frontend
 * 
 * For development:
 * - Only use for admin operations (create/delete users)
 * - Service role key bypasses RLS policies
 */
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceRoleKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);