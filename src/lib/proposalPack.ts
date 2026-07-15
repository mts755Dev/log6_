import { createLivingDocumentsForQuote } from './livingDocuments';
import { supabase } from './supabase';
import type { Quote } from '../types';

/** Map a quotes table row to the app Quote type (minimal fields living docs need). */
export function mapQuoteRow(data: Record<string, unknown>): Quote {
  return {
    id: String(data.id),
    companyId: String(data.company_id || ''),
    installerId: String(data.installer_id || ''),
    installerName: String(data.installer_name || ''),
    reference: String(data.reference || ''),
    status: data.status as Quote['status'],
    installationType: data.installation_type as Quote['installationType'],
    customer: (data.customer || {}) as Quote['customer'],
    tariff: (data.tariff || {}) as Quote['tariff'],
    lineItems: (data.line_items || []) as Quote['lineItems'],
    subtotal: Number(data.subtotal || 0),
    vatRate: Number(data.vat_rate || 0),
    vatAmount: Number(data.vat_amount || 0),
    total: Number(data.total || 0),
    deposit: Number(data.deposit || 0),
    margin: Number(data.margin || 0),
    marginPercentage: Number(data.margin_percentage || 0),
    roiProjections: (data.roi_projections || []) as Quote['roiProjections'],
    paybackYears: Number(data.payback_years || 0),
    annualSavings: Number(data.annual_savings || 0),
    notes: String(data.notes || ''),
    validUntil: String(data.valid_until || ''),
    createdAt: String(data.created_at || ''),
    updatedAt: String(data.updated_at || ''),
    sentAt: data.sent_at ? String(data.sent_at) : undefined,
    viewedAt: data.viewed_at ? String(data.viewed_at) : undefined,
    acceptedAt: data.accepted_at ? String(data.accepted_at) : undefined,
    customerSignature: data.customer_signature
      ? String(data.customer_signature)
      : undefined,
    share_token: data.share_token ? String(data.share_token) : undefined,
    assignedEngineerId: data.assigned_engineer_id
      ? String(data.assigned_engineer_id)
      : undefined,
    installationDate: data.installation_date
      ? String(data.installation_date)
      : undefined,
    customerAvailability: data.customer_availability as Quote['customerAvailability'],
  };
}

/**
 * Ensure the same living proposal pack + document-bank leaflets exist for a quote
 * (idempotent — safe to call again after scheduling).
 */
export async function ensureProposalPackForQuote(quote: Quote): Promise<{
  created: Awaited<ReturnType<typeof createLivingDocumentsForQuote>>['created'];
  errors: string[];
}> {
  const livingResult = await createLivingDocumentsForQuote(quote);

  const { error: attachError } = await supabase.rpc('attach_documents_to_quote', {
    p_quote_id: quote.id,
  });
  if (attachError) {
    console.error('Error attaching Document Bank files:', attachError);
    livingResult.errors.push(attachError.message);
  }

  return livingResult;
}

export async function loadQuoteForProposalPack(quoteId: string): Promise<Quote | null> {
  const { data, error } = await supabase.from('quotes').select('*').eq('id', quoteId).single();
  if (error || !data) {
    console.error('Failed to load quote for proposal pack:', error);
    return null;
  }
  return mapQuoteRow(data as Record<string, unknown>);
}
