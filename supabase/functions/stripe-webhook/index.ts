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

serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  const body = await req.text()

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''
    )
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  console.log('Webhook event:', event.type)

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as any
        const { company_id, user_id, credits, type } = paymentIntent.metadata

        // Update transaction status
        await supabaseAdmin
          .from('payment_transactions')
          .update({ status: 'succeeded' })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        // If credit purchase, add credits to company and set payment model
        if (type === 'credit_purchase' && credits) {
          const { data: company } = await supabaseAdmin
            .from('companies')
            .select('credit_balance, payment_model, subscription_status')
            .eq('id', company_id)
            .single()

          if (company) {
            await supabaseAdmin
              .from('companies')
              .update({ 
                credit_balance: (company.credit_balance || 0) + parseInt(credits),
                payment_model: 'pay-as-you-go', // Set payment model after first purchase
                subscription_status: 'active', // Move from trial to active
              })
              .eq('id', company_id)
          }
        }

        console.log('Payment succeeded:', paymentIntent.id)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as any
        await supabaseAdmin
          .from('payment_transactions')
          .update({ status: 'failed' })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        console.log('Payment failed:', paymentIntent.id)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as any
        const { company_id, tier } = subscription.metadata

        // Update company subscription
        await supabaseAdmin
          .from('companies')
          .update({
            payment_model: 'subscription',
            subscription_tier: tier || 'starter',
            subscription_status: subscription.status === 'active' ? 'active' : 'trial',
            subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
            stripe_subscription_id: subscription.id,
          })
          .eq('id', company_id)

        console.log('Subscription updated:', subscription.id)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any
        const { company_id } = subscription.metadata

        // Cancel subscription
        await supabaseAdmin
          .from('companies')
          .update({
            subscription_status: 'cancelled',
          })
          .eq('id', company_id)

        console.log('Subscription cancelled:', subscription.id)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription)
        const { company_id, user_id, tier } = subscription.metadata

        // Create transaction record for subscription payment
        await supabaseAdmin.from('payment_transactions').insert({
          company_id,
          user_id,
          stripe_subscription_id: subscription.id,
          stripe_payment_intent_id: invoice.payment_intent,
          stripe_customer_id: invoice.customer,
          type: 'subscription',
          status: 'succeeded',
          amount: invoice.amount_paid / 100,
          currency: invoice.currency,
          subscription_tier: tier,
          subscription_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          description: `${tier} subscription payment`,
        })

        console.log('Invoice payment succeeded:', invoice.id)
        break
      }

      default:
        console.log('Unhandled event type:', event.type)
    }

    return new Response('ok', { status: 200 })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return new Response(`Webhook handler error: ${error.message}`, { status: 500 })
  }
})
