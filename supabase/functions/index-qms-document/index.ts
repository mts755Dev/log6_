import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { indexDocumentToPinecone, qmsNamespace } from '../_shared/documentIndexing.ts';
import { corsHeaders, jsonResponse } from '../_shared/assistant.ts';

interface IndexPayload {
  onboardingDocId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing authorization token' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', authData.user.id)
      .single();

    const payload = (await req.json().catch(() => ({}))) as IndexPayload;
    if (!payload.onboardingDocId) {
      return jsonResponse({ error: 'onboardingDocId is required' }, 400);
    }

    const { data: doc, error: docError } = await supabase
      .from('installer_onboarding_docs')
      .select('id, company_id, document_type, file_name, file_url, mime_type, status')
      .eq('id', payload.onboardingDocId)
      .single();

    if (docError || !doc) {
      return jsonResponse({ error: 'Onboarding document not found' }, 404);
    }

    const isAdmin = profile?.role === 'admin';
    if (!isAdmin && profile?.company_id !== doc.company_id) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    if (!Deno.env.get('PINECONE_API_KEY') || !Deno.env.get('PINECONE_HOST')) {
      return jsonResponse({ error: 'Pinecone not configured' }, 400);
    }

    const namespace = qmsNamespace(doc.company_id);

    const result = await indexDocumentToPinecone({
      documentId: doc.id,
      namespace,
      fileUrl: doc.file_url,
      mimeType: doc.mime_type,
      name: doc.file_name,
      description: doc.document_type,
      extraMetadata: {
        company_id: doc.company_id,
        document_type: doc.document_type,
        source_type: 'qms',
      },
    });

    await supabase.from('document_index_status').upsert(
      {
        document_id: doc.id,
        company_id: doc.company_id,
        pinecone_namespace: namespace,
        vector_count: result.vectorCount,
        status: 'indexed',
        source_type: 'qms',
        error_message: null,
        last_indexed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'document_id' }
    );

    return jsonResponse({
      success: true,
      onboardingDocId: doc.id,
      namespace,
      vectorCount: result.vectorCount,
      message: `Indexed QMS document (${result.vectorCount} chunks).`,
    });
  } catch (error: any) {
    console.error('index-qms-document error:', error);
    return jsonResponse({ error: error?.message || 'QMS indexing failed' }, 400);
  }
});
