// @ts-nocheck - PDF generation utilities
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Quote, Company, DocumentTemplate } from '../types';

/**
 * Merge template with data
 */
export function mergeTemplate(htmlContent: string, data: Record<string, any>): string {
  let merged = htmlContent;

  // Expand array blocks first so nested {{keys}} resolve from item rows,
  // and so String(array) never pollutes simple replacements.
  const arrayRegex = /{{#(\w+)}}([\s\S]*?){{\/\1}}/g;
  merged = merged.replace(arrayRegex, (_match, arrayName, content) => {
    const arrayData = data[arrayName];
    if (!Array.isArray(arrayData)) return '';

    return arrayData
      .map((item) => {
        let itemContent = content;
        Object.keys(item || {}).forEach((key) => {
          const itemRegex = new RegExp(`{{${key}}}`, 'g');
          itemContent = itemContent.replace(itemRegex, String(item[key] ?? ''));
        });
        return itemContent;
      })
      .join('');
  });

  Object.keys(data).forEach((key) => {
    if (Array.isArray(data[key])) return;
    const regex = new RegExp(`{{${key}}}`, 'g');
    const value = data[key] !== null && data[key] !== undefined ? String(data[key]) : '';
    merged = merged.replace(regex, value);
  });

  return merged;
}

/**
 * Generate merge data from quote and company
 */
export function generateMergeData(quote: Quote, company: Company): Record<string, any> {
  const battery = quote.lineItems.find(li => li.type === 'battery');
  const batteryCapacity = battery ? 
    parseFloat(battery.description.match(/(\d+\.?\d*)\s*kWh/i)?.[1] || '0') : 0;
  
  const subtotal = quote.total / 1.20; // Remove VAT to get subtotal
  const vat = quote.total - subtotal;
  const balance = quote.total - quote.deposit;
  
  return {
    // Company Info
    company_name: company.name,
    company_logo:
      company.logo ||
      `${typeof window !== 'undefined' ? window.location.origin : ''}/assets/Main heliOS Logo.png`,
    company_email: company.email || '',
    company_phone: company.phone || '',
    company_address: company.address || '',
    company_website: company.website || '',
    
    // Customer Info
    customer_name: quote.customerName,
    customer_email: quote.customerEmail,
    customer_phone: quote.customerPhone || '',
    customer_address: quote.customerAddress || '',
    
    // Quote Info
    quote_reference: quote.reference,
    quote_total: quote.total.toFixed(2),
    subtotal: subtotal.toFixed(2),
    vat: vat.toFixed(2),
    deposit_amount: quote.deposit.toFixed(2),
    balance_amount: balance.toFixed(2),
    
    // System Info
    battery_capacity: batteryCapacity.toFixed(1),
    
    // Line Items
    line_items: quote.lineItems.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice.toFixed(2),
      total: item.total.toFixed(2),
    })),
    
    // Date
    current_date: new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    
    // Payment Method (default)
    payment_method: 'Bank Transfer / Card Payment',
  };
}

/**
 * Scan a horizontal row of pixels and return true if it contains no significant
 * content (text, icons, borders). Light backgrounds are treated as blank.
 * Samples the central 60% of the row to ignore sidebar borders or decorations.
 */
function isRowBlank(ctx: CanvasRenderingContext2D, y: number, canvasWidth: number): boolean {
  const startX = Math.floor(canvasWidth * 0.15);
  const sampleWidth = Math.floor(canvasWidth * 0.7);
  const imageData = ctx.getImageData(startX, y, sampleWidth, 1);
  const data = imageData.data;

  let darkPixels = 0;
  const totalPixels = sampleWidth;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 210 || data[i + 1] < 210 || data[i + 2] < 210) {
      darkPixels++;
    }
  }

  return darkPixels / totalPixels < 0.02;
}

/**
 * Find a safe vertical cut point near the ideal page boundary.
 * Scans upward from the ideal cut to find a horizontal gap between content
 * (consecutive rows without text/borders).
 */
