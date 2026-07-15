import { supabase } from './supabase';
import {
  normalizeCustomLinkedFields,
  PLATFORM_MERGE_KEYS,
  slugifyMergeFieldKey,
  type CustomLinkedField,
} from './templateBuilder';

export interface StoredMergeField extends CustomLinkedField {
  id?: string;
  fieldGroup?: string;
  description?: string;
  isActive?: boolean;
}

export async function listStoredMergeFields(): Promise<StoredMergeField[]> {
  const { data, error } = await supabase
    .from('template_merge_fields')
    .select('id, field_key, label, field_group, description, is_active')
    .eq('is_active', true)
    .order('field_group', { ascending: true })
    .order('label', { ascending: true });

  if (error) {
    console.error('Error loading template merge fields:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id as string,
    key: String(row.field_key),
    label: String(row.label),
    fieldGroup: String(row.field_group || 'Custom'),
    description: row.description ? String(row.description) : undefined,
    isActive: Boolean(row.is_active),
  }));
}

export async function createStoredMergeField(
  label: string,
  options?: { key?: string; description?: string },
): Promise<StoredMergeField | null> {
  const trimmedLabel = label.trim();
  const key = (options?.key || slugifyMergeFieldKey(trimmedLabel)).toLowerCase();
  if (!trimmedLabel || !key || PLATFORM_MERGE_KEYS.has(key)) return null;

  const { data, error } = await supabase
    .from('template_merge_fields')
    .upsert(
      {
        field_key: key,
        label: trimmedLabel,
        field_group: 'Custom',
        description: options?.description?.trim() || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'field_key' },
    )
    .select('id, field_key, label, field_group, description, is_active')
    .single();

  if (error) {
    console.error('Error creating template merge field:', error);
    return null;
  }

  return {
    id: data.id as string,
    key: String(data.field_key),
    label: String(data.label),
    fieldGroup: String(data.field_group || 'Custom'),
    description: data.description ? String(data.description) : undefined,
    isActive: Boolean(data.is_active),
  };
}

export async function deactivateStoredMergeField(key: string): Promise<boolean> {
  const { error } = await supabase
    .from('template_merge_fields')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('field_key', key);

  if (error) {
    console.error('Error deactivating template merge field:', error);
    return false;
  }
  return true;
}

/** Merge DB fields with any template-local custom fields. */
export function mergeCustomFieldLists(
  ...lists: Array<CustomLinkedField[] | StoredMergeField[] | undefined>
): CustomLinkedField[] {
  const byKey = new Map<string, CustomLinkedField>();
  for (const list of lists) {
    for (const field of normalizeCustomLinkedFields(list || [])) {
      byKey.set(field.key, field);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label));
}
