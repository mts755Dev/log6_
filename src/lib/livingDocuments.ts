import { supabase } from './supabase';
import {
  PLATFORM_MERGE_KEYS,
  mergeFieldLabel,
  quoteTechnologiesFromQuote,
  resolveTemplateTechnologies,
  templateMatchesQuoteTechnologies,
} from './templateBuilder';
import type {
  DocumentAssignee,
  LivingDocumentEditableField,
  LivingDocumentRole,
  LivingDocumentStatus,
  Quote,
  QuoteLivingDocument,
} from '../types';

const ROLE_ORDER: LivingDocumentRole[] = [
  'installer',
  'customer',
  'engineer',
  'compliance',
];

type BuilderBlock = Record<string, unknown> & {
  id?: string;
  type?: string;
  assignee?: string;
  source?: string;
  signer?: string;
  field?: string;
  question?: string;
  content?: string;
  label?: string;
  text?: string;
  cols?: BuilderBlock[][];
};

export function mapLivingDocumentRow(row: Record<string, unknown>): QuoteLivingDocument {
  return {
    id: String(row.id),
    quoteId: String(row.quote_id),
    templateId: row.template_id ? String(row.template_id) : null,
    templateCode: String(row.template_code),
    name: String(row.name),
    htmlSnapshot: String(row.html_snapshot || ''),
    builderState: (row.builder_state as Record<string, unknown>) || null,
    responses:
      row.responses && typeof row.responses === 'object'
        ? (row.responses as Record<string, string | boolean | null>)
        : {},
    requiredRoles: Array.isArray(row.required_roles)
      ? (row.required_roles as LivingDocumentRole[])
      : [],
    completedRoles: Array.isArray(row.completed_roles)
      ? (row.completed_roles as LivingDocumentRole[])
      : [],
    pendingRole: (row.pending_role as LivingDocumentRole) || 'installer',
    status: (row.status as LivingDocumentStatus) || 'open',
    pdfDocumentId: row.pdf_document_id ? String(row.pdf_document_id) : null,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

/** Infer assignee for legacy blocks that lack an explicit assignee. */
export function inferBlockAssignee(block: BuilderBlock): DocumentAssignee {
  if (block.assignee) {
    const a = String(block.assignee);
    if (['customer', 'installer', 'engineer', 'compliance', 'system'].includes(a)) {
      return a as DocumentAssignee;
    }
  }

  if (block.type === 'signature') {
    return block.signer === 'customer' ? 'customer' : 'installer';
  }
  if (block.type === 'tickbox') {
    return block.source === 'installer' ? 'installer' : 'system';
  }
  if (block.type === 'text') {
    return block.source === 'installer' ? 'installer' : 'system';
  }
  if (block.type === 'linked' || block.type === 'labeled') {
    const field = String(block.field || '');
    if (field && !PLATFORM_MERGE_KEYS.has(field)) return 'installer';
    return 'system';
  }
  return 'system';
}

function walkBlocks(blocks: BuilderBlock[], visit: (b: BuilderBlock) => void) {
  for (const blk of blocks || []) {
    visit(blk);
    if (blk.type === 'columns' && Array.isArray(blk.cols)) {
      for (const col of blk.cols) walkBlocks(col, visit);
    }
  }
}

export function collectRequiredRolesFromBuilderState(
  builderState: Record<string, unknown> | null | undefined,
): LivingDocumentRole[] {
  const found = new Set<LivingDocumentRole>();
  const sections = (builderState?.sections as { blocks?: BuilderBlock[] }[]) || [];
  for (const section of sections) {
    walkBlocks(section.blocks || [], (blk) => {
      const assignee = inferBlockAssignee(blk);
      if (assignee === 'system') return;
      if (assignee === 'compliance') found.add('compliance');
      else if (assignee === 'engineer') found.add('engineer');
      else if (assignee === 'customer') found.add('customer');
      else if (assignee === 'installer') found.add('installer');
    });
  }
  return ROLE_ORDER.filter((r) => found.has(r));
}

export function deriveStatusFromRole(role: LivingDocumentRole): LivingDocumentStatus {
  if (role === 'customer') return 'awaiting_customer';
  if (role === 'engineer') return 'awaiting_engineer';
  if (role === 'compliance') return 'awaiting_compliance';
  if (role === 'done') return 'ready_for_pdf';
  return 'open';
}

export function nextRoleAfter(
  completed: LivingDocumentRole[],
  required: LivingDocumentRole[],
): LivingDocumentRole {
  const done = new Set(completed);
  for (const role of ROLE_ORDER) {
    if (required.includes(role) && !done.has(role)) return role;
  }
  return 'done';
}

export function collectEditableFieldsForRole(
  builderState: Record<string, unknown> | null | undefined,
  role: LivingDocumentRole | DocumentAssignee,
): LivingDocumentEditableField[] {
  if (role === 'done' || role === 'system') return [];
  const fields: LivingDocumentEditableField[] = [];
  const seen = new Set<string>();
  const sections = (builderState?.sections as { blocks?: BuilderBlock[] }[]) || [];
  const targetRole = role as DocumentAssignee;

  walkBlocks(
    sections.flatMap((s) => s.blocks || []),
    (blk) => {
      const assignee = inferBlockAssignee(blk);
      if (assignee !== targetRole) return;
      const id = String(blk.id || '');
      if (!id) return;

      if (blk.type === 'tickbox') {
        const key = `tick:${id}`;
        if (seen.has(key)) return;
        seen.add(key);
        fields.push({
          key,
          label: String(blk.question || 'Confirmation'),
          kind: 'checkbox',
          assignee,
          required: true,
        });
        return;
      }

      if (blk.type === 'signature') {
        const assigneeLabel =
          assignee === 'customer'
            ? 'Customer Signature'
            : assignee === 'installer'
              ? 'Installer Signature'
              : assignee === 'engineer'
                ? 'Engineer Signature'
                : assignee === 'compliance'
                  ? 'Compliance Signature'
                  : 'Signature';
        // Installer uses the shared company merge key; others use per-block keys.
        const key =
          assignee === 'customer'
            ? 'customer_signature'
            : assignee === 'installer'
              ? 'installer_signature'
              : `sig:${id}`;
        if (seen.has(key)) return;
        seen.add(key);
        fields.push({
          key,
          label: String(blk.label || assigneeLabel),
          kind: 'signature',
          assignee,
          required: true,
        });
        return;
      }

      if (blk.type === 'text') {
        const key = `text:${id}`;
        if (seen.has(key)) return;
        seen.add(key);
        fields.push({
          key,
          label: 'Text',
          kind: 'text',
          assignee,
        });
        return;
      }

      if (blk.type === 'linked' || blk.type === 'labeled') {
        const field = String(blk.field || '');
        if (!field || seen.has(field)) return;
        seen.add(field);
        fields.push({
          key: field,
          label: String(blk.label || mergeFieldLabel(field)),
          kind: 'text',
          assignee,
        });
      }
    },
  );

  return fields;
}

function installerResponsesFromQuote(quote: Quote): Record<string, string | boolean | null> {
  const details = quote.customer?.documentDetails || {};
  const out: Record<string, string | boolean | null> = {};
  if (details.installerSignature) out.installer_signature = details.installerSignature;
  if (details.designerName) out.designer_name = details.designerName;
  if (details.technicalOpName) out.technical_op = details.technicalOpName;
  if (details.surveyorName) out.surveyor_name = details.surveyorName;
  if (details.surveyDate) out.survey_date = details.surveyDate;
  if (details.commissioningDate) {
    out.commissioning_date = details.commissioningDate;
  } else if (quote.commissioningUploadedAt) {
    out.commissioning_date = quote.commissioningUploadedAt.slice(0, 10);
  }
  if (details.installDate) out.install_date = details.installDate;
  if (details.handoverDate) out.handover_date = details.handoverDate;
  if (details.pvPanelCount) out.pv_panel_count = details.pvPanelCount;
  if (details.pvPanelModel) out.pv_panel_model = details.pvPanelModel;
  if (details.pvAnnualYield) out.pv_annual_yield = details.pvAnnualYield;
  if (details.customFields) {
    Object.entries(details.customFields).forEach(([k, v]) => {
      out[k] = v;
    });
  }
  return out;
}

export async function createLivingDocumentsForQuote(quote: Quote): Promise<{
  created: QuoteLivingDocument[];
  errors: string[];
}> {
  const errors: string[] = [];
  const created: QuoteLivingDocument[] = [];

  const { data: templates, error } = await supabase
    .from('document_templates')
    .select('id, code, name, html_content, builder_state, technologies')
    .eq('category', 'proposal')
    .eq('is_active', true)
    .eq('auto_generate', true)
    .order('code');

  if (error) {
    return { created: [], errors: [error.message] };
  }

  if (!templates?.length) {
    return {
      created: [],
      errors: [
        'No active proposal templates found. Create an active Proposal Pack template in Admin → Templates.',
      ],
    };
  }

  const quoteTechs = quoteTechnologiesFromQuote(quote);
  const matchingTemplates = templates.filter((template) =>
    templateMatchesQuoteTechnologies(
      resolveTemplateTechnologies({
        technologies: template.technologies as string[] | null,
        builder_state: template.builder_state as Record<string, unknown> | null,
      }),
      quoteTechs,
    ),
  );

  if (!matchingTemplates.length) {
    return {
      created: [],
      errors: [
        `No proposal templates match this quote’s technology (${quoteTechs.join(', ')}). ` +
          'Tag templates with Battery Storage / Solar PV / ASHP when creating them in TMS.',
      ],
    };
  }

  // Drop living docs that no longer match this quote’s technology (e.g. old solar-tagged forms).
  const matchingCodes = new Set(matchingTemplates.map((t) => String(t.code)));
  const { data: existingLiving } = await supabase
    .from('quote_living_documents')
    .select('id, template_code')
    .eq('quote_id', quote.id);

  const staleIds = (existingLiving || [])
    .filter((row) => !matchingCodes.has(String(row.template_code)))
    .map((row) => row.id);

  if (staleIds.length) {
    await supabase.from('quote_living_documents').delete().in('id', staleIds);
  }

  const seedResponses = installerResponsesFromQuote(quote);

  // Company installer signature is system-sourced — seed it so the installer stage can auto-advance.
  if (!seedResponses.installer_signature && quote.companyId) {
    const { data: companyRow } = await supabase
      .from('companies')
      .select('installer_signature')
      .eq('id', quote.companyId)
      .maybeSingle();
    if (companyRow?.installer_signature) {
      seedResponses.installer_signature = companyRow.installer_signature as string;
    }
  }

  for (const template of matchingTemplates) {
    const builderState = (template.builder_state as Record<string, unknown>) || null;
    const requiredRoles = collectRequiredRolesFromBuilderState(builderState);
    // Always allow installer prep; if no roles tagged, finalize after installer.
    const roles =
      requiredRoles.length > 0
        ? requiredRoles
        : (['installer'] as LivingDocumentRole[]);

    const installerFields = collectEditableFieldsForRole(builderState, 'installer');
    const installerSatisfied =
      !roles.includes('installer') ||
      installerFields.every((field) => {
        if (!field.required) return true;
        const value = seedResponses[field.key];
        return value != null && value !== '' && value !== false;
      });

    const completed: LivingDocumentRole[] =
      installerSatisfied && roles.includes('installer') ? ['installer'] : [];
    const current = nextRoleAfter(completed, roles);
    const status = deriveStatusFromRole(current);

    const row = {
      quote_id: quote.id,
      template_id: template.id,
      template_code: template.code,
      name: template.name,
      html_snapshot: template.html_content || '',
      builder_state: builderState,
      responses: seedResponses,
      required_roles: roles,
      completed_roles: completed,
      pending_role: current,
      status,
      updated_at: new Date().toISOString(),
    };

    const { data, error: upsertError } = await supabase
      .from('quote_living_documents')
      .upsert(row, { onConflict: 'quote_id,template_code' })
      .select('*')
      .single();

    if (upsertError) {
      errors.push(`${template.code}: ${upsertError.message}`);
      continue;
    }
    created.push(mapLivingDocumentRow(data as Record<string, unknown>));
  }

  return { created, errors };
}

export async function listLivingDocumentsForQuote(
  quoteId: string,
): Promise<QuoteLivingDocument[]> {
  const { data, error } = await supabase
    .from('quote_living_documents')
    .select('*')
    .eq('quote_id', quoteId)
    .order('template_code');
  if (error) {
    console.error('Error loading living documents:', error);
    return [];
  }
  return (data || []).map((row) => mapLivingDocumentRow(row as Record<string, unknown>));
}

export async function listLivingDocumentsForShare(
  quoteId: string,
  token: string,
): Promise<QuoteLivingDocument[]> {
  const { data, error } = await supabase.rpc('get_living_documents_for_share', {
    p_quote_id: quoteId,
    p_token: token,
  });
  if (error) {
    console.error('Error loading shared living documents:', error);
    return [];
  }
  return (data || []).map((row: Record<string, unknown>) => mapLivingDocumentRow(row));
}

export async function saveLivingDocumentResponses(
  documentId: string,
  responses: Record<string, string | boolean | null>,
): Promise<QuoteLivingDocument | null> {
  const { data: existing } = await supabase
    .from('quote_living_documents')
    .select('responses')
    .eq('id', documentId)
    .single();

  const merged = {
    ...((existing?.responses as Record<string, string | boolean | null>) || {}),
    ...responses,
  };

  const { data, error } = await supabase
    .from('quote_living_documents')
    .update({ responses: merged, updated_at: new Date().toISOString() })
    .eq('id', documentId)
    .select('*')
    .single();

  if (error) {
    console.error('Error saving living document:', error);
    return null;
  }
  return mapLivingDocumentRow(data as Record<string, unknown>);
}

export async function submitLivingDocumentRole(
  documentId: string,
  role: LivingDocumentRole,
  responses: Record<string, string | boolean | null> = {},
): Promise<QuoteLivingDocument | null> {
  const { data: existing, error: loadError } = await supabase
    .from('quote_living_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (loadError || !existing) {
    console.error('Error loading living document for submit:', loadError);
    return null;
  }

  const doc = mapLivingDocumentRow(existing as Record<string, unknown>);
  if (doc.pendingRole !== role) {
    console.error(`Document pending role is ${doc.pendingRole}, not ${role}`);
    return null;
  }

  const completed = Array.from(new Set([...doc.completedRoles, role]));
  const next = nextRoleAfter(completed, doc.requiredRoles);
  const status = next === 'done' ? 'ready_for_pdf' : deriveStatusFromRole(next);
  const merged = { ...doc.responses, ...responses };

  const { data, error } = await supabase
    .from('quote_living_documents')
    .update({
      responses: merged,
      completed_roles: completed,
      pending_role: next,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .select('*')
    .single();

  if (error) {
    console.error('Error submitting living document role:', error);
    return null;
  }
  return mapLivingDocumentRow(data as Record<string, unknown>);
}

export async function saveLivingDocumentCustomer(
  documentId: string,
  quoteId: string,
  token: string,
  responses: Record<string, string | boolean | null>,
): Promise<QuoteLivingDocument | null> {
  const { data, error } = await supabase.rpc('save_living_document_customer', {
    p_document_id: documentId,
    p_quote_id: quoteId,
    p_token: token,
    p_responses: responses,
  });
  if (error) {
    console.error('Error saving customer living document:', error);
    return null;
  }
  return mapLivingDocumentRow(data as Record<string, unknown>);
}

export async function submitLivingDocumentCustomer(
  documentId: string,
  quoteId: string,
  token: string,
  responses: Record<string, string | boolean | null> = {},
): Promise<QuoteLivingDocument | null> {
  const { data, error } = await supabase.rpc('submit_living_document_customer', {
    p_document_id: documentId,
    p_quote_id: quoteId,
    p_token: token,
    p_responses: responses,
  });
  if (error) {
    console.error('Error submitting customer living document:', error);
    return null;
  }
  return mapLivingDocumentRow(data as Record<string, unknown>);
}

export function livingDocumentStatusLabel(status: LivingDocumentStatus): string {
  switch (status) {
    case 'open':
      return 'Installer drafting';
    case 'awaiting_customer':
      return 'Awaiting customer';
    case 'awaiting_engineer':
      return 'Awaiting engineer';
    case 'awaiting_compliance':
      return 'Awaiting compliance';
    case 'ready_for_pdf':
      return 'Ready for PDF';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
}

export function assigneeLabel(assignee: DocumentAssignee): string {
  switch (assignee) {
    case 'customer':
      return 'Customer';
    case 'installer':
      return 'Installer';
    case 'engineer':
      return 'Engineer';
    case 'compliance':
      return 'Compliance Officer';
    case 'system':
      return 'System (auto)';
    default:
      return assignee;
  }
}
