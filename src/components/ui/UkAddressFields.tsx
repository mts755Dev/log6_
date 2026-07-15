import { useState, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';
import {
  formatUkPostcode,
  formatSelectedAddressLine,
  lookupPostcode,
  resolveAddressSuggestion,
  searchAddressSuggestions,
  searchPostcodeSuggestions,
  type AddressSuggestion,
} from '../../lib/ukAddressLookup';

interface UkAddressFieldsProps {
  address: string;
  postcode: string;
  onAddressChange: (address: string) => void;
  onPostcodeChange: (postcode: string) => void;
  addressLabel?: string;
  postcodeLabel?: string;
  required?: boolean;
  addressClassName?: string;
  postcodeClassName?: string;
}

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

interface AutocompleteFieldProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  required?: boolean;
  suggestions: Array<{ id: string; label: string }>;
  showSuggestions: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSelect: (id: string, label: string) => void;
  className?: string;
}

function AutocompleteField({
  id,
  label,
  value,
  placeholder,
  required,
  suggestions,
  showSuggestions,
  onChange,
  onFocus,
  onBlur,
  onSelect,
  className,
}: AutocompleteFieldProps) {
  return (
    <div className={cn('w-full relative', showSuggestions && 'z-[100]', className)}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className="input"
      />

      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-[100] mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-800 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(item.id, item.label);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function UkAddressFields({
  address,
  postcode,
  onAddressChange,
  onPostcodeChange,
  addressLabel = 'Address',
  postcodeLabel = 'Postcode',
  required = false,
  addressClassName,
  postcodeClassName,
}: UkAddressFieldsProps) {
  const [postcodeSuggestions, setPostcodeSuggestions] = useState<string[]>([]);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showPostcodeSuggestions, setShowPostcodeSuggestions] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressFocused, setAddressFocused] = useState(false);
  const [postcodeFocused, setPostcodeFocused] = useState(false);

  const debouncedPostcode = useDebouncedValue(postcode);
  const debouncedAddress = useDebouncedValue(address);

  useEffect(() => {
    if (!postcodeFocused) return;

    let cancelled = false;
    const load = async () => {
      const results = await searchPostcodeSuggestions(debouncedPostcode);
      if (!cancelled) {
        setPostcodeSuggestions(results);
        setShowPostcodeSuggestions(results.length > 0);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [debouncedPostcode, postcodeFocused]);

  const loadAddressSuggestions = useCallback(async (query: string, postcodeHint?: string) => {
    const results = await searchAddressSuggestions(query, { postcodeHint });
    setAddressSuggestions(results);
    setShowAddressSuggestions(results.length > 0);
  }, []);

  useEffect(() => {
    if (!addressFocused) return;
    if (debouncedAddress.trim().length < 3 && !postcode.trim()) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const results = await searchAddressSuggestions(debouncedAddress, {
        postcodeHint: postcode.trim() || undefined,
      });
      if (!cancelled) {
        setAddressSuggestions(results);
        setShowAddressSuggestions(results.length > 0);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [debouncedAddress, addressFocused, postcode]);

  const handlePostcodeSelect = async (value: string) => {
    const formatted = formatUkPostcode(value);
    onPostcodeChange(formatted);
    setShowPostcodeSuggestions(false);
    setPostcodeFocused(false);

    await lookupPostcode(formatted);
    if (!address.trim()) {
      await loadAddressSuggestions('', formatted);
      setShowAddressSuggestions(true);
      setAddressFocused(true);
    }
  };

  const applyFieldUpdates = useCallback(
    (updates: { address?: string; postcode?: string }) => {
      if (updates.address !== undefined) onAddressChange(updates.address);
      if (updates.postcode !== undefined) onPostcodeChange(updates.postcode);
    },
    [onAddressChange, onPostcodeChange],
  );

  const handleAddressSelect = async (suggestion: AddressSuggestion) => {
    setShowAddressSuggestions(false);
    setAddressFocused(false);

    const addressLine = formatSelectedAddressLine(suggestion.label);
    applyFieldUpdates({
      address: addressLine,
      postcode: suggestion.postcode || undefined,
    });

    const resolved = await resolveAddressSuggestion(suggestion);
    applyFieldUpdates({
      address: resolved.address,
      postcode: resolved.postcode || undefined,
    });
  };

  const handlePostcodeBlur = () => {
    window.setTimeout(() => {
      setShowPostcodeSuggestions(false);
      setPostcodeFocused(false);
      if (postcode.trim()) {
        onPostcodeChange(formatUkPostcode(postcode));
      }
    }, 150);
  };

  const handleAddressBlur = () => {
    window.setTimeout(() => {
      setShowAddressSuggestions(false);
      setAddressFocused(false);
    }, 150);
  };

  return (
    <>
      <AutocompleteField
        id="uk-address"
        label={addressLabel}
        value={address}
        placeholder="123 High Street, Bristol"
        required={required}
        suggestions={addressSuggestions.map((s) => ({ id: s.id, label: s.label }))}
        showSuggestions={showAddressSuggestions && addressFocused}
        onChange={onAddressChange}
        onFocus={() => {
          setAddressFocused(true);
          if (postcode.trim() && address.trim().length < 3) {
            loadAddressSuggestions(address, postcode.trim());
          }
        }}
        onBlur={handleAddressBlur}
        onSelect={(id) => {
          const suggestion = addressSuggestions.find((s) => s.id === id);
          if (suggestion) handleAddressSelect(suggestion);
        }}
        className={addressClassName}
      />

      <AutocompleteField
        id="uk-postcode"
        label={postcodeLabel}
        value={postcode}
        placeholder="BS1 4AB"
        required={required}
        suggestions={postcodeSuggestions.map((pc) => ({ id: pc, label: formatUkPostcode(pc) }))}
        showSuggestions={showPostcodeSuggestions && postcodeFocused}
        onChange={onPostcodeChange}
        onFocus={() => setPostcodeFocused(true)}
        onBlur={handlePostcodeBlur}
        onSelect={(_, label) => handlePostcodeSelect(label)}
        className={postcodeClassName}
      />
    </>
  );
}
