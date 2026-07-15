// @ts-nocheck - PDF generator with template variables
import { supabase } from '../lib/supabase';
import { generatePDFFromHTML, mergeTemplate } from '../utils/pdfGenerator';
import {
  formatUkDate,
  getDocumentDetails,
} from '../lib/quoteDocumentValidation';
import { applyLiveMergeAttributes, quoteTechnologiesFromQuote, resolveTemplateTechnologies, templateMatchesQuoteTechnologies } from '../lib/templateBuilder';
import type { Quote } from '../types';

interface PdfGenerationResult {
  success: boolean;
  fileUrl?: string;
  fileName?: string;
  error?: string;
}

interface DbTemplate {
  id: string;
  code: string;
  name: string;
  html_content: string;
  css_styles?: string | null;
}

interface LineItemMergeRow {
  description: string;
  quantity: string;
  unit_price: string;
  total: string;
}

function buildFullAddress(address: string, postcode?: string): string {
  return [address, postcode].map((p) => (p || '').trim()).filter(Boolean).join(', ');
}

function formatMoney(amount: number): string {
  return `£${amount.toFixed(2)}`;
}

/**
 * Build merge fields for any admin template (template builder or legacy HTML).
 */
export function buildQuoteMergeData(
  quote: Quote,
  companyData: Record<string, unknown>,
): Record<string, unknown> {
  const batteryCapacity = getBatteryCapacity(quote);
  const batteryCapacityLabels = formatBatteryCapacity(batteryCapacity, quote);
  const estimatedSavings = calculateEstimatedSavings(batteryCapacity || 10);
  const depositPercentage =
    quote.total > 0 ? Math.round((quote.deposit / quote.total) * 100) : 0;

  const companyEmail =
    (companyData.contactEmail as string) ||
    (companyData.contact_email as string) ||
    (companyData.email as string) ||
    '';
  const companyPhone =
    (companyData.contactPhone as string) ||
    (companyData.contact_phone as string) ||
    (companyData.phone as string) ||
    '';

  const formattedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const shortRef = quote.reference || quote.id.slice(0, 8).toUpperCase();
  const details = getDocumentDetails(quote.customer);
  const customerAddress = buildFullAddress(
    quote.customer.address,
    quote.customer.postcode,
  );
  const siteAddress = (details.siteAddress || '').trim() || customerAddress;

  const designerName = (details.designerName || '').trim() || quote.installerName || '';
  const technicalOp = (details.technicalOpName || '').trim() || quote.installerName || '';
  const surveyorName = (details.surveyorName || '').trim() || quote.installerName || '';

  const installDate =
    formatUkDate(details.installDate) ||
    formatUkDate(quote.installationDate) ||
    '';
  const commissioningDate =
    formatUkDate(details.commissioningDate) ||
    formatUkDate(quote.commissioningUploadedAt) ||
    '';
  const surveyDate = formatUkDate(details.surveyDate);
  const handoverDate = formatUkDate(details.handoverDate);

  const inverterItem = (quote.lineItems || []).find((item) => item.type === 'inverter');
  const pvSystemSize = quote.customer.solarCapacityKwp
    ? `${quote.customer.solarCapacityKwp} kWp`
    : '';

  const lineItems: LineItemMergeRow[] = (quote.lineItems || []).map((item) => {
    const lineTotal = item.unitPrice * item.quantity;
    return {
      description: item.description,
      quantity: String(item.quantity),
      unit_price: formatMoney(item.unitPrice),
      total: formatMoney(lineTotal),
    };
  });

  return {
    current_date: formattedDate,
    contract_date: formattedDate,
    report_date: new Date().toLocaleDateString('en-GB'),

    customer_name: quote.customer.name,
    customer_email: quote.customer.email,
    customer_phone: quote.customer.phone || '',
    customer_address: customerAddress,
    site_address: siteAddress,
    installation_address: siteAddress,

    designer_name: designerName,
    technical_op: technicalOp,
    surveyor_name: surveyorName,

    install_date: installDate,
    commissioning_date: commissioningDate,
    survey_date: surveyDate,
    handover_date: handoverDate,

    pv_system_size: pvSystemSize,
    pv_panel_count: details.pvPanelCount || '',
    pv_panel_model: details.pvPanelModel || '',
    pv_inverter: inverterItem?.description || '',
    pv_annual_yield: details.pvAnnualYield || '',

    hp_model: '',
    hp_output: '',
    hp_flow_temp: '',
    hp_heat_loss: '',
    hp_scop: '',

    quote_reference: shortRef,
    quote_id: quote.id,

    company_name: (companyData.name as string) || 'Your Company',
    // Legacy templates may still contain {{company_logo}}. Prefer the baked
    // letterhead from the builder; this only fills leftover merge tags.
    company_logo: `${typeof window !== 'undefined' ? window.location.origin : ''}/assets/Main heliOS Logo.png`,
    company_email: companyEmail,
    company_phone: companyPhone,
    company_address: (companyData.address as string) || '',
    company_website: (companyData.website as string) || '',
    company_contact: [companyEmail, companyPhone].filter(Boolean).join(' | '),
    company_registration:
      (companyData.registrationNumber as string) ||
      (companyData.registration_number as string) ||
      'N/A',

    installer_name: quote.installerName || '',
    // Quote override first, then saved company signature.
    installer_signature:
      details.installerSignature ||
      (companyData.installer_signature as string) ||
      (companyData.installerSignature as string) ||
      '',

    battery_capacity: batteryCapacityLabels.raw,
    battery_capacity_kwh: batteryCapacityLabels.labelled,

    quote_total: formatMoney(quote.total),
    total_price: formatMoney(quote.total),
    total: formatMoney(quote.total),
    subtotal: formatMoney(quote.subtotal),
    vat: formatMoney(quote.vatAmount),
    vat_amount: formatMoney(quote.vatAmount),
    vat_rate: `${quote.vatRate}`,

    deposit_amount: formatMoney(quote.deposit),
    deposit_percentage: `${depositPercentage}%`,
    final_balance: formatMoney(quote.total - quote.deposit),
    balance_amount: formatMoney(quote.total - quote.deposit),

    system_description: generateSystemSummary(quote),
    payment_method: 'Bank Transfer / Card Payment',
    warranty_period: '10 years',
    completion_timeframe: '4-6 weeks from deposit payment',

    estimated_cycles_per_year: '250',
    estimated_annual_savings: formatMoney(estimatedSavings.annual),
    estimated_monthly_savings: formatMoney(estimatedSavings.monthly),
    payback_period: `${estimatedSavings.paybackYears} years`,
    system_lifetime: '25 years',
    total_lifetime_savings: formatMoney(estimatedSavings.lifetime),
    co2_reduction: `${(batteryCapacity * 0.5 * 250).toFixed(0)} kg/year`,
    system_efficiency: '95%',

    valid_until: quote.validUntil
      ? new Date(quote.validUntil).toLocaleDateString('en-GB')
      : 'N/A',

    customer_signature: quote.customerSignature
      ? `<img src="${quote.customerSignature}" alt="Customer signature" style="max-height:48px;max-width:220px;" />`
      : quote.customer.name || '',

    line_items: lineItems,

    ...(details.customFields && typeof details.customFields === 'object'
      ? details.customFields
      : {}),
  };
}

