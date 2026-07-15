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
      documentsLink,
      jobLink,
      quoteReference,
      customerName,
      customerAddress,
      scheduledDate,
      scheduledTime,
      companyName,
    } = await req.json();

    const scheduleLine =
      scheduledDate && scheduledTime
        ? `${scheduledDate} at ${scheduledTime}`
        : scheduledDate || "See portal for details";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${companyName || "heliOS"} <onboarding@resend.dev>`,
        to: [to],
        subject: subject,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New installation assignment</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              <div style="background: linear-gradient(135deg, #0c8cf1 0%, #0a6bb8 100%); padding: 40px 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">New Job Assigned</h1>
              </div>

              <div style="padding: 40px 20px;">
                <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                  Hi ${recipientName},
                </p>

                <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                  You've been assigned an installation. The customer proposal pack for this quote is now available in your portal.
                </p>

                <div style="background-color: #f9fafb; border-left: 4px solid #0c8cf1; padding: 20px; margin: 30px 0;">
                  <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Quote Reference</p>
                  <p style="margin: 0 0 16px 0; color: #111827; font-size: 18px; font-weight: bold;">${quoteReference}</p>

                  <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Customer</p>
                  <p style="margin: 0 0 16px 0; color: #111827; font-size: 16px; font-weight: bold;">${customerName || "—"}</p>

                  <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Address</p>
                  <p style="margin: 0 0 16px 0; color: #111827; font-size: 16px;">${customerAddress || "—"}</p>

                  <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Scheduled</p>
                  <p style="margin: 0; color: #111827; font-size: 16px; font-weight: bold;">${scheduleLine}</p>
                </div>

                <div style="text-align: center; margin: 40px 0;">
                  <a href="${documentsLink}"
                     style="display: inline-block; background: linear-gradient(135deg, #0c8cf1 0%, #0a6bb8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold;">
                    Open Proposal Pack
                  </a>
                </div>

                ${
                  jobLink
                    ? `<p style="font-size: 14px; color: #6b7280; line-height: 1.6; text-align: center;">
                  Job details: <a href="${jobLink}" style="color: #0c8cf1; word-break: break-all;">${jobLink}</a>
                </p>`
                    : ""
                }

                <p style="font-size: 14px; color: #6b7280; line-height: 1.6; text-align: center;">
                  Or copy this link:<br>
                  <a href="${documentsLink}" style="color: #0c8cf1; word-break: break-all;">${documentsLink}</a>
                </p>
              </div>

              <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #9ca3af; font-size: 12px;">
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
