import { supabase } from './supabase';

export interface AddressSuggestion {
  id: string;
  label: string;
  address: string;
  postcode: string;
}

function formatUkPostcode(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`.trim();
}

/** Turn a suggestion label into a single-line UK site address (no postcode / country). */
export function formatSelectedAddressLine(label: string): string {
  let text = label.trim();
  text = text.replace(/,\s*United Kingdom$/i, '');
  text = text.replace(/,\s*[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, '');
  return text.trim();
}

function pickSiteAddress(suggestion: AddressSuggestion, resolved: AddressSuggestion): string {
  const fromLabel = formatSelectedAddressLine(resolved.label || suggestion.label);
  const fromResolved = resolved.address?.trim() || suggestion.address?.trim() || '';

  if (!fromResolved) return fromLabel;
  if (!fromLabel) return fromResolved;

  // Nominatim often returns a short `address` (e.g. "BS1") while the label is complete.
  if (fromResolved.length < fromLabel.length) return fromLabel;
  return fromResolved;
}

async function invokeLookup<T>(body: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await supabase.functions.invoke('uk-address-lookup', { body });
  if (error) {
    console.error('uk-address-lookup error:', error);
    return null;
  }
  return data as T;
}

export async function searchPostcodeSuggestions(query: string): Promise<string[]> {
  const data = await invokeLookup<{ results?: string[] }>({
    action: 'postcode_autocomplete',
    query,
  });
  return data?.results || [];
}

export async function lookupPostcode(postcode: string): Promise<{ valid: boolean; formatted?: string }> {
  const data = await invokeLookup<{ valid: boolean; formatted?: string }>({
    action: 'postcode_lookup',
    postcode,
  });
  return data || { valid: false };
}

export async function searchAddressSuggestions(
  query: string,
  options?: { postcodeHint?: string },
): Promise<AddressSuggestion[]> {
  const data = await invokeLookup<{ results?: AddressSuggestion[] }>({
    action: 'address_search',
    query,
    postcodeHint: options?.postcodeHint,
  });
  return data?.results || [];
}

export async function resolveAddressSuggestion(suggestion: AddressSuggestion): Promise<AddressSuggestion> {
  const data = await invokeLookup<{ result?: AddressSuggestion }>({
    action: 'address_resolve',
    suggestion,
  });
  const resolved = data?.result || suggestion;
  return {
    ...resolved,
    address: pickSiteAddress(suggestion, resolved),
    postcode: resolved.postcode || suggestion.postcode,
  };
}

export { formatUkPostcode };
