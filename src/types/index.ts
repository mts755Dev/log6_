// User & Auth Types
export type UserRole = 'admin' | 'installer' | 'assessor';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
  companyName: string;
  createdAt: string;
  lastLogin: string;
  isActive: boolean;
  avatar?: string;
}

export interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  postcode: string;
  mcsNumber?: string;
  isUmbrellaScheme: boolean;
  subscriptionTier: 'starter' | 'professional' | 'enterprise';
  subscriptionStatus: 'active' | 'trial' | 'expired' | 'cancelled';
  subscriptionEndDate: string;
  logo?: string;
  brandColor?: string;
  createdAt: string;
}

// Product Types
export interface BatteryProduct {
  id: string;
  manufacturerId: string;
  manufacturerName: string;
  model: string;
  capacityKwh: number;
  powerKw: number;
  chemistry: string;
  warrantyYears: number;
  cycleLife: number;
  efficiency: number;
  dimensions: string;
  weight: number;
  costPrice: number;
  rrp: number;
  imageUrl?: string;
  datasheet?: string;
  isActive: boolean;
}

export interface InverterProduct {
  id: string;
  manufacturerId: string;
  manufacturerName: string;
  model: string;
  powerKw: number;
  phases: 1 | 3;
  efficiency: number;
  warrantyYears: number;
  costPrice: number;
  rrp: number;
  features: string[];
  imageUrl?: string;
  isActive: boolean;
}

export interface Manufacturer {
  id: string;
  name: string;
  logo?: string;
  website?: string;
  supportEmail?: string;
  supportPhone?: string;
  isActive: boolean;
}

// Quote & Proposal Types
export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
export type InstallationType = 'residential' | 'commercial';

export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  postcode: string;
  propertyType: 'house' | 'flat' | 'bungalow' | 'commercial';
  existingSolar: boolean;
  solarCapacityKwp?: number;
  annualConsumptionKwh: number;
  currentTariff: string;
  hasEv: boolean;
  evMileagePerYear?: number;
}

export interface TariffInfo {
  importRate: number;
  exportRate: number;
  standingCharge: number;
  hasTimeOfUse: boolean;
  peakRate?: number;
  offPeakRate?: number;
  peakHoursStart?: string;
  peakHoursEnd?: string;
}

export interface QuoteLineItem {
  id: string;
  type: 'battery' | 'inverter' | 'installation' | 'other';
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
}

export interface ROIProjection {
  year: number;
  savings: number;
  cumulativeSavings: number;
  evTaxSavings: number;
  exportRevenue: number;
  loadShiftSavings: number;
}

export interface Quote {
  id: string;
  companyId: string;
  installerId: string;
  installerName: string;
  reference: string;
  status: QuoteStatus;
  installationType: InstallationType;
  customer: CustomerInfo;
  tariff: TariffInfo;
  lineItems: QuoteLineItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  deposit: number;
  margin: number;
  marginPercentage: number;
  roiProjections: ROIProjection[];
  paybackYears: number;
  annualSavings: number;
  notes: string;
  validUntil: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  customerSignature?: string;
}

// MIS-3002 Types
export interface MIS3002Document {
  id: string;
  quoteId: string;
  installerId: string;
  companyId: string;
  systemDetails: {
    batteryModel: string;
    batteryCapacity: number;
    inverterModel: string;
    inverterPower: number;
    installationDate: string;
    commissioningDate: string;
  };
  siteDetails: {
    meterType: string;
    dnOperator: string;
    mpan: string;
    gridConnectionType: string;
    earthingSystem: string;
  };
  testResults: {
    insulationResistance: number;
    earthFaultLoopImpedance: number;
    rcdTripTime: number;
    polarity: boolean;
    functionalTests: boolean;
  };
  declaration: {
    compliantWithBS7671: boolean;
    compliantWithMIS3002: boolean;
    installerSignature: string;
    installerSignatureDate: string;
    customerSignature: string;
    customerSignatureDate: string;
  };
  status: 'draft' | 'completed' | 'approved';
  createdAt: string;
  updatedAt: string;
}

// Umbrella Scheme Types
export type CommissioningStatus = 'pending_review' | 'approved' | 'rejected' | 'requires_changes';

export interface CommissioningSubmission {
  id: string;
  quoteId: string;
  installerId: string;
  installerName: string;
  companyId: string;
  companyName: string;
  assessorId?: string;
  assessorName?: string;
  status: CommissioningStatus;
  systemDetails: {
    batteryModel: string;
    inverterModel: string;
    capacityKwh: number;
    installationDate: string;
  };
  siteDetails: {
    customerName: string;
    address: string;
    postcode: string;
  };
  checklist: CommissioningChecklist;
  photos: CommissioningPhoto[];
  notes: string;
  rejectionReason?: string;
  certificateId?: string;
  submittedAt: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommissioningChecklist {
  visualInspection: boolean;
  cablingCompliant: boolean;
  labelingComplete: boolean;
  isolationDevices: boolean;
  earthingVerified: boolean;
  testingComplete: boolean;
  customerBriefed: boolean;
  documentationProvided: boolean;
}

export interface CommissioningPhoto {
  id: string;
  type: 'battery' | 'inverter' | 'cabling' | 'meter' | 'labels' | 'other';
  url: string;
  caption: string;
  uploadedAt: string;
}

export interface Certificate {
  id: string;
  submissionId: string;
  quoteId: string;
  companyId: string;
  installerId: string;
  certificateNumber: string;
  issueDate: string;
  systemDetails: {
    batteryModel: string;
    inverterModel: string;
    capacityKwh: number;
  };
  siteDetails: {
    customerName: string;
    address: string;
    postcode: string;
  };
  pdfUrl?: string;
}

// Dashboard & Analytics Types
export interface DashboardStats {
  totalQuotes: number;
  acceptedQuotes: number;
  pendingQuotes: number;
  totalRevenue: number;
  averageQuoteValue: number;
  conversionRate: number;
  monthlyQuotes: { month: string; count: number; value: number }[];
  quotesByStatus: { status: string; count: number }[];
}

// Subscription Types
export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'starter' | 'professional' | 'enterprise';
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  maxUsers: number;
  maxQuotesPerMonth: number;
  includesUmbrella: boolean;
  includesApi: boolean;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: 'quote' | 'submission' | 'system' | 'payment';
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

