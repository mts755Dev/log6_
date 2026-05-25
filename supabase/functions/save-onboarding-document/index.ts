import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SaveOnboardingDocumentPayload = {
  companyId?: string;
  userId?: string;
  documentType?: string;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  version?: number;
  issuedDate?: string | null;
  expiryDate?: string | null;
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const token = authHeader.replace('Bearer ', '');

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: SaveOnboardingDocumentPayload = await req.json();
    const companyId = payload.companyId?.trim();
    const userId = payload.userId?.trim();
    const documentType = payload.documentType?.trim();
    const fileName = payload.fileName?.trim();
    const filePath = payload.filePath?.trim();

    if (!companyId || !userId || !documentType || !fileName || !filePath) {
      return new Response(JSON.stringify({ error: 'Missing required document fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (authData.user.id !== userId) {
      return new Response(JSON.stringify({ error: 'Cannot save documents for another user' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: ownedCompany, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .eq('owner_id', userId)
      .maybeSingle();

    if (companyError || !ownedCompany) {
      return new Response(JSON.stringify({ error: 'Company not found for this installer account' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.company_id || profile.company_id !== companyId) {
      await supabaseAdmin
        .from('profiles')
        .update({ company_id: companyId })
        .eq('id', userId);
    }

    const { data: publicData } = supabaseAdmin.storage.from('documents').getPublicUrl(filePath);
    const publicUrl = publicData.publicUrl;

    const { error: insertError } = await supabaseAdmin.from('installer_onboarding_docs').insert({
      company_id: companyId,
      uploaded_by: userId,
      document_type: documentType,
      file_name: fileName,
      file_url: publicUrl,
      file_size: payload.fileSize ?? 0,
      mime_type: fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      version: payload.version ?? 1,
      issued_date: payload.issuedDate || null,
      expiry_date: payload.expiryDate || null,
      status: 'pending',
      is_current: true,
    });

    if (insertError) {
      console.error('save-onboarding-document insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('save-onboarding-document error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Failed to save document' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
