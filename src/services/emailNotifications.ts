/**
 * Email Notification Service
 * 
 * This module provides email notification functionality.
 * Currently set up as a placeholder for future email integration.
 * 
 * Integration Options:
 * 1. Supabase Edge Functions with Resend/SendGrid
 * 2. Third-party services (Mailgun, Postmark, AWS SES)
 * 3. Custom SMTP server
 */

import type { Quote } from '../types';
import { supabase } from '../lib/supabase';

export interface EmailRecipient {
  email: string;
  name: string;
}

export interface QuoteEmailData {
  quote: Quote;
  recipient: EmailRecipient;
  shareLink: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
}

/** Opens the installer's default email app with a pre-filled quote message. */
export function openQuoteInEmailClient(data: QuoteEmailData): void {
  const subject = encodeURIComponent(
    `Your Quote from ${data.companyName} - ${data.quote.reference}`,
  );
  const body = encodeURIComponent(
    `Hi ${data.recipient.name},\n\n` +
      `Thank you for your interest in battery storage. We've prepared a personalized proposal for you.\n\n` +
      `Quote Reference: ${data.quote.reference}\n` +
      `Total Investment: £${data.quote.total.toLocaleString()}\n` +
      `Estimated Annual Savings: £${data.quote.annualSavings.toLocaleString()}\n\n` +
      `View your quote here:\n${data.shareLink}\n\n` +
      `Best regards,\n${data.companyName}`,
  );
  window.location.href = `mailto:${data.recipient.email}?subject=${subject}&body=${body}`;
}

/**
 * Send quote notification to customer
 * 
 * This function will send an email to the customer with a link to view their quote.
 * 
 * @param data - Quote and customer information
 * @returns Promise with success status
 */
export async function sendQuoteToCustomer(data: QuoteEmailData): Promise<{
  success: boolean;
  message: string;
  useEmailClientFallback?: boolean;
}> {
  try {
    console.log('📧 Attempting to send email to:', data.recipient.email);
    
    const { data: response, error } = await supabase.functions.invoke('send-quote-email', {
      body: {
        to: data.recipient.email,
        recipientName: data.recipient.name,
        subject: `Your Quote from ${data.companyName} - ${data.quote.reference}`,
        shareLink: data.shareLink,
        quoteReference: data.quote.reference,
        quoteTotal: data.quote.total,
        annualSavings: data.quote.annualSavings,
        companyName: data.companyName,
        companyEmail: data.companyEmail,
        companyPhone: data.companyPhone,
      },
    });

    if (error) {
      console.error('Supabase function error:', error);
      const isUnconfigured =
        error.message.includes('403') ||
        error.message.includes('404') ||
        error.message.includes('503') ||
        error.message.includes('non-2xx');
      return {
        success: false,
        useEmailClientFallback: isUnconfigured,
        message: isUnconfigured
          ? 'Automated email is not configured on the server.'
          : error.message || 'Failed to send email',
      };
    }

    return {
      success: true,
      message: 'Email sent successfully',
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      useEmailClientFallback: true,
      message: 'Automated email is not available.',
    };
  }
}

/**
 * Send quote acceptance notification to installer
 * 
 * Notifies the installer when a customer accepts a quote
 * 
 * @param data - Quote and installer information
 */
export async function sendQuoteAcceptedNotification(data: {
  quote: Quote;
  installerEmail: string;
  installerName: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    console.log('📧 Installer notification would be sent to:', data.installerEmail);
    console.log('✅ Quote accepted:', data.quote.reference);

    // TODO: Implement email notification to installer

    return {
      success: true,
      message: 'Installer notified of quote acceptance',
    };
  } catch (error) {
    console.error('Error sending installer notification:', error);
    return {
      success: false,
      message: 'Failed to notify installer',
    };
  }
}

/**
 * Send quote viewed notification to installer
 * 
 * Notifies the installer when a customer views their quote
 */
export async function sendQuoteViewedNotification(data: {
  quote: Quote;
  installerEmail: string;
  installerName: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    console.log('📧 Quote viewed notification would be sent to:', data.installerEmail);
    console.log('👁️ Quote viewed:', data.quote.reference);

    // TODO: Implement email notification

    return {
      success: true,
      message: 'Installer notified that quote was viewed',
    };
  } catch (error) {
    console.error('Error sending viewed notification:', error);
    return {
      success: false,
      message: 'Failed to notify installer',
    };
  }
}

/**
 * Send WhatsApp message (future integration)
 * 
 * This will use WhatsApp Business API or Twilio to send messages
 */
export async function sendWhatsAppNotification(data: {
  phone: string;
  message: string;
  link?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    console.log('📱 WhatsApp would be sent to:', data.phone);
    console.log('💬 Message:', data.message);
    if (data.link) console.log('🔗 Link:', data.link);

    // TODO: Implement WhatsApp integration via Twilio or WhatsApp Business API

    return {
      success: true,
      message: 'WhatsApp notification queued',
    };
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    return {
      success: false,
      message: 'Failed to send WhatsApp message',
    };
  }
}

/**
 * Generate email template for quote
 * 
 * Returns HTML email template
 */
export function generateQuoteEmailTemplate(data: QuoteEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Battery Storage Quote</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0c8cf1 0%, #0a6bb8 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Your Battery Storage Quote is Ready!</h1>
        </div>

        <!-- Content -->
        <div style="padding: 40px 20px;">
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Hi ${data.recipient.name},
          </p>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Thank you for your interest in battery storage. We've prepared a personalized proposal for you.
          </p>

          <!-- Quote Summary -->
          <div style="background-color: #f9fafb; border-left: 4px solid #0c8cf1; padding: 20px; margin: 30px 0;">
            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Quote Reference</p>
            <p style="margin: 0 0 20px 0; color: #111827; font-size: 18px; font-weight: bold;">${data.quote.reference}</p>
            
            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Total Investment</p>
            <p style="margin: 0 0 20px 0; color: #111827; font-size: 32px; font-weight: bold;">£${data.quote.total.toLocaleString()}</p>
            
            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Estimated Annual Savings</p>
            <p style="margin: 0; color: #059669; font-size: 24px; font-weight: bold;">£${data.quote.annualSavings.toLocaleString()}</p>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 40px 0;">
            <a href="${data.shareLink}" 
               style="display: inline-block; background: linear-gradient(135deg, #0c8cf1 0%, #0a6bb8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold;">
              View Your Quote
            </a>
          </div>

          <p style="font-size: 14px; color: #6b7280; line-height: 1.6; text-align: center;">
            Or copy this link: <br>
            <a href="${data.shareLink}" style="color: #0c8cf1; word-break: break-all;">${data.shareLink}</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">
            Have questions? We're here to help!
          </p>
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            📧 ${data.companyEmail} | 📞 ${data.companyPhone}
          </p>
          <p style="margin: 20px 0 0 0; color: #9ca3af; font-size: 12px;">
            Powered by heliOS
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Example usage:
 * 
 * const result = await sendQuoteToCustomer({
 *   quote: quote,
 *   recipient: {
 *     email: quote.customer.email,
 *     name: quote.customer.name,
 *   },
 *   shareLink: `https://yourapp.com/quote/${quote.id}`,
 *   companyName: 'Your Company',
 *   companyEmail: 'info@yourcompany.com',
 *   companyPhone: '+44 20 1234 5678',
 * });
 * 
 * if (result.success) {
 *   console.log('Email sent!');
 * }
 */
