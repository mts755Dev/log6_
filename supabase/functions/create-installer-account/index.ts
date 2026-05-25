import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CreateInstallerAccountPayload = {
  email?: string;
  password?: string;
  fullName?: string;
  phone?: string | null;
  companyName?: string | null;
  consumerCode?: string | null;
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload: CreateInstallerAccountPayload = await req.json();
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password ?? '';
    const fullName = payload.fullName?.trim();
    const companyName = payload.companyName?.trim();

    if (!email || !password || !fullName) {
      return jsonResponse({ error: 'Email, password, and full name are required' }, 400);
    }

    if (!companyName) {
      return jsonResponse({ error: 'Company name is required' }, 400);
    }

    if (password.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      return jsonResponse({ error: 'An account with this email already exists' }, 400);
    }

    // Remove orphaned auth users from failed signup attempts (no profile row).
    try {
      const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const orphan = listData?.users?.find((u) => u.email?.toLowerCase() === email);
      if (orphan) {
        const { data: orphanProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', orphan.id)
          .maybeSingle();
        if (!orphanProfile) {
          await supabase.auth.admin.deleteUser(orphan.id);
        }
      }
    } catch (cleanupError) {
      console.warn('Orphan auth user cleanup skipped:', cleanupError);
    }

    // Admin createUser with email_confirm — does NOT send Supabase confirmation emails.
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'installer',
        phone: payload.phone?.trim() || null,
        company_name: companyName,
      },
    });

    if (authError || !authData?.user) {
      const message = authError?.message || 'Failed to create installer account';
      console.error('createUser failed:', message);
      return jsonResponse({ error: message }, 400);
    }

    const userId = authData.user.id;

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const { data: createdCompany, error: createCompanyError } = await supabase
      .from('companies')
      .insert({
        name: companyName,
        email,
        phone: payload.phone?.trim() || '',
        address: '',
        postcode: '',
        mcs_number: null,
        is_umbrella_scheme: false,
        owner_id: userId,
        insurance_provider: null,
        payment_model: null,
        credit_balance: 5,
        credit_price: 3.0,
        subscription_tier: 'starter',
        subscription_status: 'trial',
        subscription_end_date: trialEnd,
        monthly_proposal_limit: null,
        proposals_used_this_month: 0,
        proposal_reset_date: nextReset,
        logo: null,
        brand_color: '#eab308',
        consumer_code: payload.consumerCode?.trim() || null,
      })
      .select('id')
      .single();

    if (createCompanyError || !createdCompany) {
      await supabase.auth.admin.deleteUser(userId);
      throw createCompanyError ?? new Error('Failed to create company');
    }

    // Upsert profile (trigger may not have finished; update can affect 0 rows silently).
    const { error: profileUpsertError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        role: 'installer',
        company_id: createdCompany.id,
        phone: payload.phone?.trim() || null,
      },
      { onConflict: 'id' },
    );

    if (profileUpsertError) {
      await supabase.from('companies').delete().eq('id', createdCompany.id);
      await supabase.auth.admin.deleteUser(userId);
      throw profileUpsertError;
    }

    const { data: linkedProfile, error: profileVerifyError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .single();

    if (profileVerifyError || !linkedProfile?.company_id) {
      await supabase.from('companies').delete().eq('id', createdCompany.id);
      await supabase.auth.admin.deleteUser(userId);
      throw profileVerifyError ?? new Error('Failed to link company to installer profile');
    }

    // Issue a session without calling client signUp (avoids auth email rate limits).
    let session: { access_token: string; refresh_token: string } | null = null;
    if (anonKey) {
      const anonClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
        email,
        password,
      });
      if (!signInError && signInData.session) {
        session = {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        };
      } else {
        console.warn('Could not create session in edge function:', signInError?.message);
      }
    }

    return jsonResponse({
      success: true,
      userId,
      companyId: createdCompany.id,
      session,
    }, 200);
  } catch (error: any) {
    console.error('create-installer-account error:', error);
    return jsonResponse(
      { error: error?.message || 'Failed to create installer account' },
      400,
    );
  }
});
