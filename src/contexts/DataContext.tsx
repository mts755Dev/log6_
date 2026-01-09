import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  STORAGE_KEYS,
  getCollection,
  addToCollection,
  updateInCollection,
  removeFromCollection,
  findInCollection,
} from '../services/storage';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type {
  Quote,
  Company,
  User,
  BatteryProduct,
  InverterProduct,
  Manufacturer,
  CommissioningSubmission,
  Certificate,
  MIS3002Document,
} from '../types';

interface DataContextType {
  // Quotes
  quotes: Quote[];
  getQuote: (id: string) => Quote | undefined;
  createQuote: (quote: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>) => Quote;
  updateQuote: (id: string, updates: Partial<Quote>) => void;
  deleteQuote: (id: string) => void;
  
  // Companies
  companies: Company[];
  getCompany: (id: string) => Company | undefined;
  updateCompany: (id: string, updates: Partial<Company>) => void;
  
  // Users
  users: User[];
  createUser: (user: Omit<User, 'id' | 'createdAt'>) => User;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
  
  // Products
  batteries: BatteryProduct[];
  inverters: InverterProduct[];
  manufacturers: Manufacturer[];
  getBattery: (id: string) => BatteryProduct | undefined;
  getInverter: (id: string) => InverterProduct | undefined;
  
  // Commissioning
  commissions: CommissioningSubmission[];
  getCommission: (id: string) => CommissioningSubmission | undefined;
  createCommission: (commission: Omit<CommissioningSubmission, 'id' | 'createdAt' | 'updatedAt'>) => CommissioningSubmission;
  updateCommission: (id: string, updates: Partial<CommissioningSubmission>) => void;
  
  // Certificates
  certificates: Certificate[];
  createCertificate: (certificate: Omit<Certificate, 'id'>) => Certificate;
  
  // MIS Documents
  misDocuments: MIS3002Document[];
  createMISDocument: (doc: Omit<MIS3002Document, 'id' | 'createdAt' | 'updatedAt'>) => MIS3002Document;
  updateMISDocument: (id: string, updates: Partial<MIS3002Document>) => void;
  