/**
 * Older builder exports put `{{technical_op}}` (or another role) inside the
 * signature pad instead of an `<img src="{{installer_signature}}">`.
 * Rewrite those pads before merge so the handwritten signature can land.
 */
function rewriteLegacyInstallerSignaturePads(html: string): string {
  if (typeof DOMParser === 'undefined') return html;

  const ROLE_TAGS = [
    '{{technical_op}}',
    '{{designer_name}}',
    '{{surveyor_name}}',
    '{{installer_name}}',
  ];

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return html;

  root.querySelectorAll('div').forEach((el) => {
    const style = (el.getAttribute('style') || '').toLowerCase();
    const looksLikePad =
      style.includes('height') &&
      style.includes('border') &&
      style.includes('overflow') &&
      !style.includes('border-bottom') &&
      !style.includes('dashed');
    if (!looksLikePad) return;

    if (el.querySelector('img[src*="installer_signature"], img[alt="Installer signature"]')) {
      return;
    }

    const raw = (el.innerHTML || '').replace(/\s+/g, ' ').trim();
    const hasRolePlaceholder = ROLE_TAGS.some((tag) => raw.includes(tag));
    // Pad that only holds a role merge (or is empty aside from chrome spans)
    const onlyRoleOrEmpty =
      hasRolePlaceholder ||
      !raw ||
      /^<span[^>]*>\s*<\/span>$/i.test(raw);

    if (!onlyRoleOrEmpty && !hasRolePlaceholder) return;

    Array.from(el.childNodes).forEach((child) => {
      if (!(child instanceof HTMLElement)) {
        child.textContent = '';
        return;
      }
      const childStyle = (child.getAttribute('style') || '').toLowerCase();
      if (childStyle.includes('position: absolute') || childStyle.includes('position:absolute')) {
        return;
      }
      child.remove();
    });

    const img = doc.createElement('img');
    img.setAttribute('src', '{{installer_signature}}');
    img.setAttribute('alt', 'Installer signature');
    img.setAttribute(
      'style',
      'max-height:40px;max-width:92%;object-fit:contain;display:block;',
    );
    el.insertBefore(img, el.firstChild);
  });

  return root.innerHTML;
}

