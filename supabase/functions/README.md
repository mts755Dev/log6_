# Supabase Edge Functions

This directory contains Supabase Edge Functions for the heliOS platform.

## Environment Variables

The following environment variables need to be set in your Supabase project:

### Email Configuration (Required for Engineer Creation)

1. **RESEND_API_KEY**
   - Description: API key for Resend email service
   - Get it from: https://resend.com/api-keys
   - Used by: `create-engineer` function to send welcome emails

2. **APP_URL**
   - Description: Your application URL
   - Development: `http://localhost:5173`
   - Production: `https://your-domain.com`
   - Used by: Email templates for login links

### Setting Environment Variables

#### Using Supabase CLI:

```bash
# Set RESEND_API_KEY
supabase secrets set RESEND_API_KEY=re_your_api_key_here

# Set APP_URL
supabase secrets set APP_URL=https://your-domain.com
```

#### Using Supabase Dashboard:

1. Go to your Supabase project
2. Navigate to Settings → Edge Functions → Secrets
3. Add the environment variables:
   - `RESEND_API_KEY`: Your Resend API key
   - `APP_URL`: Your application URL

## Deploying Functions

### Deploy all functions:
```bash
npx supabase functions deploy
```

### Deploy a specific function:
```bash
npx supabase functions deploy create-engineer
npx supabase functions deploy create-installer-account --no-verify-jwt
npx supabase functions deploy cancel-installer-signup
npx supabase functions deploy save-onboarding-document
npx supabase functions deploy create-company
npx supabase functions deploy get-public-invoice
npx supabase functions deploy get-job-pipeline
npx supabase functions deploy get-payment-history
npx supabase functions deploy get-public-quote
npx supabase functions deploy update-public-quote
```

## Available Functions

### create-company
Creates a company for a newly signed-up installer (or admin) and links it to the caller profile.

**Request Body:**
```json
{
  "name": "Your Company Ltd",
  "email": "owner@company.com",
  "phone": "+44 7700 900000",
  "mcsNumber": "MCS/12345",
  "address": "1 Main Street",
  "postcode": "SW1A 1AA",
  "brandColor": "#eab308",
  "consumerCode": "HIES"
}
```

**Features:**
- Requires authenticated installer/admin token
- Creates company with trial defaults
- Automatically links `profiles.company_id`
- Prevents direct client inserts on `companies`

### create-engineer
Creates a new engineer account and sends a welcome email with login credentials.

**Request Body:**
```json
{
  "email": "engineer@example.com",
  "password": "securepassword",
  "fullName": "John Smith",
  "phone": "+44 20 1234 5678",
  "companyId": "uuid-of-company"
}
```

**Features:**
- Creates user in Supabase Auth
- Creates profile in database
- Sends welcome email with credentials
- Auto-rollback if any step fails

### get-public-invoice
Fetches a customer-facing invoice by ID using service role access and marks it as viewed.

**Request Body:**
```json
{
  "invoiceId": "INV-123456"
}
```

**Features:**
- Works for anonymous customer invoice page
- Returns only invoices in `pending` or `paid` states
- Updates `viewed_at` on first read
- Lets `invoices` table stay protected by RLS

### get-job-pipeline
Returns job pipeline rows for dashboards with role-aware access checks.

**Request Body:**
```json
{
  "companyId": "optional-company-id"
}
```

**Features:**
- Requires authenticated user token
- Admin can see all companies (or filter by `companyId`)
- Non-admin users are restricted to their own `profiles.company_id`
- Replaces direct API reads from `job_pipeline` view

### get-payment-history
Returns payment history rows with role-aware access checks.

**Request Body:**
```json
{
  "companyId": "optional-company-id",
  "limit": 100
}
```

**Features:**
- Requires authenticated user token
- Admin can view all companies (or filter by `companyId`)
- Non-admin users are restricted to their own `profiles.company_id`
- Replaces direct API reads from `payment_history` view

### get-public-quote
Fetches a customer-facing quote by ID + share token and returns related company/documents.

**Request Body:**
```json
{
  "quoteId": "quote-abc123",
  "token": "secure-share-token"
}
```

**Features:**
- Works for anonymous customer quote page
- Validates quote link using `share_token`
- Marks quote as viewed when first opened
- Returns quote, company, and attached proposal documents

### update-public-quote
Applies controlled customer updates on shared quotes by ID + token.

**Request Body (examples):**
```json
{
  "quoteId": "quote-abc123",
  "token": "secure-share-token",
  "action": "save_availability",
  "payload": {
    "dates": ["2026-05-30"],
    "timeSlot": "morning",
    "notes": "..."
  }
}
```

```json
{
  "quoteId": "quote-abc123",
  "token": "secure-share-token",
  "action": "mark_deposit_paid",
  "payload": {
    "customerName": "Jane Doe",
    "customerSignature": "data:image/png;base64,...",
    "stripePaymentIntentId": "pi_123"
  }
}
```

**Features:**
- Works for anonymous customer acceptance flow
- Validates quote link using `share_token`
- Supports only safe action-based updates
- Lets `quotes` stay protected by authenticated-only RLS policies

## Email Templates

The `create-engineer` function sends a professional welcome email that includes:
- Login credentials (email and password)
- Direct login link
- Security reminder to change password
- Quick start guide
- Company branding

## Testing Locally

1. Start Supabase local development:
```bash
npx supabase start
```

2. Serve functions locally:
```bash
npx supabase functions serve
```

3. Test the function:
```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/create-engineer' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "email": "test@example.com",
    "password": "password123",
    "fullName": "Test Engineer",
    "companyId": "your-company-id"
  }'
```

## Notes

- Email sending is non-blocking - if it fails, the engineer is still created
- The function requires authentication (installer must be logged in)
- Engineers are automatically assigned to the installer's company
- Password must be at least 6 characters
