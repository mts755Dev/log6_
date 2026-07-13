/** Server-side ROI / design context from quote rows (mirrors NewQuotePage logic). */

interface QuoteCustomer {
  name?: string;
  annualConsumptionKwh?: number;
  existingSolar?: boolean;
  solarCapacityKwp?: number;
  hasEv?: boolean;
  evMileagePerYear?: number;
}

interface QuoteTariff {
  importRate?: number;
  exportRate?: number;
  hasTimeOfUse?: boolean;
  peakRate?: number;
  offPeakRate?: number;
}

interface QuoteLineItem {
  type?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
}

interface RoiProjection {
  year?: number;
  savings?: number;
  cumulativeSavings?: number;
  loadShiftSavings?: number;
  exportRevenue?: number;
  evTaxSavings?: number;
}

export function formatQuoteRoiContext(quote: {
  reference?: string | null;
  total?: number | string | null;
  annual_savings?: number | string | null;
  payback_years?: number | string | null;
  subtotal?: number | string | null;
  margin_percentage?: number | string | null;
  customer?: QuoteCustomer | null;
  tariff?: QuoteTariff | null;
  line_items?: QuoteLineItem[] | null;
  roi_projections?: RoiProjection[] | null;
  installation_type?: string | null;
}): string {
  const customer = quote.customer ?? {};
  const tariff = quote.tariff ?? {};
  const lineItems = quote.line_items ?? [];
  const roi = quote.roi_projections ?? [];

  const batteryItems = lineItems.filter((i) => i.type === 'battery');
  const inverterItems = lineItems.filter((i) => i.type === 'inverter');

  const lines: string[] = [
    quote.reference ? `Quote: ${quote.reference}` : 'Quote ROI context',
    quote.installation_type ? `Type: ${quote.installation_type}` : null,
    customer.annualConsumptionKwh ? `Annual usage: ${customer.annualConsumptionKwh} kWh` : null,
    customer.existingSolar && customer.solarCapacityKwp
      ? `Existing solar: ${customer.solarCapacityKwp} kWp`
      : null,
    customer.hasEv && customer.evMileagePerYear
      ? `EV mileage: ${customer.evMileagePerYear} miles/year`
      : null,
    tariff.importRate != null ? `Import rate: ${tariff.importRate}p/kWh` : null,
    tariff.exportRate != null ? `Export rate: ${tariff.exportRate}p/kWh` : null,
    tariff.hasTimeOfUse ? 'Time-of-use tariff: yes' : null,
    quote.subtotal ? `Subtotal: £${quote.subtotal}` : null,
    quote.total ? `System total: £${quote.total}` : null,
    quote.margin_percentage ? `Margin: ${quote.margin_percentage}%` : null,
    quote.annual_savings ? `Stored annual savings: £${quote.annual_savings}` : null,
    quote.payback_years ? `Stored payback: ${quote.payback_years} years` : null,
  ].filter(Boolean) as string[];

  if (batteryItems.length) {
    lines.push('Batteries on quote:');
    for (const item of batteryItems) {
      lines.push(`  - ${item.description} ×${item.quantity ?? 1} @ £${item.unitPrice ?? '?'}`);
    }
  }

  if (inverterItems.length) {
    lines.push('Inverters on quote:');
    for (const item of inverterItems) {
      lines.push(`  - ${item.description} ×${item.quantity ?? 1} @ £${item.unitPrice ?? '?'}`);
    }
  }

  if (roi.length > 0) {
    const y1 = roi.find((r) => r.year === 1);
    const y5 = roi.find((r) => r.year === 5);
    const y10 = roi.find((r) => r.year === 10);
    lines.push('10-year ROI projections (from quote calculator):');
    if (y1) {
      lines.push(
        `  Year 1: savings £${y1.savings ?? 0}, load-shift £${y1.loadShiftSavings ?? 0}, export £${y1.exportRevenue ?? 0}`
      );
    }
    if (y5) lines.push(`  Year 5 cumulative: £${y5.cumulativeSavings ?? y5.savings ?? 0}`);
    if (y10) lines.push(`  Year 10 cumulative: £${y10.cumulativeSavings ?? y10.savings ?? 0}`);
  }

  lines.push(
    'Sizing rule of thumb: battery kWh ≈ evening load (daily kWh × evening fraction); validate against MCS and product limits.'
  );

  return lines.join('\n');
}

export function estimateBatteryCapacityKwh(lineItems: QuoteLineItem[], batteryCatalog?: { id: string; capacity_kwh: number }[]): number {
  let total = 0;
  for (const item of lineItems) {
    if (item.type !== 'battery') continue;
    const productId = (item as { productId?: string; product_id?: string }).productId ??
      (item as { product_id?: string }).product_id;
    const fromCatalog = batteryCatalog?.find((b) => b.id === productId);
    const capacity = fromCatalog?.capacity_kwh ?? 0;
    total += capacity * (item.quantity ?? 1);
  }
  return total;
}
