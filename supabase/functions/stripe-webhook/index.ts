import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response(JSON.stringify({ error: 'No signature' }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await req.text()
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    )

    console.log('Received Stripe webhook:', event.type)

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentSuccess(paymentIntent)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentFailure(paymentIntent)
        break
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentCanceled(paymentIntent)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('Webhook error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id)

  const metadata = paymentIntent.metadata
  const quoteId = metadata.quote_id
  const type = metadata.type

  // Update payment transaction status
  const { error: txError } = await supabaseAdmin
    .from('payment_transactions')
    .update({ 
      status: 'succeeded',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_payment_intent_id', paymentIntent.id)

  if (txError) {
    console.error('Error updating payment transaction:', txError)
  } else {
    console.log('Payment transaction updated to succeeded')
  }

  // If this is a quote deposit, update the quote
  if (type === 'quote_deposit' && quoteId) {
    const { error: quoteError } = await supabaseAdmin
      .from('quotes')
      .update({
        status: 'deposit_paid', // ✨ Update status for job tracking
        deposit_paid: true,
        deposit_paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntent.id,
      })
      .eq('id', quoteId)

    if (quoteError) {
      console.error('Error updating quote:', quoteError)
    } else {
      console.log('Quote deposit marked as paid, status updated to deposit_paid')
    }

    // Optionally: Send notification to installer
    // await sendInstallerNotification(quoteId, 'deposit_received')
  }

  // If this is a credit purchase, update company credits
  if (type === 'credit_purchase') {
    const companyId = metadata.company_id
    const credits = parseInt(metadata.credits || '0')

    if (companyId && credits > 0) {
      // Get current credit balance
      const { data: company, error: fetchError } = await supabaseAdmin
        .from('companies')
        .select('credit_balance')
        .eq('id', companyId)
        .single()

      if (fetchError) {
        console.error('Error fetching company:', fetchError)
      } else {
        const currentBalance = company.credit_balance || 0
        const newBalance = currentBalance + credits

        // Update credit balance
        const { error: updateError } = await supabaseAdmin
          .from('companies')
          .update({ 
            credit_balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('id', companyId)

        if (updateError) {
          console.error('Error updating company credits:', updateError)
        } else {
          console.log(`Added ${credits} credits to company ${companyId}. New balance: ${newBalance}`)
        }
      }
    }
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment failed:', paymentIntent.id)

  const { error } = await supabaseAdmin
    .from('payment_transactions')
    .update({ 
      status: 'failed',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_payment_intent_id', paymentIntent.id)

  if (error) {
    console.error('Error updating payment transaction:', error)
  }
}

async function handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment canceled:', paymentIntent.id)

  const { error } = await supabaseAdmin
    .from('payment_transactions')
    .update({ 
      status: 'canceled',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_payment_intent_id', paymentIntent.id)

  if (error) {
    console.error('Error updating payment transaction:', error)
  }
}
