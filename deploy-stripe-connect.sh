#!/bin/bash

# Stripe Connect Deployment Script
# This script deploys all Stripe Connect related edge functions

echo "🚀 Deploying Stripe Connect Edge Functions..."
echo ""

# Deploy create-stripe-connect-account function
echo "📦 Deploying create-stripe-connect-account..."
supabase functions deploy create-stripe-connect-account

# Deploy check-stripe-connect-status function
echo "📦 Deploying check-stripe-connect-status..."
supabase functions deploy check-stripe-connect-status

# Deploy create-stripe-connect-dashboard-link function
echo "📦 Deploying create-stripe-connect-dashboard-link..."
supabase functions deploy create-stripe-connect-dashboard-link

# Deploy create-customer-payment-intent function
echo "📦 Deploying create-customer-payment-intent..."
supabase functions deploy create-customer-payment-intent

echo ""
echo "✅ All Stripe Connect functions deployed successfully!"
echo ""
echo "🔧 Next steps:"
echo "1. Run the migration: supabase/migrations/20260212000001_stripe_connect.sql"
echo "2. Set environment variables in Supabase Dashboard:"
echo "   - STRIPE_SECRET_KEY"
echo "   - FRONTEND_URL"
echo "3. Test the integration with Stripe test mode"
echo ""
