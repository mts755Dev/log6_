import jsPDF from 'jspdf';
import type { Quote } from '../types';
import { format } from 'date-fns';

export async function generateQuotePDF(quote: Quote, companyName: string): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  // Professional Color Palette
  const colors = {
    primary: [63, 192, 235] as [number, number, number],     // Cyan #3fc0eb
    primaryDark: [26, 168, 214] as [number, number, number], // Dark cyan
    success: [34, 197, 94] as [number, number, number],      // Green
    solar: [245, 158, 11] as [number, number, number],       // Amber
    dark: [15, 23, 42] as [number, number, number],          // Slate 900
    text: [51, 65, 85] as [number, number, number],          // Slate 700
    muted: [100, 116, 139] as [number, number, number],      // Slate 500
    light: [241, 245, 249] as [number, number, number],      // Slate 100
    white: [255, 255, 255] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],     // Slate 200
  };

  // Helper: Draw text
  const text = (content: string, x: number, y: number, options?: { 
    size?: number; 
    color?: [number, number, number]; 
    bold?: boolean;
    align?: 'left' | 'center' | 'right';
    maxWidth?: number;
  }) => {
    const { size = 10, color = colors.text, bold = false, align = 'left', maxWidth } = options || {};
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    
    let xPos = x;
    if (align === 'center') xPos = pageWidth / 2;
    else if (align === 'right') xPos = pageWidth - margin;
    
    if (maxWidth) {
      const lines = doc.splitTextToSize(content, maxWidth);
      doc.text(lines, xPos, y, { align });
      return lines.length * (size * 0.4);
    }
    
    doc.text(content, xPos, y, { align });
    return size * 0.4;
  };

  // Helper: Draw rectangle
  const rect = (x: number, y: number, w: number, h: number, color: [number, number, number], radius?: number) => {
    doc.setFillColor(...color);
    if (radius) {
      doc.roundedRect(x, y, w, h, radius, radius, 'F');
    } else {
      doc.rect(x, y, w, h, 'F');
    }
  };

  // Helper: Draw line
  const line = (y: number, color: [number, number, number] = colors.border, width = 0.3) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(margin, y, pageWidth - margin, y);
  };

  // Helper: Draw outlined rectangle
  const outlineRect = (x: number, y: number, w: number, h: number, color: [number, number, number], radius = 3) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, w, h, radius, radius, 'S');
  };

  // ============================================================
  // PAGE 1: COVER & SUMMARY
  // ============================================================

  // Top accent bar
  rect(0, 0, pageWidth, 8, colors.primary);

  yPos = 25;

  // Logo and Company
  text('Logi6', margin, yPos, { size: 28, color: colors.primaryDark, bold: true });
  text('Battery Storage Solutions', margin, yPos + 8, { size: 10, color: colors.muted });

  // Quote reference badge
  const refWidth = 50;
  rect(pageWidth - margin - refWidth, yPos - 8, refWidth, 18, colors.light, 4);
  text(quote.reference, pageWidth - margin - refWidth + 8, yPos, { size: 11, color: colors.dark, bold: true });

  yPos = 55;

  // Elegant divider
  line(yPos, colors.primary, 1);

  yPos = 70;

  // Document Title
  text('Battery Storage', 0, yPos, { size: 32, color: colors.dark, bold: true, align: 'center' });
  text('Proposal', 0, yPos + 12, { size: 32, color: colors.primary, bold: true, align: 'center' });

  yPos = 105;

  // Prepared for section - elegant card style
  const cardY = yPos;
  const cardHeight = 55;
  rect(margin, cardY, pageWidth - margin * 2, cardHeight, colors.light, 6);
  
  // Left side - Customer
  text('PREPARED FOR', margin + 15, cardY + 12, { size: 8, color: colors.muted, bold: true });
  text(quote.customer.name, margin + 15, cardY + 22, { size: 14, color: colors.dark, bold: true });
  text(quote.customer.address, margin + 15, cardY + 30, { size: 9, color: colors.text });
  text(quote.customer.postcode, margin + 15, cardY + 37, { size: 9, color: colors.text });
  text(`${quote.customer.email}  •  ${quote.customer.phone}`, margin + 15, cardY + 44, { size: 8, color: colors.muted });

  // Right side - Company
  const midX = pageWidth / 2 + 10;
  text('PREPARED BY', midX, cardY + 12, { size: 8, color: colors.muted, bold: true });
  text(companyName, midX, cardY + 22, { size: 14, color: colors.dark, bold: true });
  text(quote.installerName, midX, cardY + 30, { size: 9, color: colors.text });
  text(`Date: ${format(new Date(quote.createdAt), 'dd MMMM yyyy')}`, midX, cardY + 37, { size: 9, color: colors.text });
  text(`Valid until: ${format(new Date(quote.validUntil), 'dd MMMM yyyy')}`, midX, cardY + 44, { size: 8, color: colors.muted });

  // Vertical divider in card
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.3);
  doc.line(pageWidth / 2, cardY + 8, pageWidth / 2, cardY + cardHeight - 8);

  yPos = cardY + cardHeight + 25;

  // Investment Summary Section
  text('Investment Summary', margin, yPos, { size: 14, color: colors.dark, bold: true });
  yPos += 15;

  // Three summary boxes
  const boxWidth = (pageWidth - margin * 2 - 20) / 3;
  const boxHeight = 50;
  const boxes = [
    { label: 'Total Investment', value: `£${quote.total.toLocaleString()}`, color: colors.primary, icon: '£' },
    { label: 'Annual Savings', value: `£${quote.annualSavings.toLocaleString()}`, color: colors.success, icon: '↑' },
    { label: 'Payback Period', value: `${quote.paybackYears} Years`, color: colors.solar, icon: '⏱' },
  ];

  boxes.forEach((box, i) => {
    const boxX = margin + i * (boxWidth + 10);
    
    // Box background
    rect(boxX, yPos, boxWidth, boxHeight, colors.white, 6);
    outlineRect(boxX, yPos, boxWidth, boxHeight, colors.border, 6);
    
    // Accent line at top
    rect(boxX, yPos, boxWidth, 4, box.color, 2);
    
    // Content
    text(box.label, boxX + 10, yPos + 18, { size: 9, color: colors.muted });
    text(box.value, boxX + 10, yPos + 35, { size: 18, color: box.color, bold: true });
  });

  yPos += boxHeight + 30;

  // Property Information
  text('Property Details', margin, yPos, { size: 14, color: colors.dark, bold: true });
  yPos += 12;

  rect(margin, yPos, pageWidth - margin * 2, 35, colors.light, 4);
  
  const propCol = (pageWidth - margin * 2) / 4;
  const propItems = [
    { label: 'Property Type', value: quote.customer.propertyType.charAt(0).toUpperCase() + quote.customer.propertyType.slice(1) },
    { label: 'Annual Usage', value: `${quote.customer.annualConsumptionKwh.toLocaleString()} kWh` },
    { label: 'Existing Solar', value: quote.customer.existingSolar ? `${quote.customer.solarCapacityKwp} kWp` : 'None' },
    { label: 'Electric Vehicle', value: quote.customer.hasEv ? 'Yes' : 'No' },
  ];

  propItems.forEach((item, i) => {
    const itemX = margin + 10 + i * propCol;
    text(item.label, itemX, yPos + 12, { size: 8, color: colors.muted });
    text(item.value, itemX, yPos + 22, { size: 11, color: colors.dark, bold: true });
  });

  yPos += 50;

  // Tariff Information
  text('Current Tariff', margin, yPos, { size: 14, color: colors.dark, bold: true });
  yPos += 12;

  rect(margin, yPos, pageWidth - margin * 2, 25, colors.light, 4);
  
  const tariffItems = [
    { label: 'Import Rate', value: `${quote.tariff.importRate.toFixed(2)}p/kWh` },
    { label: 'Export Rate', value: `${quote.tariff.exportRate.toFixed(2)}p/kWh` },
    { label: 'Time of Use', value: quote.tariff.hasTimeOfUse ? 'Yes' : 'Standard' },
  ];

  if (quote.tariff.hasTimeOfUse) {
    tariffItems.push({ label: 'Off-Peak Rate', value: `${(quote.tariff.offPeakRate || 0).toFixed(2)}p/kWh` });
  }

  const tariffCol = (pageWidth - margin * 2) / tariffItems.length;
  tariffItems.forEach((item, i) => {
    const itemX = margin + 10 + i * tariffCol;
    text(item.label, itemX, yPos + 9, { size: 8, color: colors.muted });
    text(item.value, itemX, yPos + 17, { size: 10, color: colors.dark, bold: true });
  });

  // Footer
  const footerY = pageHeight - 15;
  line(footerY - 8, colors.border);
  text('Page 1 of 2', 0, footerY, { size: 8, color: colors.muted, align: 'center' });
  text('© 2025 Logi6 Technologies Ltd', pageWidth - margin, footerY, { size: 8, color: colors.muted, align: 'right' });

  // ============================================================
  // PAGE 2: DETAILED BREAKDOWN
  // ============================================================
  doc.addPage();
  yPos = margin;

  // Top accent bar
  rect(0, 0, pageWidth, 8, colors.primary);

  yPos = 25;

  // Header
  text('Logi6', margin, yPos, { size: 16, color: colors.primaryDark, bold: true });
  text(quote.reference, pageWidth - margin, yPos, { size: 11, color: colors.muted, align: 'right' });

  yPos = 45;
  line(yPos, colors.border);
  yPos = 55;

  // Products & Services
  text('Products & Services', margin, yPos, { size: 14, color: colors.dark, bold: true });
  yPos += 15;

  // Table header
  const tableWidth = pageWidth - margin * 2;
  rect(margin, yPos, tableWidth, 12, colors.dark, 3);
  
  text('Description', margin + 8, yPos + 8, { size: 9, color: colors.white, bold: true });
  text('Qty', margin + tableWidth - 80, yPos + 8, { size: 9, color: colors.white, bold: true });
  text('Unit Price', margin + tableWidth - 55, yPos + 8, { size: 9, color: colors.white, bold: true });
  text('Total', margin + tableWidth - 8, yPos + 8, { size: 9, color: colors.white, bold: true, align: 'right' });
  
  yPos += 14;

  // Table rows
  quote.lineItems.forEach((item, index) => {
    const rowHeight = 14;
    const isEven = index % 2 === 0;
    
    if (isEven) {
      rect(margin, yPos, tableWidth, rowHeight, colors.light, 0);
    }
    
    // Type badge
    const typeColors: Record<string, [number, number, number]> = {
      battery: colors.primary,
      inverter: colors.solar,
      installation: colors.success,
      other: colors.muted,
    };
    const typeColor = typeColors[item.type] || colors.muted;
    
    text(item.description, margin + 8, yPos + 9, { size: 9, color: colors.text });
    text(item.quantity.toString(), margin + tableWidth - 80, yPos + 9, { size: 9, color: colors.text });
    text(`£${item.unitPrice.toLocaleString()}`, margin + tableWidth - 55, yPos + 9, { size: 9, color: colors.text });
    text(`£${(item.unitPrice * item.quantity).toLocaleString()}`, margin + tableWidth - 8, yPos + 9, { size: 9, color: colors.dark, bold: true, align: 'right' });
    
    yPos += rowHeight;
  });

  // Totals section
  yPos += 8;
  line(yPos, colors.border);
  yPos += 12;

  // Subtotal and VAT
  text('Subtotal', margin + tableWidth - 70, yPos, { size: 10, color: colors.text });
  text(`£${quote.subtotal.toLocaleString()}`, margin + tableWidth - 8, yPos, { size: 10, color: colors.text, align: 'right' });
  
  yPos += 8;
  text('VAT (0% - Battery Storage)', margin + tableWidth - 70, yPos, { size: 9, color: colors.muted });
  text('£0', margin + tableWidth - 8, yPos, { size: 9, color: colors.muted, align: 'right' });
  
  yPos += 12;
  
  // Total box
  rect(margin + tableWidth - 90, yPos - 3, 90, 18, colors.primary, 4);
  text('TOTAL', margin + tableWidth - 82, yPos + 8, { size: 10, color: colors.white, bold: true });
  text(`£${quote.total.toLocaleString()}`, margin + tableWidth - 8, yPos + 8, { size: 12, color: colors.white, bold: true, align: 'right' });

  yPos += 30;

  // Deposit callout
  rect(margin, yPos, tableWidth, 25, colors.light, 6);
  outlineRect(margin, yPos, tableWidth, 25, colors.primary, 6);
  text('Deposit Required', margin + 15, yPos + 10, { size: 10, color: colors.dark, bold: true });
  text(`£${quote.deposit.toLocaleString()}`, margin + 15, yPos + 18, { size: 9, color: colors.muted });
  text('Balance due upon completion', margin + tableWidth - 15, yPos + 14, { size: 9, color: colors.muted, align: 'right' });

  yPos += 40;

  // 10-Year Projection
  text('10-Year Savings Projection', margin, yPos, { size: 14, color: colors.dark, bold: true });
  yPos += 12;

  // Mini chart representation using bars
  const chartWidth = tableWidth;
  const chartHeight = 60;
  const barCount = 10;
  const barWidth = (chartWidth - 40) / barCount;
  const maxSavings = Math.max(...quote.roiProjections.map(p => p.cumulativeSavings));

  rect(margin, yPos, chartWidth, chartHeight, colors.light, 4);
  
  quote.roiProjections.slice(0, 10).forEach((proj, i) => {
    const barHeight = (proj.cumulativeSavings / maxSavings) * (chartHeight - 25);
    const barX = margin + 15 + i * barWidth;
    const barY = yPos + chartHeight - 15 - barHeight;
    
    // Bar
    rect(barX, barY, barWidth - 4, barHeight, colors.primary, 2);
    
    // Year label
    text(`Y${proj.year}`, barX + (barWidth - 4) / 2, yPos + chartHeight - 5, { size: 7, color: colors.muted, align: 'center' });
  });

  // Legend
  text(`Cumulative savings by Year 10: £${quote.roiProjections[9]?.cumulativeSavings.toLocaleString() || 'N/A'}`, margin + 10, yPos + 12, { size: 9, color: colors.success, bold: true });

  yPos += chartHeight + 20;

  // Notes section
  if (quote.notes) {
    text('Notes', margin, yPos, { size: 14, color: colors.dark, bold: true });
    yPos += 10;
    
    rect(margin, yPos, tableWidth, 30, colors.light, 4);
    const noteHeight = text(quote.notes, margin + 10, yPos + 10, { size: 9, color: colors.text, maxWidth: tableWidth - 20 });
    yPos += Math.max(30, noteHeight + 15);
  }

  yPos += 15;

  // Terms
  text('Terms & Conditions', margin, yPos, { size: 12, color: colors.dark, bold: true });
  yPos += 10;
  
  const terms = [
    '• This quotation is valid for 30 days from the date of issue.',
    '• A deposit is required to secure your installation date.',
    '• Final balance is due upon successful commissioning.',
    '• All installations comply with MCS and BS 7671 standards.',
    '• Warranty terms as per manufacturer specifications.',
  ];
  
  terms.forEach(term => {
    text(term, margin, yPos, { size: 8, color: colors.muted });
    yPos += 6;
  });

  // Footer
  const footer2Y = pageHeight - 15;
  line(footer2Y - 8, colors.border);
  text('Page 2 of 2', 0, footer2Y, { size: 8, color: colors.muted, align: 'center' });
  text('© 2025 Logi6 Technologies Ltd', pageWidth - margin, footer2Y, { size: 8, color: colors.muted, align: 'right' });

  // Save
  doc.save(`${quote.reference}-Proposal.pdf`);
}
