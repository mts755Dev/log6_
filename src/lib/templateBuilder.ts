import type { TemplateCategory } from '../types';
import { mergeTemplate } from '../utils/pdfGenerator';

export interface CustomLinkedField {
  key: string;
  label: string;
}

export interface TemplateBuilderSnapshot {
  name: string;
  techs: string[];
  homes: string[];
  font: string;
  version: string;
  docId: string;
  sections: unknown[];
  /** Admin-defined merge fields stored with the template. */
  customFields?: CustomLinkedField[];
}

export function homesToCategory(homes: string[]): TemplateCategory {
  const label = (homes[0] || '').toLowerCase();
  if (label.includes('contract')) return 'contract';
  if (label.includes('handover')) return 'handover';
  if (label.includes('invoice')) return 'invoice';
  return 'proposal';
}

/** TMS technology keys → admin-facing labels. */
export const TEMPLATE_TECHNOLOGY_LABELS: Record<string, string> = {
  solar: 'Solar PV',
  battery: 'Battery Storage',
  ashp: 'Air Source Heat Pump',
  general: 'General',
};

export function normalizeTemplateTechnologies(techs: unknown): string[] {
  if (!Array.isArray(techs)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of techs) {
    let key = String(raw || '')
      .trim()
      .toLowerCase();
    if (key === 'heatpump' || key === 'heat_pump' || key === 'heat-pumps' || key === 'heat_pumps') {
      key = 'ashp';
    }
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function templateTechnologyLabel(key: string): string {
  return (
    TEMPLATE_TECHNOLOGY_LABELS[key] ||
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Prefer dedicated column, then builder_state.techs. */
export function resolveTemplateTechnologies(template: {
  technologies?: string[] | null;
  builderState?: TemplateBuilderSnapshot | Record<string, unknown> | null;
  builder_state?: TemplateBuilderSnapshot | Record<string, unknown> | null;
}): string[] {
  const fromColumn = normalizeTemplateTechnologies(template.technologies);
  if (fromColumn.length) return fromColumn;
  const state = (template.builderState || template.builder_state) as
    | TemplateBuilderSnapshot
    | undefined;
  return normalizeTemplateTechnologies(state?.techs);
}

/**
 * Infer which TMS tech keys a quote pack should use (from products on the quote only).
 * Existing solar on site does NOT expand the pack — a battery quote stays battery-only.
 */
export function quoteTechnologiesFromQuote(quote: {
  lineItems?: Array<{ type?: string; description?: string }>;
}): string[] {
  const techs = new Set<string>();
  const items = quote.lineItems || [];

  if (items.some((item) => item.type === 'battery')) {
    techs.add('battery');
  }

  const mentionsHeatPump = items.some((item) =>
    /heat\s*pump|ashp|air.source/i.test(String(item.description || '')),
  );
  if (mentionsHeatPump) {
    techs.add('ashp');
  }

  // Inverter-only (no battery) → solar pack. Battery + inverter stays battery.
  if (items.some((item) => item.type === 'inverter') && !techs.has('battery')) {
    techs.add('solar');
  }

  if (techs.size === 0) {
    techs.add('solar');
  }

  return [...techs];
}

/**
 * Attach a template only when it is General, or shares a product tech with the quote.
 * Solar/ASHP templates do not attach to battery-only quotes.
 */
export function templateMatchesQuoteTechnologies(
  templateTechs: string[] | null | undefined,
  quoteTechs: string[],
): boolean {
  const techs = normalizeTemplateTechnologies(templateTechs || []);
  // Untagged / general → any quote. Explicitly tagged → must overlap quote products.
  if (techs.length === 0 || techs.includes('general')) return true;
  return techs.some((tech) => quoteTechs.includes(tech));
}

/** Builder field keys that map to a different merge key at PDF time. */
export const MERGE_FIELD_ALIASES: Record<string, string> = {
  // Keep site_address as its own field so templates can show a different site.
};

export function resolveMergeFieldKey(key: string): string {
  return MERGE_FIELD_ALIASES[key] || key;
}

type BuilderBlock = Record<string, unknown>;
type BuilderCell = { kind?: string; field?: string };

function walkBuilderBlocks(blocks: BuilderBlock[], add: (key: string) => void) {
  for (const blk of blocks) {
    const type = blk.type as string;

    if (type === 'linked' && blk.field) add(String(blk.field));
    if (type === 'labeled' && blk.field) add(String(blk.field));

    if (type === 'labeledDate') {
      const dateMode = (blk.dateMode as string) || 'today';
      if (dateMode === 'linked' && blk.dateField) add(String(blk.dateField));
      else if (dateMode === 'today') add('current_date');
    }

    if (type === 'datestamp' && (blk.mode as string) === 'auto') add('current_date');

    if (type === 'signature') {
      const dateMode = (blk.dateMode as string) || 'today';
      if (dateMode === 'linked' && blk.dateField) add(String(blk.dateField));
      else if (dateMode === 'today') add('current_date');
      if (blk.signer !== 'customer' && blk.role) add(String(blk.role));
      if (blk.signer !== 'customer') add('installer_signature');
    }

    // Logo blocks keep their baked template image; do not treat as company_logo merge.

    if (type === 'table' && Array.isArray(blk.grid)) {
      for (const row of blk.grid as BuilderCell[][]) {
        for (const cell of row) {
          if (cell?.kind === 'linked' && cell.field) add(String(cell.field));
        }
      }
    }

    if (type === 'columns' && Array.isArray(blk.cols)) {
      for (const col of blk.cols as BuilderBlock[][]) {
        walkBuilderBlocks(col, add);
      }
    }
  }
}

export function collectMergeFieldsFromSnapshot(snapshot?: TemplateBuilderSnapshot): string[] {
  const fields = new Set<string>();
  const add = (key: string) => fields.add(resolveMergeFieldKey(key));

  if (!snapshot?.sections) return [];

  for (const section of snapshot.sections as { blocks?: BuilderBlock[] }[]) {
    walkBuilderBlocks(section.blocks || [], add);
  }

  return Array.from(fields);
}

export function extractMergeFields(htmlContent: string, snapshot?: TemplateBuilderSnapshot): string[] {
  const fields = new Set<string>();
  const pattern = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(htmlContent)) !== null) {
    fields.add(match[1]);
  }

  if (snapshot) {
    collectMergeFieldsFromSnapshot(snapshot).forEach((key) => fields.add(key));
  }

  return Array.from(fields);
}

export const MERGE_FIELD_LABELS: Record<string, string> = {
  customer_name: 'Customer Name',
  customer_email: 'Customer Email',
  customer_phone: 'Customer Phone',
  customer_address: 'Customer Address',
  site_address: 'Site Address',
  installation_address: 'Installation Address',
  quote_reference: 'Quote Reference',
  quote_id: 'Quote ID',
  quote_total: 'Quote Total',
  total_price: 'Total Price',
  subtotal: 'Subtotal',
  vat: 'VAT',
  vat_amount: 'VAT Amount',
  vat_rate: 'VAT Rate',
  deposit_amount: 'Deposit Amount',
  deposit_percentage: 'Deposit %',
  final_balance: 'Final Balance',
  balance_amount: 'Balance Amount',
  company_name: 'Company Name',
  company_logo: 'Company Logo',
  company_email: 'Company Email',
  company_phone: 'Company Phone',
  company_address: 'Company Address',
  company_contact: 'Company Contact',
  company_registration: 'Company Registration',
  installer_name: 'Installer Name',
  installer_signature: 'Installer Signature',
  designer_name: 'Designer Name',
  technical_op: 'Technical Operative',
  surveyor_name: 'Surveyor',
  current_date: 'Current Date',
  contract_date: 'Contract Date',
  report_date: 'Report Date',
  install_date: 'Install Date',
  commissioning_date: 'Commissioning Date',
  survey_date: 'Survey Date',
  handover_date: 'Handover Date',
  battery_capacity: 'Battery Capacity',
  battery_capacity_kwh: 'Battery Capacity (kWh)',
  system_description: 'System Description',
  pv_system_size: 'PV System Size',
  pv_panel_count: 'Panel Count',
  pv_panel_model: 'Panel Model',
  pv_inverter: 'Inverter Model',
  pv_annual_yield: 'Est. Annual Yield',
  hp_model: 'Heat Pump Model',
  hp_output: 'Heat Pump Output',
  hp_flow_temp: 'Flow Temperature',
  hp_heat_loss: 'Property Heat Loss',
  hp_scop: 'SCOP',
};

export function mergeFieldLabel(key: string): string {
  return (
    MERGE_FIELD_LABELS[key] ||
    key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

/** Built-in keys always filled by heliOS / quote data. */
export const PLATFORM_MERGE_KEYS = new Set(Object.keys(MERGE_FIELD_LABELS));

export function slugifyMergeFieldKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export function normalizeCustomLinkedFields(
  fields: unknown,
): CustomLinkedField[] {
  if (!Array.isArray(fields)) return [];
  const seen = new Set<string>();
  const out: CustomLinkedField[] = [];
  for (const raw of fields) {
    if (!raw || typeof raw !== 'object') continue;
    const label = String((raw as CustomLinkedField).label || '').trim();
    let key = String((raw as CustomLinkedField).key || '').trim().toLowerCase();
    if (!key && label) key = slugifyMergeFieldKey(label);
    if (!key || !/^[a-z][a-z0-9_]*$/.test(key) || PLATFORM_MERGE_KEYS.has(key)) {
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label: label || mergeFieldLabel(key) });
  }
  return out;
}

/** Custom field defs declared on a builder snapshot. */
export function customFieldsFromSnapshot(
  snapshot?: TemplateBuilderSnapshot | Record<string, unknown> | null,
): CustomLinkedField[] {
  if (!snapshot || typeof snapshot !== 'object') return [];
  return normalizeCustomLinkedFields(
    (snapshot as TemplateBuilderSnapshot).customFields,
  );
}

/**
 * Custom merge keys declared on templates (admin “Add custom field”).
 */
export function collectCustomMergeFieldsFromTemplates(
  templates: Array<{
    builderState?: TemplateBuilderSnapshot | Record<string, unknown>;
  }>,
): CustomLinkedField[] {
  const byKey = new Map<string, CustomLinkedField>();

  for (const template of templates) {
    for (const field of customFieldsFromSnapshot(template.builderState)) {
      byKey.set(field.key, field);
    }
  }

  return Array.from(byKey.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

export function getTemplateMergeFields(template: {
  mergeFields?: string[];
  htmlContent?: string;
  builderState?: TemplateBuilderSnapshot | Record<string, unknown>;
}): string[] {
  const fields = new Set<string>();

  (template.mergeFields || []).forEach((field) => fields.add(field));

  extractMergeFields(
    template.htmlContent || '',
    template.builderState as TemplateBuilderSnapshot | undefined,
  ).forEach((field) => fields.add(field));

  return Array.from(fields).sort((a, b) =>
    mergeFieldLabel(a).localeCompare(mergeFieldLabel(b)),
  );
}

/**
 * Fill any leftover builder markers that were not converted to {{tags}}
 * when the template was saved (linked pills still carrying data-tms-merge).
 */
export function applyLiveMergeAttributes(
  html: string,
  data: Record<string, unknown>,
): string {
  if (typeof DOMParser === 'undefined') return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return html;

  root.querySelectorAll('[data-tms-merge]').forEach((el) => {
    const rawKey = el.getAttribute('data-tms-merge') || '';
    const key = resolveMergeFieldKey(rawKey);
    const value = data[key] ?? data[rawKey] ?? '';
    const text = value == null ? '' : String(value);

  if (el.tagName === 'IMG') {
      if (text) {
        el.setAttribute('src', text);
        el.setAttribute(
          'style',
          'max-height:48px;max-width:220px;object-fit:contain;display:block;',
        );
      }
      el.removeAttribute('data-tms-merge');
      return;
    }

    const span = doc.createElement('span');
    span.textContent = text;
    const style = el.getAttribute('style');
    if (style) {
      // Drop gold pill chrome so PDF shows plain values
      span.setAttribute(
        'style',
        'font-size:13px;font-weight:500;color:#1e293b;font-family:inherit;',
      );
    }
    el.replaceWith(span);
  });

  return root.innerHTML;
}

/** Replace builder linked-field markers with {{merge}} tags in exported HTML. */
export function applyMergePlaceholdersToHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html;

  const doc = new DOMParser().parseFromString(`<div id="tms-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('tms-root');
  if (!root) return html;

  root.querySelectorAll('[data-tms-merge]').forEach((el) => {
    const key = el.getAttribute('data-tms-merge');
    if (!key) return;

    const mergeTag = `{{${resolveMergeFieldKey(key)}}}`;

    if (el.tagName === 'IMG') {
      el.setAttribute('src', mergeTag);
      el.removeAttribute('data-tms-merge');
      return;
    }

    el.replaceWith(doc.createTextNode(mergeTag));
  });

  return root.innerHTML;
}

export function defaultTemplateCode(snapshot: TemplateBuilderSnapshot): string {
  const fromDoc = snapshot.docId?.replace(/[^A-Z0-9]/gi, '').slice(0, 8).toUpperCase();
  if (fromDoc) return fromDoc;
  const fromName = snapshot.name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 6);
  return fromName || 'TMPL01';
}

/** Sample values for admin HTML preview (legacy templates without builder state). */
export const SAMPLE_PREVIEW_MERGE_DATA: Record<string, string> = {
  current_date: new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }),
  contract_date: new Date().toLocaleDateString('en-GB'),
  report_date: new Date().toLocaleDateString('en-GB'),

  customer_name: 'Robert Customer',
  customer_email: 'robert@example.com',
  customer_phone: '07348 326462',
  customer_address: '45 Orchard Lane, Bristol',
  site_address: '45 Orchard Lane, Bristol',
  installation_address: '45 Orchard Lane, Bristol',

  quote_reference: 'QT-2026-1234',
  quote_id: 'sample-quote-id',
  quote_total: '£12,500.00',
  total_price: '£12,500.00',
  subtotal: '£10,416.67',
  vat: '£2,083.33',
  vat_amount: '£2,083.33',
  deposit_amount: '£3,125.00',
  deposit_percentage: '25%',
  final_balance: '£9,375.00',
  balance_amount: '£9,375.00',

  company_name: 'Callum Installer Company',
  company_email: 'hello@installer.example',
  company_phone: '01234 567890',
  company_address: '12 Solar Street, Bristol',
  company_contact: 'hello@installer.example | 01234 567890',
  company_logo: '/assets/Main heliOS Logo.png',

  designer_name: 'Alex Designer',
  technical_op: 'Jordan Technician',
  surveyor_name: 'Sam Surveyor',
  installer_name: 'Callum Installer',

  battery_capacity: '13.5',
  battery_capacity_kwh: '13.5 kWh',
  system_description: '13.5 kWh battery storage system',
};

const TEMPLATE_PREVIEW_CSS = `
  .tms-template-preview {
    max-width: 720px;
    margin: 0 auto;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    color: #1c1b19;
  }
  .tms-template-preview input,
  .tms-template-preview textarea {
    border: none;
    background: transparent;
    pointer-events: none;
  }
`;

/** Render stored HTML with sample merge data for list preview. */
export function buildTemplatePreviewHtml(
  htmlContent: string,
  cssStyles?: string | null,
): string {
  const merged = mergeTemplate(htmlContent, SAMPLE_PREVIEW_MERGE_DATA);
  const extraStyles = cssStyles?.trim() ? cssStyles : TEMPLATE_PREVIEW_CSS;
  return `<style>${extraStyles}</style><div class="tms-template-preview">${merged}</div>`;
}
