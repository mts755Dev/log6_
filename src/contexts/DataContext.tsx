// @ts-nocheck - Legacy DataContext with type mismatches
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
// Removed localStorage imports - Using 100% Supabase now! ✅
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
    
    // Load commissions from Supabase
    try {
      const { data: commissionsData, error: commissionsError } = await supabase
        .from('commissioning_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!commissionsError && commissionsData) {
        const mappedCommissions: CommissioningSubmission[] = commissionsData.map((c: any) => ({
          id: c.id,
          quoteId: c.quote_id,
          installerId: c.installer_id,
          installerName: c.installer_name,
          companyId: c.company_id,
          customerName: c.customer_name,
          customerAddress: c.customer_address,
          systemType: c.system_type,
          batteryCapacity: c.battery_capacity,
          inverterPower: c.inverter_power,
          installationDate: c.installation_date,
          commissioningDate: c.commissioning_date,
          testResults: c.test_results || {},
          installationPhotos: c.installation_photos || [],
          status: c.status,
          reviewedBy: c.reviewed_by,
          reviewedAt: c.reviewed_at,
          reviewerNotes: c.reviewer_notes,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          submittedAt: c.submitted_at,
        }));
        setCommissions(mappedCommissions);
      } else {
        setCommissions([]);
      }
    } catch (error) {
      console.error('Error loading commissions:', error);
      setCommissions([]);
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
          stripeConnectAccountId: c.stripe_connect_account_id,
          stripeConnectOnboardingComplete: c.stripe_connect_onboarding_complete,
          stripeConnectDetailsSubmitted: c.stripe_connect_details_submitted,
          stripeConnectAccountStatus: c.stripe_connect_account_status,
          stripeConnectChargesEnabled: c.stripe_connect_charges_enabled,
          stripeConnectPayoutsEnabled: c.stripe_connect_payouts_enabled,
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

    // Load users from Supabase profiles table with timeout
    try {
      const profilesPromise = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Users fetch timeout')), 3000)
      );

      const { data: profilesData, error: profilesError } = await Promise.race([
        profilesPromise,
        timeoutPromise
      ]).catch((err) => {
        console.warn('⚠️ Users fetch timed out, loading empty array:', err);
        return { data: [], error: err };
      }) as any;

      if (!profilesError && profilesData) {
        const mappedUsers: User[] = profilesData.map((p: any) => ({
          id: p.id,
          email: p.email,
          name: p.full_name || p.email.split('@')[0],
          role: p.role,
          companyId: p.company_id,
          phone: p.phone,
          isActive: p.is_active,
          createdAt: p.created_at,
          lastLogin: p.updated_at,
        }));
        setUsers(mappedUsers);
      } else {
        setUsers([]); // Set empty array if fetch fails
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]); // Set empty array on error
    }
    
    // Load certificates from Supabase
    try {
      const { data: certsData, error: certsError } = await supabase
        .from('certificates')
        .select('*')
        .order('created_at', { ascending: false });

      if (!certsError && certsData) {
        const mappedCerts: Certificate[] = certsData.map((c: any) => ({
          id: c.id,
          submissionId: c.submission_id,
          quoteId: c.quote_id,
          companyId: c.company_id,
          installerId: c.installer_id,
          certificateNumber: c.certificate_number,
          certificateType: c.certificate_type,
          fileUrl: c.file_url,
          fileName: c.file_name,
          issueDate: c.issue_date,
          expiryDate: c.expiry_date,
          status: c.status,
          issuedBy: c.issued_by,
          notes: c.notes,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }));
        setCertificates(mappedCerts);
      } else {
        setCertificates([]);
      }
    } catch (error) {
      console.error('Error loading certificates:', error);
      setCertificates([]);
    }

    // Load MIS documents from Supabase
    try {
      const { data: misData, error: misError } = await supabase
        .from('mis_3002_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (!misError && misData) {
        const mappedMis: MIS3002Document[] = misData.map((m: any) => ({
          id: m.id,
          quoteId: m.quote_id,
          installerId: m.installer_id,
          companyId: m.company_id,
          systemDetails: m.system_details || {},
          installationDate: m.installation_date,
          installationAddress: m.installation_address,
          customerName: m.customer_name,
          customerEmail: m.customer_email,
          customerPhone: m.customer_phone,
          status: m.status,
          createdAt: m.created_at,
          updatedAt: m.updated_at,
          submittedAt: m.submitted_at,
        }));
        setMisDocuments(mappedMis);
      } else {
        setMisDocuments([]);
      }
    } catch (error) {
      console.error('Error loading MIS documents:', error);
      setMisDocuments([]);
    }
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

  const updateCompany = useCallback(async (id: string, updates: Partial<Company>) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: updates.name,
          email: updates.email,
          phone: updates.phone,
          address: updates.address,
          logo: updates.logo,
          brand_color: updates.brandColor,
          // Add other fields as needed
        })
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error updating company:', error);
      throw error;
    }
  }, [loadData]);

  // User functions (handled by Supabase auth + profiles table)
  const createUser = useCallback(async (userData: Omit<User, 'id' | 'createdAt'>): Promise<User> => {
    // Users are created via Supabase auth - this function is for reference only
    throw new Error('Users should be created via Supabase Auth signup');
  }, []);

  const updateUser = useCallback(async (id: string, updates: Partial<User>) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: updates.name,
          phone: updates.phone,
          is_active: updates.isActive,
        })
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }, [loadData]);

  const deleteUser = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }, [loadData]);

  // Product functions (fetch from Supabase)
  const getBattery = useCallback((id: string) => {
    return batteries.find(b => b.id === id);
  }, [batteries]);

  const getInverter = useCallback((id: string) => {
    return inverters.find(i => i.id === id);
  }, [inverters]);

  // Commission functions (Supabase)
  const getCommission = useCallback((id: string) => {
    return commissions.find(c => c.id === id);
  }, [commissions]);

  const createCommission = useCallback(async (data: Omit<CommissioningSubmission, 'id' | 'createdAt' | 'updatedAt'>): Promise<CommissioningSubmission> => {
    try {
      const { data: newCommission, error } = await supabase
        .from('commissioning_submissions')
        .insert([{
          quote_id: data.quoteId,
          installer_id: data.installerId,
          installer_name: data.installerName,
          company_id: data.companyId,
          customer_name: data.customerName,
          customer_address: data.customerAddress,
          system_type: data.systemType,
          battery_capacity: data.batteryCapacity,
          inverter_power: data.inverterPower,
          installation_date: data.installationDate,
          commissioning_date: data.commissioningDate,
          test_results: data.testResults,
          installation_photos: data.installationPhotos,
          status: data.status,
          submitted_at: data.submittedAt,
        }])
        .select()
        .single();

      if (error) throw error;
      await loadData();
      
      return {
        ...data,
        id: newCommission.id,
        createdAt: newCommission.created_at,
        updatedAt: newCommission.updated_at,
      };
    } catch (error) {
      console.error('Error creating commission:', error);
      throw error;
    }
  }, [loadData]);

  const updateCommission = useCallback(async (id: string, updates: Partial<CommissioningSubmission>) => {
    try {
      const { error } = await supabase
        .from('commissioning_submissions')
        .update({
          status: updates.status,
          reviewed_by: updates.reviewedBy,
          reviewed_at: updates.reviewedAt,
          reviewer_notes: updates.reviewerNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error updating commission:', error);
      throw error;
    }
  }, [loadData]);

  // Certificate functions (Supabase)
  const createCertificate = useCallback(async (data: Omit<Certificate, 'id'>): Promise<Certificate> => {
    try {
      const { data: newCert, error } = await supabase
        .from('certificates')
        .insert([{
          submission_id: data.submissionId,
          quote_id: data.quoteId,
          company_id: data.companyId,
          installer_id: data.installerId,
          certificate_number: data.certificateNumber,
          certificate_type: data.certificateType,
          file_url: data.fileUrl,
          file_name: data.fileName,
          issue_date: data.issueDate,
          expiry_date: data.expiryDate,
          status: data.status,
          issued_by: data.issuedBy,
          notes: data.notes,
        }])
        .select()
        .single();

      if (error) throw error;
      await loadData();
      
      return {
        ...data,
        id: newCert.id,
      };
    } catch (error) {
      console.error('Error creating certificate:', error);
      throw error;
    }
  }, [loadData]);

  // MIS Document functions (Supabase)
  const createMISDocument = useCallback(async (data: Omit<MIS3002Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<MIS3002Document> => {
    try {
      const { data: newDoc, error } = await supabase
        .from('mis_3002_documents')
        .insert([{
          quote_id: data.quoteId,
          installer_id: data.installerId,
          company_id: data.companyId,
          system_details: data.systemDetails,
          installation_date: data.installationDate,
          installation_address: data.installationAddress,
          customer_name: data.customerName,
          customer_email: data.customerEmail,
          customer_phone: data.customerPhone,
          status: data.status,
          submitted_at: data.submittedAt,
        }])
        .select()
        .single();

      if (error) throw error;
      await loadData();
      
      return {
        ...data,
        id: newDoc.id,
        createdAt: newDoc.created_at,
        updatedAt: newDoc.updated_at,
      };
    } catch (error) {
      console.error('Error creating MIS document:', error);
      throw error;
    }
  }, [loadData]);

  const updateMISDocument = useCallback(async (id: string, updates: Partial<MIS3002Document>) => {
    try {
      const { error } = await supabase
        .from('mis_3002_documents')
        .update({
          status: updates.status,
          system_details: updates.systemDetails,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error updating MIS document:', error);
      throw error;
    }
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