function findSafeCutY(
  ctx: CanvasRenderingContext2D,
  idealCutY: number,
  canvasWidth: number,
  canvasHeight: number,
  minY: number
): number {
  const scanRange = Math.floor((idealCutY - minY) * 0.4);
  const scanLimit = Math.max(idealCutY - scanRange, minY);
  const requiredGap = 3;

  let consecutiveBlanks = 0;

  for (let y = Math.min(idealCutY, canvasHeight - 1); y > scanLimit; y--) {
    if (isRowBlank(ctx, y, canvasWidth)) {
      consecutiveBlanks++;
      if (consecutiveBlanks >= requiredGap) {
        return y + Math.floor(requiredGap / 2);
      }
    } else {
      consecutiveBlanks = 0;
    }
  }

  return idealCutY;
}

/**
 * html2canvas clips text inside <input>/<textarea>. Convert them to static
 * elements before capture so PDF text is not vertically cut off.
 */
function flattenFormControlsForPdf(root: HTMLElement) {
  root.querySelectorAll('input, textarea').forEach((el) => {
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    const type = ('type' in input ? String(input.type || 'text') : 'text').toLowerCase();
    if (type === 'checkbox' || type === 'radio' || type === 'hidden' || type === 'file') return;

    const replacement = document.createElement('div');
    replacement.textContent = input.value || '';
    const existing = input.getAttribute('style') || '';
    const isTextarea = el.tagName === 'TEXTAREA';
    replacement.setAttribute(
      'style',
      [
        existing,
        'display:block',
        'width:100%',
        'height:auto',
        'min-height:0',
        'overflow:visible',
        'border:none',
        'background:transparent',
        'padding:0',
        'resize:none',
        `white-space:${isTextarea ? 'pre-wrap' : 'normal'}`,
        'line-height:1.45',
        'box-sizing:border-box',
      ].join(';')
    );
    el.replaceWith(replacement);
  });

  root.querySelectorAll('.tms-section').forEach((sec) => {
    (sec as HTMLElement).style.overflow = 'visible';
  });
}

const DEFAULT_PDF_LOGO = '/assets/Main heliOS Logo.png';

/**
 * html2canvas often drops remote logos (CORS / empty src). Convert every
 * real <img> to a data URL before capture so letterheads survive PDF export.
 */
async function inlineImagesForPdf(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  const fallbackLogo = new URL(DEFAULT_PDF_LOGO, window.location.origin).href;

  await Promise.all(
    images.map(async (img) => {
      const rawSrc = (img.getAttribute('src') || '').trim();
      let src = rawSrc;

      if (
        !src ||
        src === '{{company_logo}}' ||
        /^\{\{.*\}\}$/.test(src) ||
        src === 'undefined' ||
        src === 'null'
      ) {
        src = fallbackLogo;
      }

      if (src.startsWith('data:')) {
        img.setAttribute('src', src);
        return;
      }

      try {
        const absolute = new URL(src, window.location.origin).href;
        const response = await fetch(absolute, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (dataUrl) img.setAttribute('src', dataUrl);
      } catch {
        if (src !== fallbackLogo) {
          try {
            const response = await fetch(fallbackLogo, { mode: 'cors', credentials: 'omit' });
            if (!response.ok) return;
            const blob = await response.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ''));
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            if (dataUrl) img.setAttribute('src', dataUrl);
          } catch {
            // Leave original src if fallback also fails
          }
        }
      }
    }),
  );

  // Give the browser a tick to decode swapped images
  await Promise.all(
    Array.from(root.querySelectorAll('img')).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );
}

/**
 * Generate PDF from HTML content
 */
