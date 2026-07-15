import { supabase } from './supabase';
import { supabaseAdmin } from './supabaseAdmin';

export const DOCUMENT_APPLIES_TO = [
  'general',
  'battery',
  'inverter',
  'heat_pump',
  'cylinder',
  'radiator',
] as const;

export type DocumentAppliesTo = (typeof DOCUMENT_APPLIES_TO)[number];

export const DOCUMENT_APPLIES_TO_LABELS: Record<DocumentAppliesTo, string> = {
  general: 'General',
  battery: 'Battery',
  inverter: 'Inverter',
  heat_pump: 'Heat Pump',
  cylinder: 'Cylinder',
  radiator: 'Radiator',
};

/** Product-specific Document Bank links (not company-wide general leaflets). */
const PRODUCT_DOC_ID_COLUMNS = [
  'datasheet_document_id',
  'user_manual_document_id',
] as const;

/**
 * Build document_id → product-type labels from product catalogue assignments
 * and any product_type already stored on the documents row.
 */
export async function fetchDocumentAppliesToMap(
  documents: Array<{ id: string; productType?: string | null; category?: string | null }>
): Promise<Map<string, DocumentAppliesTo[]>> {
  const sets = new Map<string, Set<DocumentAppliesTo>>();

  const add = (id: string | null | undefined, type: DocumentAppliesTo) => {
    if (!id) return;
    if (!sets.has(id)) sets.set(id, new Set());
    sets.get(id)!.add(type);
  };

  for (const doc of documents) {
    if (doc.category === 'consumer_code_leaflet') {
      add(doc.id, 'general');
      continue;
    }
    if (doc.productType && DOCUMENT_APPLIES_TO.includes(doc.productType as DocumentAppliesTo)) {
      add(doc.id, doc.productType as DocumentAppliesTo);
    }
  }

  const [batteries, inverters, heatPumps] = await Promise.all([
    supabase.from('battery_products').select(PRODUCT_DOC_ID_COLUMNS.join(',')),
    supabase.from('inverter_products').select(PRODUCT_DOC_ID_COLUMNS.join(',')),
    supabase.from('heat_pump_products').select(PRODUCT_DOC_ID_COLUMNS.join(',')),
  ]);

  for (const row of batteries.data || []) {
    for (const col of PRODUCT_DOC_ID_COLUMNS) add((row as any)[col], 'battery');
  }
  for (const row of inverters.data || []) {
    for (const col of PRODUCT_DOC_ID_COLUMNS) add((row as any)[col], 'inverter');
  }
  for (const row of heatPumps.data || []) {
    for (const col of PRODUCT_DOC_ID_COLUMNS) add((row as any)[col], 'heat_pump');
  }

  const result = new Map<string, DocumentAppliesTo[]>();
  for (const [id, set] of sets) {
    result.set(id, [...set]);
  }
  return result;
}

/** Tag Document Bank rows when they are assigned on a product form. */
export async function tagDocumentsProductType(
  documentIds: Array<string | null | undefined>,
  productType: DocumentAppliesTo
): Promise<void> {
  const ids = [...new Set(documentIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return;

  const { error } = await supabaseAdmin
    .from('documents')
    .update({ product_type: productType, updated_at: new Date().toISOString() })
    .in('id', ids);

  if (error) {
    console.warn('Failed to tag document product_type:', error.message);
  }
}
