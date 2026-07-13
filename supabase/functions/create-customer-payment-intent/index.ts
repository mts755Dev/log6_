import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Platform fee - Set to 0 (no fee charged)
// If you want to charge a fee in the future, set this to a value like 0.025 (2.5%)
const PLATFORM_FEE_PERCENTAGE = 0

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      quoteId, 
      amount, 
      customerEmail, 
      customerName,
      description 
    } = await req.json()

    if (!quoteId || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: quoteId and amount' }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get quote and company details
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .select(`
        id,
        company_id,
        customer_name,
        customer_email,
        companies (
          id,
          name,
          email,
          stripe_connect_account_id,
          stripe_connect_charges_enabled
        )
      `)
      .eq('id', quoteId)
      .single()

    if (quoteError || !quote) {
      return new Response(
        JSON.stringify({ error: 'Quote not found.' }), 
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const company = quote.companies as any
    
    // Check if company has Stripe Connect set up
    if (!company.stripe_connect_account_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Company has not set up payment processing yet. Please contact the installer.' 
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!company.stripe_connect_charges_enabled) {
      return new Response(
        JSON.stringify({ 
          error: 'Company payment processing is not fully activated. Please contact the installer.' 
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const amountInPence = Math.round(amount * 100)

    // Create PaymentIntent options
    const paymentIntentOptions: any = {
      amount: amountInPence,
      currency: 'gbp',
      receipt_email: customerEmail || quote.customer_email,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        quote_id: quoteId,
        company_id: company.id,
        customer_name: customerName || quote.customer_name,
        customer_email: customerEmail || quote.customer_email,
        type: 'quote_payment',
      },
      description: description || `Payment for Quote #${quoteId.slice(0, 8)}`,
    }

    // Only add platform fee and transfer if fee is greater than 0
    if (PLATFORM_FEE_PERCENTAGE > 0) {
      const platformFee = Math.round(amountInPence * PLATFORM_FEE_PERCENTAGE)
      paymentIntentOptions.application_fee_amount = platformFee
      paymentIntentOptions.transfer_data = {
        destination: company.stripe_connect_account_id,
      }
    } else {
      // Direct charge to connected account (no platform fee)
      paymentIntentOptions.on_behalf_of = company.stripe_connect_account_id
      paymentIntentOptions.transfer_data = {
        destination: company.stripe_connect_account_id,
      }
    }

    // Create a PaymentIntent with Stripe Connect
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions)

    // Record the payment attempt
    await supabaseAdmin.from('payment_transactions').insert({
      company_id: company.id,
      user_id: null, // No user for customer payments
      stripe_payment_intent_id: paymentIntent.id,
      type: 'quote_payment',
      status: 'pending',
      amount: amount,
      currency: 'gbp',
      description: description || `Payment for Quote #${quoteId.slice(0, 8)}`,
      metadata: {
        quote_id: quoteId,
        customer_name: customerName || quote.customer_name,
        customer_email: customerEmail || quote.customer_email,
        platform_fee: 0,
      },
    })

    return new Response(
      JSON.stringify({ 
        clientSecret: paymentIntent.client_secret,
        platformFee: 0, // No platform fee
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error: any) {
    console.error('Error creating customer payment intent:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create payment intent' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