/**
 * Place the drawn installer signature into the PDF HTML.
 * Handles <img src="{{installer_signature}}">, placeholder gifs, and older
 * pads that still print the technician name.
 */
function injectInstallerSignatureImage(
  html: string,
  signatureDataUrl: string,
  fallbackName: string,
): string {
  if (!signatureDataUrl?.trim() || typeof DOMParser === 'undefined') return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return html;

  const PLACEHOLDER_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP';

  const makeImg = () => {
    const img = doc.createElement('img');
    img.setAttribute('src', signatureDataUrl);
    img.setAttribute('alt', 'Installer signature');
    img.setAttribute(
      'style',
      'max-height:48px;max-width:220px;object-fit:contain;display:block;',
    );
    return img;
  };

  const fillPad = (el: Element) => {
    // Keep absolute chrome (e.g. position:absolute tags) but replace pad content.
    Array.from(el.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        child.textContent = '';
        return;
      }
      if (!(child instanceof HTMLElement)) return;
      const childStyle = (child.getAttribute('style') || '').toLowerCase();
      if (childStyle.includes('position: absolute') || childStyle.includes('position:absolute')) {
        return;
      }
      child.remove();
    });
    el.insertBefore(makeImg(), el.firstChild);
  };

  // 1) <img src="{{installer_signature}}"> / empty src / tiny placeholder gif
  root.querySelectorAll('img').forEach((img) => {
    const src = (img.getAttribute('src') || '').trim();
    const alt = (img.getAttribute('alt') || '').toLowerCase();
    if (
      alt.includes('installer signature') ||
      src.includes('{{installer_signature}}') ||
      src.startsWith(PLACEHOLDER_GIF) ||
      (alt.includes('signature') && (!src || src === 'undefined'))
    ) {
      img.setAttribute('src', signatureDataUrl);
      img.setAttribute('alt', 'Installer signature');
      img.setAttribute(
        'style',
        'max-height:48px;max-width:220px;object-fit:contain;display:block;',
      );
      // Remove sibling builder hint text inside the pad so only the signature shows
      const pad = img.parentElement;
      if (pad) {
        Array.from(pad.childNodes).forEach((child) => {
          if (child === img) return;
          if (child.nodeType === Node.TEXT_NODE) {
            child.textContent = '';
            return;
          }
          if (!(child instanceof HTMLElement)) return;
          const childStyle = (child.getAttribute('style') || '').toLowerCase();
          if (childStyle.includes('position: absolute') || childStyle.includes('position:absolute')) {
            return;
          }
          if (child.tagName === 'IMG') return;
          child.remove();
        });
      }
    }
  });

  // 2) Text placeholders left by older exports
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null = walker.nextNode();
  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }
  textNodes.forEach((textNode) => {
    const value = textNode.nodeValue || '';
    if (!value.includes('{{installer_signature}}')) return;
    if (value.trim() === '{{installer_signature}}') {
      textNode.parentElement?.replaceChild(makeImg(), textNode);
      return;
    }
    textNode.nodeValue = value.replace(/\{\{installer_signature\}\}/g, '');
    textNode.parentElement?.insertBefore(makeImg(), textNode.nextSibling);
  });

  // 3) Signature pad boxes (bordered + fixed height) that still show a name / placeholder
  const name = fallbackName.trim().toLowerCase();
  root.querySelectorAll('div').forEach((el) => {
    if (el.querySelector('img[src^="data:image/png"]')) return;
    const style = (el.getAttribute('style') || '').toLowerCase();
    const looksLikePad =
      style.includes('height') &&
      style.includes('border') &&
      style.includes('overflow') &&
      !style.includes('border-bottom') &&
      !style.includes('dashed');
    if (!looksLikePad) return;

    const text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const emptyOrName =
      !text ||
      (name && text === name) ||
      text === 'technical operative' ||
      text === 'installer';
    if (!emptyOrName) return;

    fillPad(el);
  });

  return root.innerHTML;
}

