// User & Auth Types
export type UserRole = 'admin' | 'installer' | 'assessor' | 'engineer' | 'compliance_officer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string | null;
  companyName?: string;
  phone?: string | null;
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
  ownerId?: string; // The user who created/owns this company
  
  // Payment Model
  paymentModel: 'pay-as-you-go' | 'subscription' | null; // null = trial/no payment model chosen yet
  
  // Pay-as-you-go fields
  creditBalance: number;
  creditPrice: number; // Price per credit (default £3)
  
  // Subscription fields
  subscriptionTier: 'starter' | 'professional' | 'enterprise';
  subscriptionStatus: 'active' | 'trial' | 'expired' | 'cancelled';
  subscriptionEndDate: string;
  monthlyProposalLimit: number | null; // null = unlimited
  proposalsUsedThisMonth: number;
  proposalResetDate: string; // Date when counter resets
  
  // Stripe Connect fields
  stripeConnectAccountId?: string;
  stripeConnectOnboardingComplete?: boolean;
  stripeConnectDetailsSubmitted?: boolean;
  stripeConnectAccountStatus?: 'pending' | 'enabled' | 'disabled' | 'rejected';
  stripeConnectChargesEnabled?: boolean;
  stripeConnectPayoutsEnabled?: boolean;
  
  // Branding
  logo?: string;
  brandColor?: string;
  
  // Insurance & Compliance
  insurance_provider?: 'QANW' | 'HICE' | 'REC' | null;
  consumerCode?: ConsumerCode;
  
  // Timestamps
  createdAt: string;
}

export type ConsumerCode = 'RECC' | 'HIES' | 'NAPIT' | 'TrustMark' | 'MCS';

export const CONSUMER_CODE_LABELS: Record<ConsumerCode, string> = {
  RECC: 'RECC — Renewable Energy Consumer Code',
  HIES: 'HIES — Home Insulation & Energy Systems',
  NAPIT: 'NAPIT Consumer Code',
  TrustMark: 'TrustMark',
  MCS: 'MCS — Microgeneration Certification Scheme',
};

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
export type QuoteStatus = 
  | 'draft' 
  | 'sent' 
  | 'viewed' 
  | 'accepted' 
  | 'rejected' 
  | 'expired'
  | 'deposit_paid'       // ✨ Customer paid deposit
  | 'scheduled'          // ✨ Installation date scheduled
  | 'in_progress'        // ✨ Installation in progress
  | 'completed'          // ✨ Installation completed
  | 'commissioning'      // ✨ Commissioning docs uploaded
  | 'compliance_review'  // ✨ Awaiting compliance approval
  | 'mcs_certified'      // ✨ MCS certificate generated
  | 'final_invoice_sent' // ✨ Final invoice sent
  | 'closed';            // ✨ Job fully complete

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
  share_token?: string;
  share_token_expires_at?: string;
  
  // ✨ Phase 5A: Job Tracking Fields
  depositPaidAt?: string;
  scheduledAt?: string;
  installationDate?: string;
  installationStartedAt?: string;
  installationCompletedAt?: string;
  commissioningUploadedAt?: string;
  complianceReviewedAt?: string;
  mcsCertifiedAt?: string;
  finalInvoiceSentAt?: string;
  closedAt?: string;
  
  // Personnel assignments
  assignedEngineerId?: string;
  complianceOfficerId?: string;
  
  // Stage-specific notes
  installationNotes?: string;
  commissioningNotes?: string;
  
  // Customer availability for installation
  customerAvailability?: {
    dates: string[];
    timeSlot: 'morning' | 'afternoon' | 'fullday';
    notes?: string;
    submittedAt: string;
  };
  complianceNotes?: string;
  rejectionReason?: string;
  deposit_paid?: boolean;
  deposit_paid_at?: string;
  stripe_payment_intent_id?: string;
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

// Document Bank Types
export type DocumentCategory = 'consumer_code_leaflet' | 'product_datasheet' | 'template';
export type InsuranceProvider = 'QANW' | 'HICE' | 'REC';
export type ProductType = 'battery' | 'inverter';

export interface Document {
  id: string;
  name: string;
  description?: string;
  category: DocumentCategory;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  
  // Linking fields
  insuranceProvider?: InsuranceProvider;
  productId?: string;
  productType?: ProductType;
  
  // Metadata
  version: number;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteDocument {
  id: string;
  quoteId: string;
  documentId: string;
  document?: Document; // Populated when fetching
  attachedAt: string;
}



// ============================================================================
// DOCUMENT TEMPLATES
// ============================================================================

export type TemplateCategory = 'proposal' | 'contract' | 'handover' | 'invoice';

export interface DocumentTemplate {
  id: string;
  code: string; // FO7A, F13I, F71, etc.
  name: string;
  description?: string;
  category: TemplateCategory;
  htmlContent: string;
  cssStyles?: string;
  mergeFields: string[]; // List of available merge fields
  isActive: boolean;
  autoGenerate: boolean;
  version: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}export interface GeneratedDocument {
  id: string;
  templateId: string;
  quoteId?: string;
  invoiceId?: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  generatedBy?: string;
  generatedAt: string;
  mergeData?: Record<string, any>;
}

// ============================================================================
// INVOICES
// ============================================================================

export type InvoiceType = 'deposit' | 'final';
export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string; // INV-XXXXXX
  quoteId: string;
  companyId: string;
  type: InvoiceType;
  
  // Customer Info
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  
  // Financial
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  lineItems: InvoiceLineItem[];
  
  // Payment
  status: InvoiceStatus;
  paymentMethod?: string;
  paidAt?: string;
  stripePaymentIntentId?: string;
  
  // Dates
  issueDate: string;
  dueDate: string;
  
  // Document
  pdfUrl?: string;
  
  // Tracking
  sentAt?: string;
  viewedAt?: string;
  
  // Metadata
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// ============================================================================
// INSTALLER ONBOARDING
// ============================================================================

export type OnboardingDocumentType =
  | 'competency_cards'
  | 'course_certificates'
  | 'insurance'
  | 'mcs_certificate'
  | 'consumer_code_membership'
  | 'ibg_certificate'
  | 'waste_carrier_license'
  | 'weee_license';

export type OnboardingDocumentStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'requires_update';

export type CompanyOnboardingStatus =
  | 'pending'
  | 'documents_submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'requires_update';

export interface InstallerOnboardingDoc {
  id: string;
  companyId: string;
  uploadedBy?: string;
  documentType: OnboardingDocumentType;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  issuedDate?: string;
  expiryDate?: string;
  referenceNumber?: string;
  providerName?: string;
  status: OnboardingDocumentStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  adminNotes?: string;
  version: number;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | 'expiry_warning'
  | 'expired'
  | 'approval_required'
  | 'approved'
  | 'rejected'
  | 'update_required';

export interface DocumentNotification {
  id: string;
  companyId: string;
  documentId?: string;
  userId?: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

// ============================================================================
// NOMINATED TECHNICAL PERSONS
// ============================================================================

export type NTPSpecialization = 'heat_pumps' | 'solar' | 'battery_storage' | 'ev_charging';

export const NTP_SPECIALIZATION_LABELS: Record<NTPSpecialization, string> = {
  heat_pumps: 'Heat Pumps',
  solar: 'Solar PV',
  battery_storage: 'Battery Storage',
  ev_charging: 'EV Charging',
};

export interface NominatedTechnicalPerson {
  id: string;
  companyId: string;
  fullName: string;
  email?: string;
  phone?: string;
  specializations: NTPSpecialization[];
  idDocumentUrl?: string;
  qualificationCardUrls: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
