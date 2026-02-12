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
```

## Available Functions

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