/**
 * If a template table has blank body rows, fill them from quote line items
 * so product schedules are not empty in customer PDFs.
 * Skips designed "spec" tables (System / Site / Battery linked-field layouts).
 */
export function injectLineItemsIntoEmptyTables(
  html: string,
  lineItems: LineItemMergeRow[],
): string {
  if (!lineItems.length || typeof DOMParser === 'undefined') return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return html;

  root.querySelectorAll('table').forEach((table) => {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length < 2) return;

    const headerCells = Array.from(rows[0].querySelectorAll('th,td'));
    const colCount = headerCells.length || 3;
    const bodyRows = rows.slice(1);

    // Keep template tables that already have row labels / linked fields
    const hasDesignedContent = bodyRows.some((row) => {
      const cells = Array.from(row.querySelectorAll('td,th'));
      return cells.some((cell) => {
        const text = (cell.textContent || '').replace(/\u00a0/g, ' ').trim();
        if (!text) return false;
        if (/^\{\{[^}]+\}\}$/.test(text)) return true;
        if (cell.querySelector('[data-tms-merge]')) return true;
        const lower = text.toLowerCase();
        return ['system', 'site', 'battery', 'inverter', 'pv'].includes(lower);
      });
    });
    if (hasDesignedContent) return;

    const allBlank = bodyRows.every((row) =>
      Array.from(row.querySelectorAll('td,th')).every((cell) => {
        const text = (cell.textContent || '').replace(/\u00a0/g, ' ').trim();
        return !text;
      }),
    );
    if (!allBlank) return;

    bodyRows.forEach((row) => row.remove());

    const tbody = table.querySelector('tbody') || table;
    lineItems.forEach((item) => {
      const tr = doc.createElement('tr');
      const values =
        colCount <= 2
          ? [item.description, item.total]
          : [item.description, `${item.quantity} × ${item.unit_price}`, item.total];

      for (let i = 0; i < colCount; i += 1) {
        const td = doc.createElement('td');
        td.textContent = values[i] ?? '';
        td.style.padding = '8px 10px';
        td.style.borderBottom = '1px solid #e2e8f0';
        td.style.fontSize = '13px';
        td.style.color = '#1e293b';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  });

  return root.innerHTML;
}

async function generateTemplatePdf(
  template: DbTemplate,
  quote: Quote,
  mergeData: Record<string, unknown>,
): Promise<PdfGenerationResult> {
  try {
    let htmlContent = template.html_content;
    htmlContent = rewriteLegacyInstallerSignaturePads(htmlContent);

    let mergedHtml = mergeTemplate(htmlContent, mergeData);
    // Fill linked pills that were left as data-tms-merge in saved HTML
    mergedHtml = applyLiveMergeAttributes(mergedHtml, mergeData);
    // Run {{tags}} again in case live merge left any
    mergedHtml = mergeTemplate(mergedHtml, mergeData);

    const details = getDocumentDetails(quote.customer);
    const signatureDataUrl =
      details.installerSignature ||
      String(mergeData.installer_signature || '');
    if (signatureDataUrl) {
      mergedHtml = injectInstallerSignatureImage(
        mergedHtml,
        signatureDataUrl,
        String(mergeData.technical_op || mergeData.installer_name || ''),
      );
    }
    mergedHtml = injectLineItemsIntoEmptyTables(
      mergedHtml,
      (mergeData.line_items as LineItemMergeRow[]) || [],
    );
    if (template.css_styles) {
      mergedHtml = `<style>${template.css_styles}</style>${mergedHtml}`;
    }

    const pdfBlob = await generatePDFFromHTML(
      mergedHtml,
      `${template.code}-${quote.id}.pdf`,
    );

    const storagePath = `proposals/${quote.id}/${template.code}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from('documents').getPublicUrl(storagePath);

    return {
      success: true,
      fileUrl: publicUrl,
      fileName: `${template.code} - ${template.name}.pdf`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'PDF generation failed';
    console.error(`Error generating ${template.code}:`, error);
    return { success: false, error: message };
  }
}

/**
 * Generate all proposal-pack PDFs from active admin templates
 * (category = proposal, auto_generate = true, is_active = true).
 */
export async function generateAllProposalPdfs(
  quote: Quote,
  companyId: string,
): Promise<{
  success: boolean;
  generatedPdfs: Array<{ fileUrl: string; fileName: string; code: string }>;
  errors: string[];
}> {
  console.log('🎨 Starting PDF generation for quote:', quote.id);
  const generatedPdfs: Array<{ fileUrl: string; fileName: string; code: string }> = [];
  const errors: string[] = [];

  const { data: companyData, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (companyError || !companyData) {
    return {
      success: false,
      generatedPdfs: [],
      errors: ['Company data not found'],
    };
  }

  const { data: templates, error: templatesError } = await supabase
    .from('document_templates')
    .select('id, code, name, html_content, css_styles, technologies, builder_state')
    .eq('category', 'proposal')
    .eq('is_active', true)
    .eq('auto_generate', true)
    .order('code');

  if (templatesError) {
    return {
      success: false,
      generatedPdfs: [],
      errors: [templatesError.message],
    };
  }

  if (!templates?.length) {
    return {
      success: false,
      generatedPdfs: [],
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
      success: false,
      generatedPdfs: [],
      errors: [
        `No proposal templates match this quote’s technology (${quoteTechs.join(', ')}).`,
      ],
    };
  }

  const mergeData = buildQuoteMergeData(quote, companyData);

  for (const template of matchingTemplates as DbTemplate[]) {
    if (!template.html_content?.trim()) {
      errors.push(`${template.code}: template has no HTML content`);
      continue;
    }

    console.log(`📄 Generating ${template.code} - ${template.name}...`);
    const result = await generateTemplatePdf(template, quote, mergeData);

    if (result.success && result.fileUrl) {
      generatedPdfs.push({
        fileUrl: result.fileUrl,
        fileName: result.fileName!,
        code: template.code,
      });
    } else {
      errors.push(`${template.code}: ${result.error}`);
    }
  }

  return {
    success: generatedPdfs.length > 0,
    generatedPdfs,
    errors,
  };
}

/**
 * Generate the final PDF for one living document after all roles finished.
 * Merges quote data + living responses into the HTML snapshot.
 */
export async function finalizeLivingDocumentPdf(
  livingDoc: {
    id: string;
    quoteId: string;
    templateCode: string;
    name: string;
    htmlSnapshot: string;
    responses: Record<string, string | boolean | null>;
  },
  quote: Quote,
  companyId: string,
): Promise<{
  success: boolean;
  fileUrl?: string;
  fileName?: string;
  documentId?: string;
  error?: string;
}> {
  try {
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (companyError || !companyData) {
      return { success: false, error: 'Company data not found' };
    }

    const mergeData: Record<string, unknown> = {
      ...buildQuoteMergeData(quote, companyData),
      ...livingDoc.responses,
    };

    const template: DbTemplate = {
      id: livingDoc.id,
      code: livingDoc.templateCode,
      name: livingDoc.name,
      html_content: livingDoc.htmlSnapshot,
      css_styles: null,
    };

    const result = await generateTemplatePdf(template, quote, mergeData);
    if (!result.success || !result.fileUrl) {
      return { success: false, error: result.error || 'PDF failed' };
    }

    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        name: result.fileName,
        description: `Final ${livingDoc.templateCode} for quote ${quote.id.slice(0, 8)}`,
        category: 'proposal_pdf',
        file_url: result.fileUrl,
        file_name: result.fileName,
        version: 1,
      })
      .select('id')
      .single();

    if (docError || !docData) {
      return {
        success: true,
        fileUrl: result.fileUrl,
        fileName: result.fileName,
        error: docError?.message,
      };
    }

    await supabase.from('quote_documents').insert({
      quote_id: quote.id,
      document_id: docData.id,
    });

    await supabase
      .from('quote_living_documents')
      .update({
        status: 'completed',
        pending_role: 'done',
        pdf_document_id: docData.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', livingDoc.id);

    return {
      success: true,
      fileUrl: result.fileUrl,
      fileName: result.fileName,
      documentId: docData.id,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Finalize failed';
    return { success: false, error: message };
  }
}

function generateSystemSummary(quote: Quote): string {
  const items = quote.lineItems || [];
  const batteries = items.filter((item) => item.type === 'battery');
  const inverters = items.filter((item) => item.type === 'inverter');

  const parts: string[] = [];

  if (batteries.length > 0) {
    parts.push(`Battery: ${batteries.map((b) => b.description).join(', ')}`);
  }

  if (inverters.length > 0) {
    parts.push(`Inverter: ${inverters.map((i) => i.description).join(', ')}`);
  }

  parts.push(quote.installationType || 'Battery Storage System');

  return parts.join(' · ');
}

function getBatteryCapacity(quote: Quote): number {
  const batteries = (quote.lineItems || []).filter((item) => item.type === 'battery');
  let totalCapacity = 0;

  batteries.forEach((battery) => {
    const match = battery.description.match(/(\d+\.?\d*)\s*kWh/i);
    if (match) {
      totalCapacity += parseFloat(match[1]) * (battery.quantity || 1);
      return;
    }
    // Some catalogs put capacity in brackets or after a dash: "SolaX BAT1 (5.8)"
    const soft = battery.description.match(/\((\d+\.?\d*)\)/);
    if (soft) {
      totalCapacity += parseFloat(soft[1]) * (battery.quantity || 1);
    }
  });

  return totalCapacity;
}

function formatBatteryCapacity(
  capacity: number,
  quote: Quote,
): { raw: string; labelled: string } {
  if (capacity) {
    return { raw: `${capacity}`, labelled: `${capacity} kWh` };
  }
  const batteries = (quote.lineItems || []).filter((item) => item.type === 'battery');
  if (batteries.length) {
    const label = batteries
      .map((b) => (b.quantity > 1 ? `${b.quantity}× ${b.description}` : b.description))
      .join(', ');
    return { raw: label, labelled: label };
  }
  return { raw: '—', labelled: '—' };
}

function calculateEstimatedSavings(capacityKwh: number) {
  const cyclesPerYear = 250;
  const savingsPerCycle = capacityKwh * 0.25;
  const annualSavings = savingsPerCycle * cyclesPerYear;
  const systemCost = capacityKwh * 800;
  const paybackYears = Math.ceil(systemCost / annualSavings);
  const lifetimeSavings = annualSavings * 25;

  return {
    annual: annualSavings,
    monthly: annualSavings / 12,
    paybackYears,
    lifetime: lifetimeSavings,
  };
}
