// Follow this setup guide to integrate the Resend API:
// https://resend.com/docs/send-with-supabase-edge-functions

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const {
      to,
      recipientName,
      subject,
      shareLink,
      quoteReference,
      quoteTotal,
      annualSavings,
      companyName,
      companyEmail,
      companyPhone,
    } = await req.json();

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${companyName} <onboarding@resend.dev>`, // Replace with your verified domain
        to: [to],
        subject: subject,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Quote from ${companyName}</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              <div style="background: linear-gradient(135deg, #0c8cf1 0%, #0a6bb8 100%); padding: 40px 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Your Quote is Ready!</h1>
              </div>

              <div style="padding: 40px 20px;">
                <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                  Hi ${recipientName},
                </p>
                
                <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                  Thank you for your interest in battery storage. We've prepared a personalized proposal for you.
                </p>

                <div style="background-color: #f9fafb; border-left: 4px solid #0c8cf1; padding: 20px; margin: 30px 0;">
                  <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Quote Reference</p>
                  <p style="margin: 0 0 20px 0; color: #111827; font-size: 18px; font-weight: bold;">${quoteReference}</p>
                  
                  <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Total Investment</p>
                  <p style="margin: 0 0 20px 0; color: #111827; font-size: 32px; font-weight: bold;">£${quoteTotal.toLocaleString()}</p>
                  
                  <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Estimated Annual Savings</p>
                  <p style="margin: 0; color: #059669; font-size: 24px; font-weight: bold;">£${annualSavings.toLocaleString()}</p>
                </div>

                <div style="text-align: center; margin: 40px 0;">
                  <a href="${shareLink}" 
                     style="display: inline-block; background: linear-gradient(135deg, #0c8cf1 0%, #0a6bb8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold;">
                    View Your Quote
                  </a>
                </div>

                <p style="font-size: 14px; color: #6b7280; line-height: 1.6; text-align: center;">
                  Or copy this link: <br>
                  <a href="${shareLink}" style="color: #0c8cf1; word-break: break-all;">${shareLink}</a>
                </p>
              </div>

              <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">
                  Have questions? We're here to help!
                </p>
                <p style="margin: 0; color: #6b7280; font-size: 14px;">
                  📧 ${companyEmail} | 📞 ${companyPhone}
                </p>
                <p style="margin: 20px 0 0 0; color: #9ca3af; font-size: 12px;">
                  Powered by heliOS
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
