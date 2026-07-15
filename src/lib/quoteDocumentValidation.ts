import type { CustomerInfo, QuoteDocumentDetails, QuoteLineItem } from '../types';
import { mergeFieldLabel } from './templateBuilder';

export const emptyDocumentDetails = (): QuoteDocumentDetails => ({
  siteAddress: '',
  designerName: '',
  technicalOpName: '',
  surveyorName: '',
  surveyDate: '',
  installDate: '',
  commissioningDate: '',
  handoverDate: '',
  pvPanelCount: '',
  pvPanelModel: '',
  pvAnnualYield: '',
  installerSignature: '',
  customFields: {},
});

export function getDocumentDetails(customer: CustomerInfo): QuoteDocumentDetails {
  return {
    ...emptyDocumentDetails(),
    ...(customer.documentDetails || {}),
  };
}

function missing(label: string, value: string | undefined | null): string | null {
  if (value == null || !String(value).trim()) return label;
  return null;
}

/** yyyy-mm-dd for date inputs / documentDetails storage */
export function toDateInputValue(isoOrDate: string | undefined | null): string {
  if (!isoOrDate?.trim()) return '';
  const raw = isoOrDate.trim();
  const d =
    /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(`${raw}T00:00:00`)
      : new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Required before advancing past the customer step. */
export function validateCustomerStep(
  customer: CustomerInfo,
  installerName = '',
  companyInstallerSignature = '',
): string[] {
  const details = getDocumentDetails(customer);
  const errors = [
    missing('Full name', customer.name),
    missing('Email', customer.email),
    missing('Phone', customer.phone),
    missing('Address', customer.address),
    missing('Postcode', customer.postcode),
    // People + signature are auto-filled from account / company settings.
    missing(mergeFieldLabel('survey_date'), details.surveyDate),
    // commissioning_date is filled automatically when the job reaches commissioning.
    missing(
      'Installer signature (Settings → Company)',
      details.installerSignature || companyInstallerSignature,
    ),
  ].filter(Boolean) as string[];

  if (customer.existingSolar) {
    const solarErr = missing('Existing solar capacity (kWp)', String(customer.solarCapacityKwp || ''));
    if (solarErr) errors.push(solarErr);
  }

  return errors;
}

/** Required before generating proposal documents. */
export function validateQuoteForDocumentGeneration(params: {
  customer: CustomerInfo;
  lineItems: QuoteLineItem[];
  installerName?: string;
  companyInstallerSignature?: string;
}): string[] {
  const errors = validateCustomerStep(
    params.customer,
    params.installerName,
    params.companyInstallerSignature,
  );
  if (!params.lineItems.length) {
    errors.push('Add at least one product before generating documents');
  }
  return errors;
}

export function formatUkDate(isoDate: string | undefined): string {
  if (!isoDate?.trim()) return '';
  const raw = isoDate.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00`)
    : new Date(raw);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
