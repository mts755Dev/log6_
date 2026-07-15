import type { TemplateCategory } from '../types';

export interface TemplateCodeOption {
  code: string;
  name: string;
  description: string;
  category: TemplateCategory;
}

/** Standard heliOS document codes — pick from list when saving a builder template. */
export const TEMPLATE_CODE_CATALOG: TemplateCodeOption[] = [
  // Proposal pack
  {
    code: 'FO7A',
    name: 'Covering Letter',
    description: 'Professional covering letter for the proposal pack',
    category: 'proposal',
  },
  {
    code: 'F13I',
    name: 'Contract of Sale',
    description: 'Formal contract of sale agreement',
    category: 'proposal',
  },
  {
    code: 'F71',
    name: 'Battery Performance Estimate',
    description: 'Estimated savings and performance summary',
    category: 'proposal',
  },

  // Contract / in-house pack
  {
    code: 'F01',
    name: 'Enquiry Form',
    description: 'Initial customer enquiry form',
    category: 'contract',
  },
  {
    code: 'F02',
    name: 'Overstay Form',
    description: 'Engineer overstay documentation',
    category: 'contract',
  },
  {
    code: 'F03',
    name: 'Non-Conformity Form',
    description: 'Documentation of installation non-conformities',
    category: 'contract',
  },
  {
    code: 'FO9',
    name: 'Purchase Order Form',
    description: 'Internal purchase order for equipment',
    category: 'contract',
  },
  {
    code: 'F11',
    name: 'Customer Complaint Form',
    description: 'Customer complaint logging and resolution',
    category: 'contract',
  },
  {
    code: 'F14',
    name: 'Variation of Contract Form',
    description: 'Contract variation and change order documentation',
    category: 'contract',
  },
  {
    code: 'F70',
    name: 'Battery Survey Form',
    description: 'Pre-installation battery system survey',
    category: 'contract',
  },
  {
    code: 'F42',
    name: 'Battery Risk Assessment',
    description: 'Safety risk assessment for battery installation',
    category: 'contract',
  },
  {
    code: 'F73',
    name: 'Battery Method Statement',
    description: 'Detailed installation method statement',
    category: 'contract',
  },

  // Handover pack
  {
    code: 'F07B',
    name: 'Handover Cover Letter',
    description: 'Cover letter for handover documentation pack',
    category: 'handover',
  },
  {
    code: 'F74',
    name: 'Battery Testing Checklist',
    description: 'Pre-commissioning battery system testing checklist',
    category: 'handover',
  },
  {
    code: 'F19',
    name: 'Workmanship Warranty',
    description: 'Installation workmanship warranty certificate',
    category: 'handover',
  },
  {
    code: 'F75',
    name: 'Battery Commissioning Checklist',
    description: 'System commissioning and handover checklist',
    category: 'handover',
  },
  {
    code: 'F16E',
    name: 'Completion of Works Record',
    description: 'Official completion certificate for installation',
    category: 'handover',
  },

  // Invoice
  {
    code: 'INV01',
    name: 'Deposit Invoice',
    description: 'Customer deposit invoice template',
    category: 'invoice',
  },
  {
    code: 'INV02',
    name: 'Final Invoice',
    description: 'Final balance invoice template',
    category: 'invoice',
  },
];

export const CUSTOM_TEMPLATE_CODE = '__custom__';

export function getTemplateCodesForCategory(category: TemplateCategory): TemplateCodeOption[] {
  return TEMPLATE_CODE_CATALOG.filter((item) => item.category === category);
}

export function getTemplateCodeOption(code: string): TemplateCodeOption | undefined {
  return TEMPLATE_CODE_CATALOG.find((item) => item.code === code);
}

export function defaultCodeForCategory(
  category: TemplateCategory,
  takenCodes: Set<string> = new Set(),
): string {
  const available = getTemplateCodesForCategory(category).find((item) => !takenCodes.has(item.code));
  return available?.code ?? '';
}
