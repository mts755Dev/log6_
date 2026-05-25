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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { quoteId, depositAmount, shareToken } = await req.json()

    if (!quoteId || typeof depositAmount !== 'number' || depositAmount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: quoteId, depositAmount (must be a positive number)' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get quote details
    const quoteQuery = supabaseAdmin
      .from('quotes')
      .select('id, reference, deposit, total, company_id, customer')
      .eq('id', quoteId);

    if (shareToken) {
      quoteQuery.eq('share_token', shareToken);
    }

    const { data: quote, error: quoteError } = await quoteQuery.single()

    if (quoteError || !quote) {
      return new Response(JSON.stringify({ error: 'Quote not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate deposit amount matches quote
    if (Math.abs(depositAmount - quote.deposit) > 0.01) {
      return new Response(
        JSON.stringify({ error: 'Deposit amount mismatch.' }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Extract customer info from quote
    const customerEmail = quote.customer.email
    const customerName = quote.customer.name

    // Get company details
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id, name, email, stripe_customer_id')
      .eq('id', quote.company_id)
      .single()

    if (companyError || !company) {
      return new Response(JSON.stringify({ error: 'Company not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create or get Stripe customer for the end customer (not the installer)
    // We'll search by email first
    const existingCustomers = await stripe.customers.list({
      email: customerEmail,
      limit: 1,
    })

    let customerId: string
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id
    } else {
      const customer = await stripe.customers.create({
        email: customerEmail,
        name: customerName,
        metadata: {
          quote_id: quote.id,
          quote_reference: quote.reference,
          company_id: company.id,
        },
      })
      customerId = customer.id
    }

    // Calculate deposit amount in pence
    const depositAmountInPence = Math.round(depositAmount * 100)

    // Create a PaymentIntent for the deposit
    const paymentIntent = await stripe.paymentIntents.create({
      amount: depositAmountInPence,
      currency: 'gbp',
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
      description: `Deposit for Quote ${quote.reference}`,
      metadata: {
        quote_id: quote.id,
        quote_reference: quote.reference,
        company_id: company.id,
        company_name: company.name,
        type: 'quote_deposit',
        deposit_amount: quote.deposit,
        total_amount: quote.total,
        customer_email: customerEmail,
        customer_name: customerName,
      },
    })

    // Create pending payment transaction record
    await supabaseAdmin.from('payment_transactions').insert({
      company_id: company.id,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_customer_id: customerId,
      type: 'quote_deposit',
      status: 'pending',
      amount: quote.deposit,
      currency: 'gbp',
      metadata: {
        quote_id: quote.id,
        quote_reference: quote.reference,
        customer_email: customerEmail,
        customer_name: customerName,
        deposit_amount: quote.deposit,
        total_amount: quote.total,
      },
    })

    return new Response(
      JSON.stringify({ 
        clientSecret: paymentIntent.client_secret,
        amount: quote.deposit,
        currency: 'gbp',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error creating payment intent:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
      },
    )
  }
})
