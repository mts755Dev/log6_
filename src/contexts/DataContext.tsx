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
  createQuote: (quote: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Quote>;
  updateQuote: (id: string, updates: Partial<Quote>) => Promise<void>;
  deleteQuote: (id: string) => Promise<void>;
  canCreateQuote: (companyId: string) => Promise<{ canCreate: boolean; reason?: string }>;
  deductQuoteCredit: (companyId: string) => Promise<void>;
  
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
    // Load quotes from Supabase
    try {
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (!quotesError && quotesData) {
        const mappedQuotes: Quote[] = quotesData.map((q: any) => ({
          id: q.id,
          companyId: q.company_id,
          installerId: q.installer_id,
          installerName: q.installer_name,
          reference: q.reference,
          status: q.status,
          installationType: q.installation_type,
          customer: q.customer,
          tariff: q.tariff,
          lineItems: q.line_items,
          subtotal: parseFloat(q.subtotal),
          vatRate: parseFloat(q.vat_rate),
          vatAmount: parseFloat(q.vat_amount),
          total: parseFloat(q.total),
          deposit: parseFloat(q.deposit),
          margin: parseFloat(q.margin),
          marginPercentage: parseFloat(q.margin_percentage),
          roiProjections: q.roi_projections,
          paybackYears: parseFloat(q.payback_years),
          annualSavings: parseFloat(q.annual_savings),
          notes: q.notes || '',
          validUntil: q.valid_until,
          createdAt: q.created_at,
          updatedAt: q.updated_at,
          sentAt: q.sent_at,
          viewedAt: q.viewed_at,
          acceptedAt: q.accepted_at,
          customerSignature: q.customer_signature,
        }));
        setQuotes(mappedQuotes);
      }
    } catch (error) {
      console.error('Error loading quotes:', error);
      // Fallback to empty array on error
      setQuotes([]);
    }
    
    // Load commissions from localStorage (will migrate to Supabase later)
    const allCommissions = getCollection<CommissioningSubmission>(STORAGE_KEYS.COMMISSIONS);
    
    if (user?.role === 'admin') {
      setCommissions(allCommissions);
    } else if (user?.role === 'installer') {
      setCommissions(allCommissions.filter(c => c.companyId === user.companyId));
    } else if (user?.role === 'assessor') {
      setCommissions(allCommissions);
    } else {
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
          ownerId: c.owner_id, // The user who created this company
          paymentModel: c.payment_model, // Can be null for trial accounts
          creditBalance: c.credit_balance || 0,
          creditPrice: parseFloat(c.credit_price) || 3.00,
          subscriptionTier: c.subscription_tier,
          subscriptionStatus: c.subscription_status,
          subscriptionEndDate: c.subscription_end_date,
          monthlyProposalLimit: c.monthly_proposal_limit,
          proposalsUsedThisMonth: c.proposals_used_this_month || 0,
          proposalResetDate: c.proposal_reset_date,
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
    return quotes.find(q => q.id === id);
  }, [quotes]);

  const createQuote = useCallback(async (quoteData: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>): Promise<Quote> => {
    const quoteId = `quote-${uuidv4().slice(0, 8)}`;
    
    try {
      const { data, error } = await supabase
        .from('quotes')
        .insert([{
          id: quoteId,
          company_id: quoteData.companyId,
          installer_id: quoteData.installerId,
          installer_name: quoteData.installerName,
          reference: quoteData.reference,
          status: quoteData.status,
          installation_type: quoteData.installationType,
          customer: quoteData.customer,
          tariff: quoteData.tariff,
          line_items: quoteData.lineItems,
          subtotal: quoteData.subtotal,
          vat_rate: quoteData.vatRate,
          vat_amount: quoteData.vatAmount,
          total: quoteData.total,
          deposit: quoteData.deposit,
          margin: quoteData.margin,
          margin_percentage: quoteData.marginPercentage,
          roi_projections: quoteData.roiProjections,
          payback_years: quoteData.paybackYears,
          annual_savings: quoteData.annualSavings,
          notes: quoteData.notes,
          valid_until: quoteData.validUntil,
          sent_at: quoteData.sentAt,
          viewed_at: quoteData.viewedAt,
          accepted_at: quoteData.acceptedAt,
          customer_signature: quoteData.customerSignature,
        }])
        .select()
        .single();

      if (error) throw error;

      await loadData();

      return {
        ...quoteData,
        id: quoteId,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (error) {
      console.error('Error creating quote:', error);
      throw error;
    }
  }, [loadData]);

  const updateQuote = useCallback(async (id: string, updates: Partial<Quote>) => {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Map frontend fields to database fields
      if (updates.companyId !== undefined) updateData.company_id = updates.companyId;
      if (updates.installerId !== undefined) updateData.installer_id = updates.installerId;
      if (updates.installerName !== undefined) updateData.installer_name = updates.installerName;
      if (updates.reference !== undefined) updateData.reference = updates.reference;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.installationType !== undefined) updateData.installation_type = updates.installationType;
      if (updates.customer !== undefined) updateData.customer = updates.customer;
      if (updates.tariff !== undefined) updateData.tariff = updates.tariff;
      if (updates.lineItems !== undefined) updateData.line_items = updates.lineItems;
      if (updates.subtotal !== undefined) updateData.subtotal = updates.subtotal;
      if (updates.vatRate !== undefined) updateData.vat_rate = updates.vatRate;
      if (updates.vatAmount !== undefined) updateData.vat_amount = updates.vatAmount;
      if (updates.total !== undefined) updateData.total = updates.total;
      if (updates.deposit !== undefined) updateData.deposit = updates.deposit;
      if (updates.margin !== undefined) updateData.margin = updates.margin;
      if (updates.marginPercentage !== undefined) updateData.margin_percentage = updates.marginPercentage;
      if (updates.roiProjections !== undefined) updateData.roi_projections = updates.roiProjections;
      if (updates.paybackYears !== undefined) updateData.payback_years = updates.paybackYears;
      if (updates.annualSavings !== undefined) updateData.annual_savings = updates.annualSavings;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.validUntil !== undefined) updateData.valid_until = updates.validUntil;
      if (updates.sentAt !== undefined) updateData.sent_at = updates.sentAt;
      if (updates.viewedAt !== undefined) updateData.viewed_at = updates.viewedAt;
      if (updates.acceptedAt !== undefined) updateData.accepted_at = updates.acceptedAt;
      if (updates.customerSignature !== undefined) updateData.customer_signature = updates.customerSignature;

      const { error } = await supabase
        .from('quotes')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error('Error updating quote:', error);
      throw error;
    }
  }, [loadData]);

  const deleteQuote = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error('Error deleting quote:', error);
      throw error;
    }
  }, [loadData]);

  // Company functions
  const getCompany = useCallback((id: string) => {
    return companies.find(c => c.id === id);
  }, [companies]);

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

  // Check if company can create a quote
  const canCreateQuote = useCallback(async (companyId: string): Promise<{ canCreate: boolean; reason?: string }> => {
    try {
      const { data: company, error } = await supabase
        .from('companies')
        .select('payment_model, credit_balance, monthly_proposal_limit, proposals_used_this_month, subscription_status')
        .eq('id', companyId)
        .single();

      if (error || !company) {
        return { canCreate: false, reason: 'Company not found' };
      }

      // Check subscription status first
      if (company.subscription_status !== 'active' && company.subscription_status !== 'trial') {
        return { canCreate: false, reason: 'Subscription is not active' };
      }

      // Handle trial accounts (payment_model is null)
      if (company.subscription_status === 'trial' && !company.payment_model) {
        if (company.credit_balance <= 0) {
          return { canCreate: false, reason: 'Trial credits exhausted. Please choose a payment model to continue.' };
        }
        return { canCreate: true };
      }

      // Handle pay-as-you-go accounts
      if (company.payment_model === 'pay-as-you-go') {
        if (company.credit_balance <= 0) {
          return { canCreate: false, reason: 'Insufficient credits. Please purchase more credits.' };
        }
        return { canCreate: true };
      } else {
        // Subscription model
        if (company.monthly_proposal_limit !== null && company.proposals_used_this_month >= company.monthly_proposal_limit) {
          return { canCreate: false, reason: `Monthly proposal limit of ${company.monthly_proposal_limit} reached. Resets next month.` };
        }
        return { canCreate: true };
      }
    } catch (error) {
      console.error('Error checking quote creation eligibility:', error);
      return { canCreate: false, reason: 'Error checking eligibility' };
    }
  }, []);

  // Deduct credit or increment proposal counter
  const deductQuoteCredit = useCallback(async (companyId: string) => {
    try {
      const { data: company, error: fetchError } = await supabase
        .from('companies')
        .select('payment_model, credit_balance, proposals_used_this_month, subscription_status')
        .eq('id', companyId)
        .single();

      if (fetchError || !company) {
        throw new Error('Company not found');
      }

      // For trial accounts or pay-as-you-go, deduct credits
      if (company.subscription_status === 'trial' || company.payment_model === 'pay-as-you-go') {
        // Deduct 1 credit
        const { error: updateError } = await supabase
          .from('companies')
          .update({ credit_balance: company.credit_balance - 1 })
          .eq('id', companyId);

        if (updateError) throw updateError;
      } else if (company.payment_model === 'subscription') {
        // Increment proposal counter for subscription users
        const { error: updateError } = await supabase
          .from('companies')
          .update({ proposals_used_this_month: company.proposals_used_this_month + 1 })
          .eq('id', companyId);

        if (updateError) throw updateError;
      }

      await loadData(); // Refresh company data
    } catch (error) {
      console.error('Error deducting quote credit:', error);
      throw error;
    }
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
        canCreateQuote,
        deductQuoteCredit,
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
