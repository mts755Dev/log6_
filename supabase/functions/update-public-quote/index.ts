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

    const { quoteId, token, action, payload } = await req.json();
    if (!quoteId || !token || !action) {
      return new Response(
        JSON.stringify({ error: 'quoteId, token and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, status, customer')
      .eq('id', quoteId)
      .eq('share_token', token)
      .single();

    if (quoteError || !quote) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired quote link' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'save_availability') {
      const { dates, timeSlot, notes } = payload || {};
      if (!Array.isArray(dates) || dates.length === 0 || !timeSlot) {
        return new Response(
          JSON.stringify({ error: 'dates and timeSlot are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('quotes')
        .update({
          customer_availability: {
            dates,
            timeSlot,
            notes: notes || '',
            submittedAt: new Date().toISOString(),
          },
        })
        .eq('id', quoteId)
        .eq('share_token', token);

      if (error) throw error;
    } else if (action === 'mark_deposit_paid') {
      if (quote.status === 'deposit_paid') {
        return new Response(
          JSON.stringify({ success: true, alreadyPaid: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { customerName, customerSignature, stripePaymentIntentId } = payload || {};
      if (!customerName || !stripePaymentIntentId) {
        return new Response(
          JSON.stringify({ error: 'customerName and stripePaymentIntentId are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updatePayload: Record<string, unknown> = {
        status: 'deposit_paid',
        deposit_paid: true,
        deposit_paid_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        stripe_payment_intent_id: stripePaymentIntentId,
        customer: {
          ...(quote.customer || {}),
          name: customerName,
        },
      };
      // Signature comes from the live proposal form when the customer already signed there.
      if (customerSignature) {
        updatePayload.customer_signature = customerSignature;
      }

      const { error } = await supabase
        .from('quotes')
        .update(updatePayload)
        .eq('id', quoteId)
        .eq('share_token', token);

      if (error) throw error;
    } else {
      return new Response(
        JSON.stringify({ error: 'Unsupported action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('update-public-quote error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to update quote' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
