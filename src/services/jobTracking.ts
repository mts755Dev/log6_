import { supabase } from '../lib/supabase';
import type { QuoteStatus } from '../types';

/**
 * Update quote status with automatic timestamp tracking
 */
export async function updateJobStatus(
  quoteId: string,
  newStatus: QuoteStatus,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Call the database function that handles status updates and timestamps
    const { data, error } = await supabase.rpc('update_quote_status', {
      quote_id_param: quoteId,
      new_status: newStatus,
      notes_param: notes || null,
    });

    if (error) {
      console.error('Error updating job status:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error updating job status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark deposit as paid and update status
 */
export async function markDepositPaid(quoteId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('quotes')
      .update({
        status: 'deposit_paid',
        deposit_paid_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error marking deposit as paid:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Schedule installation
 */
export async function scheduleInstallation(
  quoteId: string,
  installationDate: string,
  engineerId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('quotes')
      .update({
        status: 'scheduled',
        scheduled_at: new Date().toISOString(),
        installation_date: installationDate,
        assigned_engineer_id: engineerId || null,
      })
      .eq('id', quoteId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error scheduling installation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark installation as started
 */
export async function startInstallation(
  quoteId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('quotes')
      .update({
        status: 'in_progress',
        installation_started_at: new Date().toISOString(),
        installation_notes: notes || null,
      })
      .eq('id', quoteId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error starting installation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark installation as completed
 */
export async function completeInstallation(
  quoteId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('quotes')
      .update({
        status: 'completed',
        installation_completed_at: new Date().toISOString(),
        installation_notes: notes || null,
      })
      .eq('id', quoteId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error completing installation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark commissioning as uploaded
 */
export async function uploadCommissioning(
  quoteId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('quotes')
      .update({
        status: 'commissioning',
        commissioning_uploaded_at: new Date().toISOString(),
        commissioning_notes: notes || null,
      })
      .eq('id', quoteId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error uploading commissioning:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Submit for compliance review
 */
export async function submitForCompliance(
  quoteId: string,
  complianceOfficerId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('quotes')
      .update({
        status: 'compliance_review',
        compliance_officer_id: complianceOfficerId || null,
      })
      .eq('id', quoteId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error submitting for compliance:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Approve compliance and mark as MCS certified
 */
export async function approveCompliance(
  quoteId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('quotes')
      .update({
        status: 'mcs_certified',
        mcs_certified_at: new Date().toISOString(),
        compliance_reviewed_at: new Date().toISOString(),
        compliance_notes: notes || null,
      })
      .eq('id', quoteId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error approving compliance:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reject compliance
 */
export async function rejectCompliance(
  quoteId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('quotes')
      .update({
        status: 'commissioning', // Send back to commissioning
        compliance_reviewed_at: new Date().toISOString(),
        compliance_notes: `REJECTED: ${reason}`,
        rejection_reason: reason,
      })
      .eq('id', quoteId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error rejecting compliance:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark final invoice as sent
 */
export async function sendFinalInvoice(quoteId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('quotes')
      .update({
        status: 'final_invoice_sent',
        final_invoice_sent_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error sending final invoice:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Close job
 */
export async function closeJob(quoteId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('quotes')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error closing job:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get quote status history
 * Returns: { status_name: string, occurred_at: string, order_num: number }[]
 */
export async function getQuoteStatusHistory(quoteId: string) {
  try {
    const { data, error } = await supabase.rpc('get_quote_status_history', {
      quote_id_param: quoteId,
    });

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error('Error getting status history:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all jobs in pipeline (for dashboard)
 */
export async function getJobPipeline(companyId?: string) {
  try {
    let query = supabase.from('job_pipeline').select('*');

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error('Error getting job pipeline:', error);
    return { success: false, error: error.message };
  }
}
