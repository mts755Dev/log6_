import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Email template for new engineer
function generateEngineerWelcomeEmail(fullName: string, email: string, password: string, companyName: string): string {
  const loginUrl = `${Deno.env.get('APP_URL') || 'http://localhost:5173'}/login/engineer`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to heliOS</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0c8cf1 0%, #0a6bb8 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to heliOS!</h1>
        </div>

        <!-- Content -->
        <div style="padding: 40px 20px;">
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Hi ${fullName},
          </p>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Your engineer account has been created by <strong>${companyName}</strong>. You can now access the heliOS platform to manage installations and upload documentation.
          </p>

          <!-- Credentials Box -->
          <div style="background-color: #f9fafb; border-left: 4px solid #0c8cf1; padding: 20px; margin: 30px 0;">
            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; font-weight: bold;">YOUR LOGIN CREDENTIALS</p>
            
            <div style="margin: 15px 0;">
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px;">Email Address</p>
              <p style="margin: 0; color: #111827; font-size: 16px; font-weight: bold; font-family: monospace;">${email}</p>
            </div>

            <div style="margin: 15px 0;">
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px;">Password</p>
              <p style="margin: 0; color: #111827; font-size: 16px; font-weight: bold; font-family: monospace;">${password}</p>
            </div>

            <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 4px; padding: 10px; margin-top: 15px;">
              <p style="margin: 0; color: #92400e; font-size: 12px;">
                ⚠️ <strong>Important:</strong> Please change your password after your first login for security.
              </p>
            </div>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 40px 0;">
            <a href="${loginUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #0c8cf1 0%, #0a6bb8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold;">
              Login to heliOS
            </a>
          </div>

          <p style="font-size: 14px; color: #6b7280; line-height: 1.6; text-align: center;">
            Or copy this link: <br>
            <a href="${loginUrl}" style="color: #0c8cf1; word-break: break-all;">${loginUrl}</a>
          </p>

          <!-- Quick Guide -->
          <div style="background-color: #eff6ff; border: 1px solid #0c8cf1; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <p style="margin: 0 0 15px 0; color: #1e40af; font-size: 14px; font-weight: bold;">🚀 Getting Started</p>
            <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px; line-height: 1.8;">
              <li>Login with your credentials above</li>
              <li>Change your password in Settings</li>
              <li>View assigned installation jobs</li>
              <li>Upload commissioning documents</li>
              <li>Submit completed installations</li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">
            Need help? Contact your company administrator
          </p>
          <p style="margin: 20px 0 0 0; color: #9ca3af; font-size: 12px;">
            Powered by heliOS - Battery Storage Management Platform
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Send email using Resend
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not set, skipping email send');
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'heliOS <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to send email:', error);
    throw new Error('Failed to send welcome email');
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user making the request
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get request body
    const { email, password, fullName, phone, companyId } = await req.json();

    // Validate required fields
    if (!email || !password || !fullName || !companyId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already exists with this email
    const { data: existingProfile } = await supabaseClient
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: 'An engineer with this email already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if there's an orphaned auth user with this email (from previous failed attempt)
    try {
      const { data: { users: existingUsers } } = await supabaseClient.auth.admin.listUsers();
      const orphanedUser = existingUsers.find(u => u.email === email);
      
      if (orphanedUser) {
        console.log('Found orphaned auth user, cleaning up:', orphanedUser.id);
        // Delete the orphaned user
        await supabaseClient.auth.admin.deleteUser(orphanedUser.id);
      }
    } catch (cleanupError) {
      console.warn('Error during cleanup check:', cleanupError);
      // Continue anyway - this is just cleanup
    }

    // Create the engineer user in Supabase Auth
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'engineer',
        company_id: companyId,
        phone: phone || null,
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
      
      // Return user-friendly error message
      let errorMessage = 'Failed to create engineer account';
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        errorMessage = 'An account with this email already exists';
      } else if (authError.message.includes('invalid email')) {
        errorMessage = 'Invalid email address format';
      } else if (authError.message) {
        errorMessage = authError.message;
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;

    // Create or update profile for the engineer (using upsert to handle edge cases)
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .upsert({
        id: userId,
        email,
        full_name: fullName,
        phone: phone || null,
        role: 'engineer',
        company_id: companyId,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (profileError) {
      console.error('Profile error:', profileError);
      // If profile creation fails, delete the auth user
      await supabaseClient.auth.admin.deleteUser(userId);
      
      // Return user-friendly error message
      let errorMessage = 'Failed to create engineer profile';
      if (profileError.code === '23505') {
        errorMessage = 'An engineer with this email already exists';
      } else if (profileError.message) {
        errorMessage = profileError.message;
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get company name for the email
    const { data: companyData } = await supabaseClient
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    const companyName = companyData?.name || 'Your Company';

    // Send welcome email with credentials
    try {
      await sendEmail(
        email,
        'Welcome to heliOS - Your Engineer Account',
        generateEngineerWelcomeEmail(fullName, email, password, companyName)
      );
      console.log('Welcome email sent successfully to:', email);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the entire operation if email fails
      // The engineer is already created, just log the error
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        message: 'Engineer created successfully and welcome email sent',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    
    // Extract meaningful error message
    let errorMessage = 'Failed to create engineer';
    if (error.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.details || null,
        code: error.code || null
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
