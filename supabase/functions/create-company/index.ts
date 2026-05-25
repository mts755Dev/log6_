import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CreateCompanyPayload = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  mcsNumber?: string | null;
  address?: string | null;
  postcode?: string | null;
  brandColor?: string | null;
  consumerCode?: string | null;
  insuranceProvider?: 'QANW' | 'HICE' | 'REC' | null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = authData.user;
    const payload: CreateCompanyPayload = await req.json();
    const name = payload.name?.trim();

    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Company name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userRole = (user.user_metadata?.role as string | undefined)?.toLowerCase();
    if (userRole !== 'installer' && userRole !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only installers or admins can create companies' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingProfile, error: profileReadError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileReadError) {
      throw profileReadError;
    }

    if (existingProfile?.company_id) {
      return new Response(
        JSON.stringify({
          success: true,
          companyId: existingProfile.company_id,
          alreadyExists: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const { data: createdCompany, error: createCompanyError } = await supabase
      .from('companies')
      .insert({
        name,
        email: payload.email?.trim() || user.email || '',
        phone: payload.phone?.trim() || '',
        address: payload.address?.trim() || '',
        postcode: payload.postcode?.trim() || '',
        mcs_number: payload.mcsNumber?.trim() || null,
        is_umbrella_scheme: false,
        owner_id: user.id,
        insurance_provider: payload.insuranceProvider ?? null,
        payment_model: null,
        credit_balance: 5,
        credit_price: 3.0,
        subscription_tier: null,
        subscription_status: 'trial',
        subscription_end_date: trialEnd,
        monthly_proposal_limit: null,
        proposals_used_this_month: 0,
        proposal_reset_date: nextReset,
        logo: null,
        brand_color: payload.brandColor || '#eab308',
        consumer_code: payload.consumerCode || null,
      })
      .select('id')
      .single();

    if (createCompanyError || !createdCompany) {
      throw createCompanyError ?? new Error('Failed to create company');
    }

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        company_id: createdCompany.id,
        phone: payload.phone?.trim() || null,
      })
      .eq('id', user.id);

    if (profileUpdateError) {
      // Roll back company when profile link fails, to avoid orphan records.
      await supabase.from('companies').delete().eq('id', createdCompany.id);
      throw profileUpdateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        companyId: createdCompany.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('create-company error:', error);
    return new Response(
      JSON.stringify({
        error: error?.message || 'Failed to create company',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
