import { supabase } from '../lib/supabase';
import { generatePDFFromHTML } from '../utils/pdfGenerator';
import type { Quote } from '../types';

interface PdfGenerationResult {
  success: boolean;
  fileUrl?: string;
  fileName?: string;
  error?: string;
}

/**
 * Generate FO7A - Covering Letter PDF
 */
export async function generateCoveringLetterPdf(
  quote: Quote,
  companyData: any
): Promise<PdfGenerationResult> {
  try {
    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from('document_templates')
      .select('*')
      .eq('code', 'FO7A')
      .single();

    if (templateError || !template) {
      throw new Error('FO7A template not found');
    }

    // Calculate battery capacity
    const batteryCapacity = getBatteryCapacity(quote);
    
    // Prepare merge data
    const mergeData = {
      current_date: new Date().toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      }),
      customer_name: quote.customer.name,
      customer_address: quote.customer.address,
      quote_reference: quote.id.slice(0, 8).toUpperCase(),
      company_name: companyData.name || 'Your Company',
      company_logo: companyData.logo_url || '',
      company_email: companyData.contactEmail || companyData.email || '',
      company_phone: companyData.contactPhone || companyData.phone || '',
      battery_capacity: `${batteryCapacity}`,
      quote_total: `£${quote.total.toFixed(2)}`,
      deposit_amount: `£${quote.deposit.toFixed(2)}`,
      final_balance: `£${(quote.total - quote.deposit).toFixed(2)}`,
      company_contact: `${companyData.contactEmail || companyData.email || ''} | ${companyData.contactPhone || companyData.phone || ''}`,
    };

    // Generate PDF - merge template with data first
    let mergedHtml = template.html_content;
    Object.keys(mergeData).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      mergedHtml = mergedHtml.replace(regex, String(mergeData[key] || ''));
    });
    
    const pdfBlob = await generatePDFFromHTML(mergedHtml, `FO7A-Covering-Letter-${quote.id}.pdf`);

    // Upload to Supabase Storage
    const fileName = `proposals/${quote.id}/FO7A-Covering-Letter-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    return {
      success: true,
      fileUrl: publicUrl,
      fileName: 'FO7A - Covering Letter.pdf',
    };
  } catch (error: any) {
    console.error('Error generating covering letter:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Generate F13I - Contract of Sale PDF
 */
export async function generateContractOfSalePdf(
  quote: Quote,
  companyData: any
): Promise<PdfGenerationResult> {
  try {
    const { data: template, error: templateError } = await supabase
      .from('document_templates')
      .select('*')
      .eq('code', 'F13I')
      .single();

    if (templateError || !template) {
      throw new Error('F13I template not found');
    }

    const depositPercentage = Math.round((quote.deposit / quote.total) * 100);
    const mergeData = {
      contract_date: new Date().toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      }),
      customer_name: quote.customer.name,
      customer_address: quote.customer.address,
      customer_email: quote.customer.email,
      customer_phone: quote.customer.phone,
      quote_reference: quote.id.slice(0, 8).toUpperCase(),
      company_name: companyData.name || 'Your Company',
      company_address: companyData.address || 'Company Address Not Set',
      company_registration: companyData.registrationNumber || companyData.registration_number || 'N/A',
      system_description: generateSystemSummary(quote),
      total_price: `£${quote.total.toFixed(2)}`,
      deposit_amount: `£${quote.deposit.toFixed(2)}`,
      deposit_percentage: `${depositPercentage}%`,
      final_balance: `£${(quote.total - quote.deposit).toFixed(2)}`,
      payment_method: 'Bank Transfer / Card Payment',
      warranty_period: '10 years',
      completion_timeframe: '4-6 weeks from deposit payment',
    };

    // Generate PDF - merge template with data first
    let mergedHtml = template.html_content;
    Object.keys(mergeData).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      mergedHtml = mergedHtml.replace(regex, String(mergeData[key] || ''));
    });
    
    const pdfBlob = await generatePDFFromHTML(mergedHtml, `F13I-Contract-${quote.id}.pdf`);

    const fileName = `proposals/${quote.id}/F13I-Contract-of-Sale-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    return {
      success: true,
      fileUrl: publicUrl,
      fileName: 'F13I - Contract of Sale.pdf',
    };
  } catch (error: any) {
    console.error('Error generating contract:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Generate F71 - Performance Estimate PDF
 */
export async function generatePerformanceEstimatePdf(
  quote: Quote,
  companyData: any
): Promise<PdfGenerationResult> {
  try {
    const { data: template, error: templateError } = await supabase
      .from('document_templates')
      .select('*')
      .eq('code', 'F71')
      .single();

    if (templateError || !template) {
      throw new Error('F71 template not found');
    }

    // Calculate performance estimates (simplified)
    const batteryCapacity = getBatteryCapacity(quote);
    const estimatedSavings = calculateEstimatedSavings(batteryCapacity);

    const mergeData = {
      report_date: new Date().toLocaleDateString('en-GB'),
      customer_name: quote.customer.name,
      installation_address: quote.customer.address,
      quote_reference: quote.id.slice(0, 8).toUpperCase(),
      battery_capacity: `${batteryCapacity} kWh`,
      estimated_cycles_per_year: '250',
      estimated_annual_savings: `£${estimatedSavings.annual.toFixed(2)}`,
      estimated_monthly_savings: `£${estimatedSavings.monthly.toFixed(2)}`,
      payback_period: `${estimatedSavings.paybackYears} years`,
      system_lifetime: '25 years',
      total_lifetime_savings: `£${estimatedSavings.lifetime.toFixed(2)}`,
      co2_reduction: `${(batteryCapacity * 0.5 * 250).toFixed(0)} kg/year`,
      system_efficiency: '95%',
    };

    // Generate PDF - merge template with data first
    let mergedHtml = template.html_content;
    Object.keys(mergeData).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      mergedHtml = mergedHtml.replace(regex, String(mergeData[key] || ''));
    });
    
    const pdfBlob = await generatePDFFromHTML(mergedHtml, `F71-Performance-${quote.id}.pdf`);

    const fileName = `proposals/${quote.id}/F71-Performance-Estimate-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    return {
      success: true,
      fileUrl: publicUrl,
      fileName: 'F71 - Performance Estimate.pdf',
    };
  } catch (error: any) {
    console.error('Error generating performance estimate:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Generate Full Quote PDF
 */
export async function generateQuotePdf(
  quote: Quote,
  companyData: any
): Promise<PdfGenerationResult> {
  try {
    // Build HTML for quote
    const quoteHtml = buildQuoteHtml(quote, companyData);

    const pdfBlob = await generatePDFFromHTML(quoteHtml, `Quote-${quote.id}.pdf`);

    const fileName = `proposals/${quote.id}/Quote-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    return {
      success: true,
      fileUrl: publicUrl,
      fileName: 'Battery Storage Quotation.pdf',
    };
  } catch (error: any) {
    console.error('Error generating quote PDF:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Generate all proposal pack PDFs
 */
export async function generateAllProposalPdfs(
  quote: Quote,
  companyId: string
): Promise<{
  success: boolean;
  generatedPdfs: Array<{ fileUrl: string; fileName: string; code: string }>;
  errors: string[];
}> {
  console.log('🎨 Starting PDF generation for quote:', quote.id);
  const generatedPdfs: Array<{ fileUrl: string; fileName: string; code: string }> = [];
  const errors: string[] = [];

  // Fetch company data
  const { data: companyData } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (!companyData) {
    console.error('❌ Company data not found for:', companyId);
    return {
      success: false,
      generatedPdfs: [],
      errors: ['Company data not found'],
    };
  }
  
  console.log('✅ Company data loaded:', companyData.name);

  // Generate FO7A
  console.log('📄 Generating FO7A - Covering Letter...');
  const fo7aResult = await generateCoveringLetterPdf(quote, companyData);
  if (fo7aResult.success && fo7aResult.fileUrl) {
    console.log('✅ FO7A generated successfully');
    generatedPdfs.push({
      fileUrl: fo7aResult.fileUrl,
      fileName: fo7aResult.fileName!,
      code: 'FO7A',
    });
  } else {
    console.error('❌ FO7A failed:', fo7aResult.error);
    errors.push(`FO7A: ${fo7aResult.error}`);
  }

  // Generate F13I
  console.log('📄 Generating F13I - Contract of Sale...');
  const f13iResult = await generateContractOfSalePdf(quote, companyData);
  if (f13iResult.success && f13iResult.fileUrl) {
    console.log('✅ F13I generated successfully');
    generatedPdfs.push({
      fileUrl: f13iResult.fileUrl,
      fileName: f13iResult.fileName!,
      code: 'F13I',
    });
  } else {
    console.error('❌ F13I failed:', f13iResult.error);
    errors.push(`F13I: ${f13iResult.error}`);
  }

  // Generate F71
  console.log('📄 Generating F71 - Performance Estimate...');
  const f71Result = await generatePerformanceEstimatePdf(quote, companyData);
  if (f71Result.success && f71Result.fileUrl) {
    console.log('✅ F71 generated successfully');
    generatedPdfs.push({
      fileUrl: f71Result.fileUrl,
      fileName: f71Result.fileName!,
      code: 'F71',
    });
  } else {
    console.error('❌ F71 failed:', f71Result.error);
    errors.push(`F71: ${f71Result.error}`);
  }

  // Generate Quote PDF
  console.log('📄 Generating Quote PDF...');
  const quotePdfResult = await generateQuotePdf(quote, companyData);
  if (quotePdfResult.success && quotePdfResult.fileUrl) {
    console.log('✅ Quote PDF generated successfully');
    generatedPdfs.push({
      fileUrl: quotePdfResult.fileUrl,
      fileName: quotePdfResult.fileName!,
      code: 'QUOTE',
    });
  } else {
    console.error('❌ Quote PDF failed:', quotePdfResult.error);
    errors.push(`Quote PDF: ${quotePdfResult.error}`);
  }

  console.log(`🎉 PDF Generation complete! Generated: ${generatedPdfs.length}, Errors: ${errors.length}`);
  console.log('Generated PDFs:', generatedPdfs.map(p => p.code).join(', '));
  if (errors.length > 0) {
    console.error('Errors:', errors);
  }
  
  return {
    success: generatedPdfs.length > 0,
    generatedPdfs,
    errors,
  };
}

// Helper functions

function generateSystemSummary(quote: Quote): string {
  const items = quote.lineItems || [];
  const batteries = items.filter(item => item.type === 'battery');
  const inverters = items.filter(item => item.type === 'inverter');
  
  let summary = '';
  
  if (batteries.length > 0) {
    summary += `Battery: ${batteries.map(b => b.description).join(', ')}\n`;
  }
  
  if (inverters.length > 0) {
    summary += `Inverter: ${inverters.map(i => i.description).join(', ')}\n`;
  }
  
  summary += `Installation Type: ${quote.installationType || 'Battery Storage System'}`;
  
  return summary;
}

function getBatteryCapacity(quote: Quote): number {
  const batteries = (quote.lineItems || []).filter(item => item.type === 'battery');
  // Extract capacity from description (e.g., "Tesla Powerwall 2 - 13.5kWh" -> 13.5)
  let totalCapacity = 0;
  
  batteries.forEach(battery => {
    const match = battery.description.match(/(\d+\.?\d*)\s*kWh/i);
    if (match) {
      totalCapacity += parseFloat(match[1]) * battery.quantity;
    }
  });
  
  return totalCapacity || 10; // Default to 10kWh if not found
}

function calculateEstimatedSavings(capacityKwh: number) {
  // Simplified calculations
  const cyclesPerYear = 250;
  const savingsPerCycle = capacityKwh * 0.25; // £0.25 per kWh saved
  const annualSavings = savingsPerCycle * cyclesPerYear;
  const systemCost = capacityKwh * 800; // Rough estimate
  const paybackYears = Math.ceil(systemCost / annualSavings);
  const lifetimeSavings = annualSavings * 25; // 25 year lifespan
  
  return {
    annual: annualSavings,
    monthly: annualSavings / 12,
    paybackYears: paybackYears,
    lifetime: lifetimeSavings,
  };
}

function buildQuoteHtml(quote: Quote, companyData: any): string {
  const depositPercentage = Math.round((quote.deposit / quote.total) * 100);
  const lineItemsHtml = (quote.lineItems || []).map(item => {
    const itemTotal = item.quantity * item.unitPrice;
    return `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${item.description}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">£${item.unitPrice.toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">£${itemTotal.toFixed(2)}</td>
    </tr>
  `;
  }).join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">
      <div style="text-align: center; margin-bottom: 40px;">
        ${companyData.logo_url ? `<img src="${companyData.logo_url}" alt="Logo" style="max-width: 200px; margin-bottom: 20px;">` : ''}
        <h1 style="color: #1e40af; margin: 0; font-size: 32px;">Battery Storage Quotation</h1>
        <p style="color: #64748b; margin: 10px 0;">Quote Reference: ${quote.id.slice(0, 8).toUpperCase()}</p>
      </div>

      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <h2 style="color: #1e40af; margin-top: 0;">Customer Details</h2>
        <p style="margin: 5px 0;"><strong>Name:</strong> ${quote.customer.name}</p>
        <p style="margin: 5px 0;"><strong>Email:</strong> ${quote.customer.email}</p>
        <p style="margin: 5px 0;"><strong>Phone:</strong> ${quote.customer.phone}</p>
        <p style="margin: 5px 0;"><strong>Address:</strong> ${quote.customer.address}</p>
      </div>

      <h2 style="color: #1e40af;">Quote Details</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #cbd5e1;">Item</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #cbd5e1;">Qty</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #cbd5e1;">Unit Price</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #cbd5e1;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHtml}
        </tbody>
      </table>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #cbd5e1;">
        <div style="display: flex; justify-content: space-between; margin: 10px 0;">
          <span>Subtotal:</span>
          <span>£${quote.subtotal.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 10px 0;">
          <span>VAT (${quote.vatRate}%):</span>
          <span>£${quote.vatAmount.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 20px 0; font-size: 20px; font-weight: bold; color: #1e40af;">
          <span>Total:</span>
          <span>£${quote.total.toFixed(2)}</span>
        </div>
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span><strong>Deposit (${depositPercentage}%):</strong></span>
            <span><strong>£${quote.deposit.toFixed(2)}</strong></span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span>Final Balance:</span>
            <span>£${(quote.total - quote.deposit).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div style="margin-top: 40px; padding: 20px; background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px;">
        <p style="margin: 0; color: #475569;"><strong>Valid Until:</strong> ${quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('en-GB') : 'N/A'}</p>
        <p style="margin: 10px 0 0 0; color: #475569;"><strong>Company:</strong> ${companyData.name}</p>
      </div>
    </div>
  `;
}
