@echo off
REM Stripe Connect Deployment Script for Windows
REM This script deploys all Stripe Connect related edge functions

echo.
echo 🚀 Deploying Stripe Connect Edge Functions...
echo.

REM Deploy create-stripe-connect-account function
echo 📦 Deploying create-stripe-connect-account...
call supabase functions deploy create-stripe-connect-account

REM Deploy check-stripe-connect-status function
echo 📦 Deploying check-stripe-connect-status...
call supabase functions deploy check-stripe-connect-status

REM Deploy create-stripe-connect-dashboard-link function
echo 📦 Deploying create-stripe-connect-dashboard-link...
call supabase functions deploy create-stripe-connect-dashboard-link

REM Deploy create-customer-payment-intent function
echo 📦 Deploying create-customer-payment-intent...
call supabase functions deploy create-customer-payment-intent

echo.
echo ✅ All Stripe Connect functions deployed successfully!
echo.
echo 🔧 Next steps:
echo 1. Run the migration: supabase/migrations/20260212000001_stripe_connect.sql
echo 2. Set environment variables in Supabase Dashboard:
echo    - STRIPE_SECRET_KEY
echo    - FRONTEND_URL
echo 3. Test the integration with Stripe test mode
echo.

pause