  // Refresh data
  refreshData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [batteries, setBatteries] = useState<BatteryProduct[]>([]);
  const [inverters, setInverters] = useState<InverterProduct[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [commissions, setCommissions] = useState<CommissioningSubmission[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [misDocuments, setMisDocuments] = useState<MIS3002Document[]>([]);

  const loadData = useCallback(async () => {
    // Load quotes and commissions from localStorage (will migrate to Supabase later)
    const allQuotes = getCollection<Quote>(STORAGE_KEYS.QUOTES);
    const allCommissions = getCollection<CommissioningSubmission>(STORAGE_KEYS.COMMISSIONS);
    
    if (user?.role === 'admin') {
      setQuotes(allQuotes);
      setCommissions(allCommissions);
    } else if (user?.role === 'installer') {
      setQuotes(allQuotes.filter(q => q.companyId === user.companyId));
      setCommissions(allCommissions.filter(c => c.companyId === user.companyId));
    } else if (user?.role === 'assessor') {
      setQuotes([]);
      setCommissions(allCommissions);
    } else {
      setQuotes(allQuotes);
      setCommissions(allCommissions);
    }
    
    // Load companies from Supabase
    try {
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (!companiesError && companiesData) {
        const mappedCompanies: Company[] = companiesData.map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone || '',
          address: c.address || '',
          postcode: c.postcode || '',
          mcsNumber: c.mcs_number,
          isUmbrellaScheme: c.is_umbrella_scheme,
          subscriptionTier: c.subscription_tier,
          subscriptionStatus: c.subscription_status,
          subscriptionEndDate: c.subscription_end_date,
          logo: c.logo,
          brandColor: c.brand_color,
          createdAt: c.created_at,
        }));
        setCompanies(mappedCompanies);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    }

    // Load manufacturers from Supabase
    try {
      const { data: mfrData, error: mfrError } = await supabase
        .from('manufacturers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (!mfrError && mfrData) {
        const mappedMfrs: Manufacturer[] = mfrData.map((m: any) => ({
          id: m.id,
          name: m.name,
          logo: m.logo,
          website: m.website,
          supportEmail: m.support_email,
          isActive: m.is_active,
        }));
        setManufacturers(mappedMfrs);
      }
    } catch (error) {
      console.error('Error loading manufacturers:', error);
    }

    // Load batteries from Supabase
    try {
      const { data: batteriesData, error: batteriesError } = await supabase
        .from('battery_products')
        .select(`
          *,
          manufacturer:manufacturers(id, name)
        `)
        .eq('is_active', true)
        .order('capacity_kwh');

      if (!batteriesError && batteriesData) {
        const mappedBatteries: BatteryProduct[] = batteriesData.map((b: any) => ({
          id: b.id,
          manufacturerId: b.manufacturer_id,
          manufacturerName: b.manufacturer?.name || 'Unknown',
          model: b.model,
          capacityKwh: parseFloat(b.capacity_kwh),
          powerKw: parseFloat(b.power_kw),
          chemistry: b.chemistry,
          warrantyYears: b.warranty_years,
          cycleLife: b.cycle_life,
          efficiency: parseFloat(b.efficiency),
          dimensions: b.dimensions,
          weight: parseFloat(b.weight),
          costPrice: parseFloat(b.cost_price),
          rrp: parseFloat(b.rrp),
          imageUrl: b.image_url,
          isActive: b.is_active,
        }));
        setBatteries(mappedBatteries);
      }
    } catch (error) {
      console.error('Error loading batteries:', error);
    }

    // Load inverters from Supabase
    try {
      const { data: invertersData, error: invertersError } = await supabase
        .from('inverter_products')
        .select(`
          *,
          manufacturer:manufacturers(id, name)
        `)
        .eq('is_active', true)
        .order('power_kw');

      if (!invertersError && invertersData) {
        const mappedInverters: InverterProduct[] = invertersData.map((i: any) => ({
          id: i.id,
          manufacturerId: i.manufacturer_id,
          manufacturerName: i.manufacturer?.name || 'Unknown',
          model: i.model,
          powerKw: parseFloat(i.power_kw),
          type: i.type,
          phases: i.phases || 1,
          mpptCount: i.mppt_count,
          maxInputVoltage: parseFloat(i.max_input_voltage),
          maxDcCurrent: i.max_dc_current ? parseFloat(i.max_dc_current) : undefined,
          efficiency: parseFloat(i.efficiency),
          features: i.features || [],
          warrantyYears: i.warranty_years,
          dimensions: i.dimensions,
          weight: parseFloat(i.weight),
          costPrice: parseFloat(i.cost_price),
          rrp: parseFloat(i.rrp),
          imageUrl: i.image_url,
          isActive: i.is_active,
        }));
        setInverters(mappedInverters);
      }
    } catch (error) {
      console.error('Error loading inverters:', error);
    }
    
    setUsers(getCollection<User>(STORAGE_KEYS.USERS));
    setCertificates(getCollection<Certificate>(STORAGE_KEYS.CERTIFICATES));
    setMisDocuments(getCollection<MIS3002Document>(STORAGE_KEYS.MIS_DOCUMENTS));
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Quote functions
  const getQuote = useCallback((id: string) => {
    return findInCollection<Quote>(STORAGE_KEYS.QUOTES, id);
  }, []);

  const createQuote = useCallback((quoteData: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>): Quote => {
    const quote: Quote = {
      ...quoteData,
      id: `quote-${uuidv4().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addToCollection(STORAGE_KEYS.QUOTES, quote);
    loadData();
    return quote;
  }, [loadData]);

  const updateQuote = useCallback((id: string, updates: Partial<Quote>) => {
    updateInCollection(STORAGE_KEYS.QUOTES, id, { ...updates, updatedAt: new Date().toISOString() });
    loadData();
  }, [loadData]);

  const deleteQuote = useCallback((id: string) => {
    removeFromCollection(STORAGE_KEYS.QUOTES, id);
    loadData();
  }, [loadData]);

  // Company functions
  const getCompany = useCallback((id: string) => {
    return findInCollection<Company>(STORAGE_KEYS.COMPANIES, id);
  }, []);

  const updateCompany = useCallback((id: string, updates: Partial<Company>) => {
    updateInCollection(STORAGE_KEYS.COMPANIES, id, updates);
    loadData();
  }, [loadData]);

  // User functions
  const createUser = useCallback((userData: Omit<User, 'id' | 'createdAt'>): User => {
    const newUser: User = {
      ...userData,
      id: `user-${uuidv4().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    };
    addToCollection(STORAGE_KEYS.USERS, newUser);
    loadData();
    return newUser;
  }, [loadData]);

  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    updateInCollection(STORAGE_KEYS.USERS, id, updates);
    loadData();
  }, [loadData]);

  const deleteUser = useCallback((id: string) => {
    removeFromCollection(STORAGE_KEYS.USERS, id);
    loadData();
  }, [loadData]);

  // Product functions
  const getBattery = useCallback((id: string) => {
    return findInCollection<BatteryProduct>(STORAGE_KEYS.PRODUCTS_BATTERIES, id);
  }, []);

  const getInverter = useCallback((id: string) => {
    return findInCollection<InverterProduct>(STORAGE_KEYS.PRODUCTS_INVERTERS, id);
  }, []);

  // Commission functions
  const getCommission = useCallback((id: string) => {
    return findInCollection<CommissioningSubmission>(STORAGE_KEYS.COMMISSIONS, id);
  }, []);

  const createCommission = useCallback((data: Omit<CommissioningSubmission, 'id' | 'createdAt' | 'updatedAt'>): CommissioningSubmission => {
    const commission: CommissioningSubmission = {
      ...data,
      id: `comm-${uuidv4().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addToCollection(STORAGE_KEYS.COMMISSIONS, commission);
    loadData();
    return commission;
  }, [loadData]);

  const updateCommission = useCallback((id: string, updates: Partial<CommissioningSubmission>) => {
    updateInCollection(STORAGE_KEYS.COMMISSIONS, id, { ...updates, updatedAt: new Date().toISOString() });
    loadData();
  }, [loadData]);

  // Certificate functions
  const createCertificate = useCallback((data: Omit<Certificate, 'id'>): Certificate => {
    const certificate: Certificate = {
      ...data,
      id: `cert-${uuidv4().slice(0, 8)}`,
    };
    addToCollection(STORAGE_KEYS.CERTIFICATES, certificate);
    loadData();
    return certificate;
  }, [loadData]);

  // MIS Document functions
  const createMISDocument = useCallback((data: Omit<MIS3002Document, 'id' | 'createdAt' | 'updatedAt'>): MIS3002Document => {
    const doc: MIS3002Document = {
      ...data,
      id: `mis-${uuidv4().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addToCollection(STORAGE_KEYS.MIS_DOCUMENTS, doc);
    loadData();
    return doc;
  }, [loadData]);

  const updateMISDocument = useCallback((id: string, updates: Partial<MIS3002Document>) => {
    updateInCollection(STORAGE_KEYS.MIS_DOCUMENTS, id, { ...updates, updatedAt: new Date().toISOString() });
    loadData();
  }, [loadData]);

  return (
    <DataContext.Provider
      value={{
        quotes,
        getQuote,
        createQuote,
        updateQuote,
        deleteQuote,
        companies,
        getCompany,
        updateCompany,
        users,
        createUser,
        updateUser,
        deleteUser,
        batteries,
        inverters,
        manufacturers,
        getBattery,
        getInverter,
        commissions,
        getCommission,
        createCommission,
        updateCommission,
        certificates,
        createCertificate,
        misDocuments,
        createMISDocument,
        updateMISDocument,
        refreshData: loadData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
