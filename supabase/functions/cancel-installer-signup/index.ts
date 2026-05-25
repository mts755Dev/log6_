import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authData.user.id;
    const role = (authData.user.user_metadata?.role as string | undefined)?.toLowerCase();

    if (role !== 'installer') {
      return new Response(JSON.stringify({ error: 'Only pending installer signups can be cancelled' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .maybeSingle();

    const companyId = profile?.company_id;

    if (companyId) {
      await supabase.from('installer_onboarding_docs').delete().eq('company_id', companyId);
      await supabase.from('installer_settings').delete().eq('user_id', userId);
      await supabase.from('companies').delete().eq('id', companyId);
    } else {
      await supabase.from('installer_settings').delete().eq('user_id', userId);
    }

    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      throw deleteUserError;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('cancel-installer-signup error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Failed to cancel signup' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