export async function generatePDFFromHTML(
  htmlContent: string,
  filename: string = 'document.pdf'
): Promise<Blob> {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '210mm';
  container.style.padding = '15mm 18mm';
  container.style.boxSizing = 'border-box';
  container.style.backgroundColor = 'white';
  container.style.color = '#1e293b';
  container.style.fontSize = '14px';
  container.style.lineHeight = '1.6';
  container.innerHTML = htmlContent;
  flattenFormControlsForPdf(container);
  document.body.appendChild(container);

  try {
    await inlineImagesForPdf(container);

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 15000,
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfPageW = 210;
    const pdfPageH = 297;
    const pxPerMm = canvas.width / pdfPageW;
    const pageHPx = Math.floor(pdfPageH * pxPerMm);
    const topPadPx = Math.floor(10 * pxPerMm);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');

    let yOffset = 0;
    let isFirstPage = true;

    while (yOffset < canvas.height) {
      let sliceH: number;

      if (yOffset + pageHPx >= canvas.height) {
        sliceH = canvas.height - yOffset;
      } else {
        const safeCutY = findSafeCutY(ctx, yOffset + pageHPx, canvas.width, canvas.height, yOffset);
        sliceH = safeCutY - yOffset;
      }

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = isFirstPage ? sliceH : sliceH + topPadPx;
      const pCtx = pageCanvas.getContext('2d')!;
      pCtx.fillStyle = '#ffffff';
      pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      pCtx.drawImage(
        canvas,
        0, yOffset, canvas.width, sliceH,
        0, isFirstPage ? 0 : topPadPx, canvas.width, sliceH
      );

      if (!isFirstPage) pdf.addPage();

      const sliceImgData = pageCanvas.toDataURL('image/png');
      const sliceHMm = (pageCanvas.height / pxPerMm);
      pdf.addImage(sliceImgData, 'PNG', 0, 0, pdfPageW, sliceHMm);

      yOffset += sliceH;
      isFirstPage = false;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Generate PDF from template
 */
export async function generatePDFFromTemplate(
  template: DocumentTemplate,
  mergeData: Record<string, any>,
  filename?: string
): Promise<Blob> {
  // Merge template with data
  const mergedHTML = mergeTemplate(template.htmlContent, mergeData);
  
  // Add CSS if provided
  const fullHTML = template.cssStyles
    ? `<style>${template.cssStyles}</style>${mergedHTML}`
    : mergedHTML;
  
  // Generate PDF
  const pdfFilename = filename || `${template.code}-${Date.now()}.pdf`;
  return generatePDFFromHTML(fullHTML, pdfFilename);
}

/**
 * Download PDF blob
 */
export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Upload PDF to Supabase Storage
 */
export async function uploadPDFToStorage(
  supabase: any,
  blob: Blob,
  path: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(path, blob, {
      contentType: 'application/pdf',
      upsert: true,
    });
  
  if (error) throw error;
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('documents')
    .getPublicUrl(path);
  
  return publicUrl;
}

/**
 * Generate and save all proposal pack documents for a quote
 */
export async function generateProposalPack(
  supabase: any,
  quote: Quote,
  company: Company,
  templates: DocumentTemplate[]
): Promise<string[]> {
  const mergeData = generateMergeData(quote, company);
  const generatedUrls: string[] = [];
  
  // Filter templates that should be auto-generated for proposals
  const proposalTemplates = templates.filter(
    t => t.category === 'proposal' && t.autoGenerate && t.isActive
  );
  
  for (const template of proposalTemplates) {
    try {
      // Generate PDF
      const pdfBlob = await generatePDFFromTemplate(template, mergeData);
      
      // Upload to storage
      const filename = `${quote.id}/${template.code}-${Date.now()}.pdf`;
      const publicUrl = await uploadPDFToStorage(supabase, pdfBlob, filename);
      
      // Save to generated_documents table
      await supabase.from('generated_documents').insert({
        template_id: template.id,
        quote_id: quote.id,
        file_name: `${template.code}.pdf`,
        file_url: publicUrl,
        file_size: pdfBlob.size,
        merge_data: mergeData,
      });
      
      generatedUrls.push(publicUrl);
    } catch (error) {
      console.error(`Error generating ${template.code}:`, error);
    }
  }
  
  return generatedUrls;
}
