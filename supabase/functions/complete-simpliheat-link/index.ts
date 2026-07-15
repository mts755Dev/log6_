import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashLinkCode(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function completeSimpliHeatLinkForCompany(
  supabase: SupabaseClient,
  companyId: string,
  linkCode: string,
): Promise<{ linked: boolean; simpliheatUserId?: string; error?: string }> {
  const trimmed = linkCode.trim();
  if (!trimmed || !companyId) {
    return { linked: false, error: 'missing_params' };
  }

  const linkHash = await hashLinkCode(trimmed);
  const now = Date.now();

  const { data: simpliheatProfile, error: simpliheatError } = await supabase
    .from('profiles')
    .select('id')
    .eq('helios_link_code_hash', linkHash)
    .gt('helios_link_code_expires', now)
    .maybeSingle();

  if (simpliheatError) {
    return { linked: false, error: simpliheatError.message };
  }

  if (!simpliheatProfile?.id) {
    return { linked: false, error: 'invalid_or_expired_link' };
  }

  const simpliheatUserId = simpliheatProfile.id as string;

  const { data: companyRow, error: companyReadError } = await supabase
    .from('companies')
    .select('simpliheat_user_id')
    .eq('id', companyId)
    .maybeSingle();

  if (companyReadError) {
    return { linked: false, error: companyReadError.message };
  }

  if (companyRow?.simpliheat_user_id && companyRow.simpliheat_user_id !== simpliheatUserId) {
    return { linked: false, error: 'company_already_linked' };
  }

  const { error: companyUpdateError } = await supabase
    .from('companies')
    .update({ simpliheat_user_id: simpliheatUserId })
    .eq('id', companyId);

  if (companyUpdateError) {
    return { linked: false, error: companyUpdateError.message };
  }

  const tokenHash = await hashLinkCode(`shk_${crypto.randomUUID()}_${now}_${simpliheatUserId}`);

  const { error: simpliheatUpdateError } = await supabase
    .from('profiles')
    .update({
      company_id: companyId,
      helios_link_code_hash: null,
      helios_link_code_expires: null,
      helios_token_hash: tokenHash,
      helios_token_created: now,
    })
    .eq('id', simpliheatUserId);

  if (simpliheatUpdateError) {
    return { linked: false, error: simpliheatUpdateError.message };
  }

  return { linked: true, simpliheatUserId };
}

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing authorization token', linked: false }, 401);
    }

    const payload = await req.json().catch(() => ({}));
    const linkCode = String(payload.linkCode || '').trim();
    if (!linkCode) {
      return jsonResponse({ error: 'Missing link code', linked: false }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonResponse({ error: 'Unauthorized', linked: false }, 401);
    }

    const { data: installerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const role = installerProfile?.role;
    const companyId = installerProfile?.company_id;
    if (!role || !['installer', 'admin'].includes(role) || !companyId) {
      return jsonResponse({ error: 'installer_required', linked: false }, 403);
    }

    const result = await completeSimpliHeatLinkForCompany(supabase, companyId, linkCode);
    if (!result.linked) {
      return jsonResponse({ error: result.error || 'link_failed', linked: false }, 400);
    }

    return jsonResponse(
      {
        linked: true,
        simpliheatUserId: result.simpliheatUserId,
        companyId,
      },
      200,
    );
  } catch (error: unknown) {
    console.error('complete-simpliheat-link error:', error);
    const message = error instanceof Error ? error.message : 'Failed to complete SimpliHeat link';
    return jsonResponse({ error: message, linked: false }, 500);
  }
});
