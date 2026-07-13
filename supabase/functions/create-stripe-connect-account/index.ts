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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      companyId, 
      businessType = 'company',
      country = 'GB',
      email,
      phone,
      businessName,
      address,
      postcode
    } = await req.json()
    
    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace('Bearer ', '')

    // Get user info from JWT
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found or invalid JWT.' }), 
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get company details
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: 'Company not found.' }), 
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if company already has a Stripe Connect account
    if (company.stripe_connect_account_id) {
      // Check account status
      const account = await stripe.accounts.retrieve(company.stripe_connect_account_id)
      
      return new Response(
        JSON.stringify({ 
          accountId: account.id,
          accountExists: true,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Create Stripe Connect account
    const account = await stripe.accounts.create({
      type: 'express', // Use Express for easier onboarding
      country: country,
      email: email || company.email,
      business_type: businessType,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: businessName || company.name,
        support_phone: phone || company.phone,
        support_email: email || company.email,
      },
      metadata: {
        company_id: companyId,
        user_id: user.id,
      },
    })

    // Save account ID to database
    await supabaseAdmin
      .from('companies')
      .update({ 
        stripe_connect_account_id: account.id,
        stripe_connect_details_submitted: false,
        stripe_connect_onboarding_complete: false,
        stripe_connect_account_status: 'pending',
      })
      .eq('id', companyId)

    // Create account link for onboarding
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${frontendUrl}/installer/settings?tab=payments&refresh=true`,
      return_url: `${frontendUrl}/installer/settings?tab=payments&success=true`,
      type: 'account_onboarding',
    })

    return new Response(
      JSON.stringify({
        accountId: account.id,
        onboardingUrl: accountLink.url,
        accountExists: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error: any) {
    console.error('Error creating Stripe Connect account:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create Stripe Connect account' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
