import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { indexDocumentToPinecone, qmsNamespace } from '../_shared/documentIndexing.ts';
import { corsHeaders, jsonResponse } from '../_shared/assistant.ts';

const STALE_DAYS = Number(Deno.env.get('AI_REINDEX_STALE_DAYS') ?? '7');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    const headerSecret = req.headers.get('x-cron-secret') ?? req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!cronSecret || headerSecret !== cronSecret) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    if (!Deno.env.get('PINECONE_API_KEY') || !Deno.env.get('PINECONE_HOST')) {
      return jsonResponse({ error: 'Pinecone not configured' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const results: { id: string; type: string; status: string; vectors?: number }[] = [];
    const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: documents } = await supabase
      .from('documents')
      .select('id, name, file_url, mime_type, description, category, consumer_code, updated_at');

    for (const doc of documents ?? []) {
      const { data: status } = await supabase
        .from('document_index_status')
        .select('last_indexed_at, status')
        .eq('document_id', doc.id)
        .maybeSingle();

      const needsReindex =
        !status ||
        status.status === 'failed' ||
        !status.last_indexed_at ||
        status.last_indexed_at < staleCutoff ||
        (doc.updated_at && status.last_indexed_at < doc.updated_at);

      if (!needsReindex) continue;

      try {
        const result = await indexDocumentToPinecone({
          documentId: doc.id,
          namespace: 'compliance',
          fileUrl: doc.file_url,
          mimeType: doc.mime_type,
          name: doc.name,
          description: doc.description,
          extraMetadata: { category: doc.category, consumer_code: doc.consumer_code, source_type: 'document_bank' },
        });

        await supabase.from('document_index_status').upsert(
          {
            document_id: doc.id,
            pinecone_namespace: 'compliance',
            vector_count: result.vectorCount,
            status: 'indexed',
            source_type: 'document_bank',
            last_indexed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'document_id' }
        );

        results.push({ id: doc.id, type: 'document_bank', status: 'indexed', vectors: result.vectorCount });
      } catch (err: any) {
        results.push({ id: doc.id, type: 'document_bank', status: `failed: ${err?.message}` });
      }
    }

    const { data: qmsDocs } = await supabase
      .from('installer_onboarding_docs')
      .select('id, company_id, document_type, file_name, file_url, mime_type, updated_at')
      .eq('status', 'approved');

    for (const doc of qmsDocs ?? []) {
      const { data: status } = await supabase
        .from('document_index_status')
        .select('last_indexed_at')
        .eq('document_id', doc.id)
        .maybeSingle();

      const needsReindex = !status?.last_indexed_at || status.last_indexed_at < staleCutoff;
      if (!needsReindex) continue;

      try {
        const namespace = qmsNamespace(doc.company_id);
        const result = await indexDocumentToPinecone({
          documentId: doc.id,
          namespace,
          fileUrl: doc.file_url,
          mimeType: doc.mime_type,
          name: doc.file_name,
          description: doc.document_type,
          extraMetadata: { company_id: doc.company_id, document_type: doc.document_type, source_type: 'qms' },
        });

        await supabase.from('document_index_status').upsert(
          {
            document_id: doc.id,
            company_id: doc.company_id,
            pinecone_namespace: namespace,
            vector_count: result.vectorCount,
            status: 'indexed',
            source_type: 'qms',
            last_indexed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'document_id' }
        );

        results.push({ id: doc.id, type: 'qms', status: 'indexed', vectors: result.vectorCount });
      } catch (err: any) {
        results.push({ id: doc.id, type: 'qms', status: `failed: ${err?.message}` });
      }
    }

    return jsonResponse({
      success: true,
      reindexed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('reindex-stale-documents error:', error);
    return jsonResponse({ error: error?.message || 'Reindex failed' }, 400);
  }
});
