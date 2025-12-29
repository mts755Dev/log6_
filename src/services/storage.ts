// LocalStorage Service for persisting data

const STORAGE_KEYS = {
  USERS: 'helios_users',
  COMPANIES: 'helios_companies',
  QUOTES: 'helios_quotes',
  PRODUCTS_BATTERIES: 'helios_batteries',
  PRODUCTS_INVERTERS: 'helios_inverters',
  MANUFACTURERS: 'helios_manufacturers',
  MIS_DOCUMENTS: 'helios_mis_documents',
  COMMISSIONS: 'helios_commissions',
  CERTIFICATES: 'helios_certificates',
  NOTIFICATIONS: 'helios_notifications',
  CURRENT_USER: 'helios_current_user',
  INITIALIZED: 'helios_initialized',
};

// Generic storage functions
export function getItem<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

export function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

export function removeItem(key: string): void {
  localStorage.removeItem(key);
}

// Collection helpers
export function getCollection<T>(key: string): T[] {
  return getItem<T[]>(key) || [];
}

export function addToCollection<T extends { id: string }>(key: string, item: T): void {
  const collection = getCollection<T>(key);
  collection.push(item);
  setItem(key, collection);
}

export function updateInCollection<T extends { id: string }>(
  key: string,
  id: string,
  updates: Partial<T>
): void {
  const collection = getCollection<T>(key);
  const index = collection.findIndex((item) => item.id === id);
  if (index !== -1) {
    collection[index] = { ...collection[index], ...updates };
    setItem(key, collection);
  }
}

export function removeFromCollection<T extends { id: string }>(key: string, id: string): void {
  const collection = getCollection<T>(key);
  const filtered = collection.filter((item) => item.id !== id);
  setItem(key, filtered);
}

export function findInCollection<T extends { id: string }>(key: string, id: string): T | undefined {
  const collection = getCollection<T>(key);
  return collection.find((item) => item.id === id);
}

// Export storage keys for use in other modules
export { STORAGE_KEYS };

