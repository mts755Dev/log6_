import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AddressSuggestion {
  id: string;
  label: string;
  address: string;
  postcode: string;
}

type LookupAction =
  | 'postcode_autocomplete'
  | 'postcode_lookup'
  | 'address_search'
  | 'address_resolve';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getConfig() {
  return {
    postcodesIo: Deno.env.get('POSTCODES_IO_URL') || 'https://api.postcodes.io',
    nominatim: Deno.env.get('NOMINATIM_URL') || 'https://nominatim.openstreetmap.org/search',
    getAddressBase: Deno.env.get('GETADDRESS_BASE_URL') || 'https://api.getAddress.io',
    getAddressApiKey: Deno.env.get('GETADDRESS_API_KEY') || '',
  };
}

function formatUkPostcode(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`.trim();
}

async function searchPostcodeSuggestions(query: string, postcodesIo: string): Promise<string[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const res = await fetch(`${postcodesIo}/postcodes/${encodeURIComponent(trimmed)}/autocomplete`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.result as string[] | null) || [];
}

async function lookupPostcode(postcode: string, postcodesIo: string) {
  const trimmed = postcode.trim();
  if (!trimmed) return { valid: false };

  const res = await fetch(`${postcodesIo}/postcodes/${encodeURIComponent(trimmed)}`);
  const data = await res.json();
  if (data.status !== 200 || !data.result) return { valid: false };
  return { valid: true, formatted: data.result.postcode as string };
}

async function searchGetAddress(
  query: string,
  apiKey: string,
  getAddressBase: string,
): Promise<AddressSuggestion[]> {
  const res = await fetch(
    `${getAddressBase}/autocomplete/${encodeURIComponent(query)}?api-key=${apiKey}&all=true`,
  );
  if (!res.ok) return [];

  const data = await res.json();
  const suggestions = (data.suggestions as Array<{ address: string; id: string }>) || [];

  return suggestions.map((item) => {
    const parts = item.address.split(',').map((p) => p.trim());
    const postcode = parts[parts.length - 1] || '';
    return {
      id: item.id,
      label: item.address,
      address: parts.slice(0, -1).join(', ') || item.address,
      postcode: formatUkPostcode(postcode),
    };
  });
}

async function resolveGetAddressId(
  id: string,
  apiKey: string,
  getAddressBase: string,
): Promise<AddressSuggestion | null> {
  const res = await fetch(`${getAddressBase}/get/${encodeURIComponent(id)}?api-key=${apiKey}`);
  if (!res.ok) return null;

  const data = await res.json();
  return {
    id,
    label: [data.line_1, data.line_2, data.line_3, data.town_or_city, data.postcode]
      .filter(Boolean)
      .join(', '),
    address: [data.line_1, data.line_2, data.line_3, data.town_or_city].filter(Boolean).join(', '),
    postcode: formatUkPostcode(data.postcode || ''),
  };
}

async function searchAddressesByPostcode(
  postcode: string,
  apiKey: string,
  getAddressBase: string,
): Promise<AddressSuggestion[]> {
  const res = await fetch(
    `${getAddressBase}/find/${encodeURIComponent(postcode)}?api-key=${apiKey}&expand=true`,
  );
  if (!res.ok) return [];

  const data = await res.json();
  const addresses = (data.addresses as string[]) || [];

  return addresses.map((full, index) => {
    const parts = full.split(',').map((p) => p.trim());
    const pc = parts[parts.length - 1] || postcode;
    return {
      id: `postcode-${postcode}-${index}`,
      label: full,
      address: parts.slice(0, -1).join(', ') || full,
      postcode: formatUkPostcode(pc),
    };
  });
}

async function searchNominatim(
  query: string,
  nominatim: string,
  postcodeHint?: string,
): Promise<AddressSuggestion[]> {
  const searchQuery = postcodeHint
    ? `${query}, ${postcodeHint}, United Kingdom`
    : `${query}, United Kingdom`;

  const params = new URLSearchParams({
    format: 'json',
    q: searchQuery,
    countrycodes: 'gb',
    addressdetails: '1',
    limit: '6',
  });

  const res = await fetch(`${nominatim}?${params.toString()}`, {
    headers: { 'Accept-Language': 'en' },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as Array<{
    place_id: number;
    display_name: string;
    address?: Record<string, string>;
  }>;

  return data.map((item) => {
    const addr = item.address || {};
    const line1 = [addr.house_number, addr.road].filter(Boolean).join(' ');
    const locality = addr.city || addr.town || addr.village || addr.suburb || '';
    const postcode = formatUkPostcode(addr.postcode || postcodeHint || '');
    const label = item.display_name;
    const formatted = label
      .replace(/,\s*United Kingdom$/i, '')
      .replace(/,\s*[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, '')
      .trim();
    const address = formatted || [line1, locality].filter(Boolean).join(', ') || label.split(',')[0];

    return {
      id: String(item.place_id),
      label,
      address,
      postcode,
    };
  });
}

async function searchAddressSuggestions(
  query: string,
  config: ReturnType<typeof getConfig>,
  postcodeHint?: string,
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3 && !postcodeHint) return [];

  if (config.getAddressApiKey) {
    if (trimmed.length < 3 && postcodeHint) {
      return searchAddressesByPostcode(postcodeHint, config.getAddressApiKey, config.getAddressBase);
    }
    const results = await searchGetAddress(
      postcodeHint ? `${trimmed} ${postcodeHint}` : trimmed,
      config.getAddressApiKey,
      config.getAddressBase,
    );
    if (results.length > 0) return results;
  }

  return searchNominatim(trimmed, config.nominatim, postcodeHint);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const config = getConfig();
    const body = await req.json();
    const action = body.action as LookupAction;

    switch (action) {
      case 'postcode_autocomplete': {
        const results = await searchPostcodeSuggestions(body.query || '', config.postcodesIo);
        return jsonResponse({ results });
      }

      case 'postcode_lookup': {
        const result = await lookupPostcode(body.postcode || '', config.postcodesIo);
        return jsonResponse(result);
      }

      case 'address_search': {
        const results = await searchAddressSuggestions(
          body.query || '',
          config,
          body.postcodeHint?.trim() || undefined,
        );
        return jsonResponse({ results });
      }

      case 'address_resolve': {
        const suggestion = body.suggestion as AddressSuggestion | undefined;
        if (!suggestion) {
          return jsonResponse({ error: 'suggestion is required' }, 400);
        }

        if (
          config.getAddressApiKey &&
          !suggestion.id.startsWith('postcode-') &&
          !/^\d+$/.test(suggestion.id)
        ) {
          const resolved = await resolveGetAddressId(
            suggestion.id,
            config.getAddressApiKey,
            config.getAddressBase,
          );
          if (resolved) return jsonResponse({ result: resolved });
        }

        return jsonResponse({ result: suggestion });
      }

      default:
        return jsonResponse({ error: 'Invalid action' }, 400);
    }
  } catch (error) {
    console.error('uk-address-lookup error:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Address lookup failed' },
      500,
    );
  }
});
