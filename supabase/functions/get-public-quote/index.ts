// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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

    const { quoteId, token } = await req.json();
    if (!quoteId || !token) {
      return new Response(
        JSON.stringify({ error: 'quoteId and token are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('share_token', token)
      .single();

    if (quoteError || !quote) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired quote link' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', quote.company_id)
      .single();

    const { data: quoteDocuments } = await supabase
      .from('quote_documents')
      .select(`
        *,
        document:documents(*)
      `)
      .eq('quote_id', quoteId);

    if (!quote.viewed_at && (quote.status === 'draft' || quote.status === 'sent')) {
      const updates: Record<string, string> = {
        status: 'viewed',
        viewed_at: new Date().toISOString(),
      };

      if (quote.status === 'draft' && !quote.sent_at) {
        updates.sent_at = new Date().toISOString();
      }

      await supabase
        .from('quotes')
        .update(updates)
        .eq('id', quoteId)
        .eq('share_token', token);

      quote.status = 'viewed';
      quote.viewed_at = updates.viewed_at;
      if (updates.sent_at) {
        quote.sent_at = updates.sent_at;
      }
    }

    return new Response(
      JSON.stringify({
        quote,
        company: company ?? null,
        documents: (quoteDocuments ?? []).map((qd: any) => qd.document).filter(Boolean),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('get-public-quote error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to fetch quote' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
