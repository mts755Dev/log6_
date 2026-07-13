import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { indexDocumentToPinecone } from '../_shared/documentIndexing.ts';
import { corsHeaders, jsonResponse } from '../_shared/assistant.ts';

interface IndexPayload {
  documentId?: string;
  namespace?: string;
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
      .select('role')
      .eq('id', authData.user.id)
      .single();

    if (profile?.role !== 'admin') {
      return jsonResponse({ error: 'Admin only' }, 403);
    }

    const payload = (await req.json().catch(() => ({}))) as IndexPayload;
    if (!payload.documentId) {
      return jsonResponse({ error: 'documentId is required' }, 400);
    }

    const namespace = payload.namespace ?? 'compliance';

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, name, file_url, category, description, mime_type, consumer_code, updated_at')
      .eq('id', payload.documentId)
      .single();

    if (docError || !document) {
      return jsonResponse({ error: 'Document not found' }, 404);
    }

    const pineconeConfigured = Boolean(Deno.env.get('PINECONE_API_KEY') && Deno.env.get('PINECONE_HOST'));
    if (!pineconeConfigured) {
      await upsertStatus(supabase, document.id, namespace, 0, 'pending', 'PINECONE not configured', null, 'document_bank');
      return jsonResponse({
        success: false,
        documentId: document.id,
        namespace,
        status: 'pending',
        message: 'Configure PINECONE_API_KEY, PINECONE_HOST, and LLM_API_KEY.',
      });
    }

    await upsertStatus(supabase, document.id, namespace, 0, 'pending', null, null, 'document_bank');

    const result = await indexDocumentToPinecone({
      documentId: document.id,
      namespace,
      fileUrl: document.file_url,
      mimeType: document.mime_type,
      name: document.name,
      description: document.description,
      extraMetadata: {
        category: document.category,
        consumer_code: document.consumer_code ?? '',
        source_type: 'document_bank',
      },
    });

    await upsertStatus(
      supabase,
      document.id,
      namespace,
      result.vectorCount,
      'indexed',
      null,
      new Date().toISOString(),
      'document_bank'
    );

    return jsonResponse({
      success: true,
      documentId: document.id,
      namespace,
      status: 'indexed',
      vectorCount: result.vectorCount,
      message: `Indexed ${result.vectorCount} chunks into Pinecone.`,
    });
  } catch (error: any) {
    console.error('index-document error:', error);
    return jsonResponse({ error: error?.message || 'Indexing failed' }, 400);
  }
});

async function upsertStatus(
  supabase: ReturnType<typeof createClient>,
  documentId: string,
  namespace: string,
  vectorCount: number,
  status: string,
  errorMessage: string | null,
  lastIndexedAt: string | null,
  sourceType: string
) {
  await supabase.from('document_index_status').upsert(
    {
      document_id: documentId,
      pinecone_namespace: namespace,
      vector_count: vectorCount,
      status,
      error_message: errorMessage,
      last_indexed_at: lastIndexedAt,
      source_type: sourceType,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'document_id' }
  );
}
