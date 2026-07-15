import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import SignatureCanvas from 'react-signature-canvas';
import {
  ArrowLeft,
  ArrowRight,
  User,
  Home,
  Zap,
  Battery,
  Calculator,
  FileText,
  Check,
  Plus,
  Trash2,
  Car,
  Sun,
  PoundSterling,
  TrendingUp,
  Copy,
  ExternalLink,
  Eye,
  Send,
  CheckCircle2,
  Calendar,
  Clock,
  Loader2,
  MessageCircle,
  Mail,
  PenLine,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { UkAddressFields } from '../../components/ui/UkAddressFields';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { ChoosePaymentModel } from '../../components/payments/ChoosePaymentModel';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { createLivingDocumentsForQuote } from '../../lib/livingDocuments';
import { sendQuoteToCustomer, openQuoteInEmailClient } from '../../services/emailNotifications';
import {
  emptyDocumentDetails,
  getDocumentDetails,
  validateCustomerStep,
  validateQuoteForDocumentGeneration,
} from '../../lib/quoteDocumentValidation';
import { listStoredMergeFields } from '../../lib/templateMergeFields';
import type { CustomLinkedField } from '../../lib/templateBuilder';
import type { Quote, QuoteLineItem, ROIProjection, CustomerInfo, TariffInfo, QuoteDocumentDetails } from '../../types';
import { format } from 'date-fns';

const steps = [
  { id: 'customer', title: 'Customer Info', icon: <User className="w-5 h-5" /> },
  { id: 'property', title: 'Property & Energy', icon: <Home className="w-5 h-5" /> },
  { id: 'tariff', title: 'Tariff Details', icon: <Zap className="w-5 h-5" /> },
  { id: 'products', title: 'Products', icon: <Battery className="w-5 h-5" /> },
  { id: 'pricing', title: 'Pricing & ROI', icon: <Calculator className="w-5 h-5" /> },
  { id: 'review', title: 'Review', icon: <FileText className="w-5 h-5" /> },
];

export function NewQuotePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { batteries, inverters, createQuote, updateQuote, getQuote, canCreateQuote, deductQuoteCredit, getCompany } = useData();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showGeneratingModal, setShowGeneratingModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [lastCreatedQuoteId, setLastCreatedQuoteId] = useState<string | null>(null);
  const [quoteForShare, setQuoteForShare] = useState<Quote | null>(null);
  const [templateCustomFields, setTemplateCustomFields] = useState<CustomLinkedField[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const installerSigRef = useRef<SignatureCanvas>(null);

  // Form state
  const [customer, setCustomer] = useState<CustomerInfo>({
    name: '',
    email: '',
    phone: '',
    address: '',
    postcode: '',
    propertyType: 'house',
    existingSolar: false,
    solarCapacityKwp: 0,
    annualConsumptionKwh: 4000,
    currentTariff: '',
    hasEv: false,
    evMileagePerYear: 0,
    documentDetails: emptyDocumentDetails(),
  });

  const updateDocumentDetails = (patch: Partial<QuoteDocumentDetails>) => {
    setCustomer((current) => ({
      ...current,
      documentDetails: {
        ...emptyDocumentDetails(),
        ...getDocumentDetails(current),
        ...patch,
      },
    }));
  };

  const documentDetails = getDocumentDetails(customer);
  const companyProfile = user?.companyId ? getCompany(user.companyId) : null;
  const companyInstallerSignature = companyProfile?.installerSignature || '';

  // Auto-load company signature onto the quote when creating
  useEffect(() => {
    if (id || !companyInstallerSignature) return;
    setCustomer((current) => {
      const details = getDocumentDetails(current);
      if (details.installerSignature) return current;
      return {
        ...current,
        documentDetails: {
          ...details,
          installerSignature: companyInstallerSignature,
        },
      };
    });
  }, [id, companyInstallerSignature]);

  useEffect(() => {
    let cancelled = false;
    const loadCustomFields = async () => {
      const fields = await listStoredMergeFields();
      if (!cancelled) {
        setTemplateCustomFields(
          fields.map((f) => ({ key: f.key, label: f.label })),
        );
      }
    };
    void loadCustomFields();
    return () => {
      cancelled = true;
    };
  }, []);

  const [tariff, setTariff] = useState<TariffInfo>({
    importRate: 0.28,
    exportRate: 0.15,
    standingCharge: 0.50,
    hasTimeOfUse: false,
    peakRate: 0.35,
    offPeakRate: 0.10,
    peakHoursStart: '16:00',
    peakHoursEnd: '19:00',
  });

  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [installationCost, setInstallationCost] = useState(1200);
  const [margin, setMargin] = useState(25);
  const [notes, setNotes] = useState('');

  // Calculated values
  const calculations = useMemo(() => {
    const productCost = lineItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
    const productPrice = lineItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const subtotal = productPrice + installationCost;
    const vatRate = customer.existingSolar ? 0 : 0; // 0% VAT on battery storage
    const vatAmount = subtotal * vatRate;
    const total = subtotal + vatAmount;
    const totalCost = productCost + (installationCost * 0.6); // Assume 60% of install is cost
    const profit = total - totalCost;
    const marginPercentage = total > 0 ? (profit / total) * 100 : 0;

    // ROI Calculations
    const batteryCapacity = lineItems
      .filter(item => item.type === 'battery')
      .reduce((sum, item) => {
        const battery = batteries.find(b => b.id === item.productId);
        return sum + (battery?.capacityKwh || 0) * item.quantity;
      }, 0);

    // Annual savings calculations
    let annualSavings = 0;
    let loadShiftSavings = 0;
    let exportRevenue = 0;
    let evTaxSavings = 0;

    if (batteryCapacity > 0) {
      // Load shifting savings (charging at off-peak, using at peak)
      if (tariff.hasTimeOfUse) {
        const dailyCycles = 1;
        const usableCapacity = batteryCapacity * 0.9; // 90% depth of discharge
        const rateDifference = (tariff.peakRate || 0.35) - (tariff.offPeakRate || 0.10);
        loadShiftSavings = usableCapacity * dailyCycles * 365 * rateDifference * 0.8; // 80% efficiency
      } else {
        // Standard tariff - save by using stored solar
        loadShiftSavings = batteryCapacity * 0.8 * 365 * tariff.importRate * 0.5;
      }

      // Export revenue (if solar exists)
      if (customer.existingSolar && customer.solarCapacityKwp) {
        const annualGeneration = customer.solarCapacityKwp * 900; // ~900 kWh per kWp in UK
        const batteryStoredExport = Math.min(annualGeneration * 0.4, batteryCapacity * 365);
        const selfConsumedIncrease = batteryStoredExport * 0.7;
        exportRevenue = selfConsumedIncrease * (tariff.importRate - tariff.exportRate);
      }

      // EV tax savings (charging at home vs petrol)
      if (customer.hasEv && customer.evMileagePerYear) {
        // Assume 0.3 kWh/mile for EV, 15p/mile for petrol
        const evCostPerMile = 0.3 * (tariff.hasTimeOfUse ? (tariff.offPeakRate || 0.10) : tariff.importRate);
        const petrolCostPerMile = 0.15;
        evTaxSavings = customer.evMileagePerYear * (petrolCostPerMile - evCostPerMile);
      }

      annualSavings = loadShiftSavings + exportRevenue + evTaxSavings;
    }

    const paybackYears = annualSavings > 0 ? total / annualSavings : 0;

    // Generate 10-year ROI projections
    const roiProjections: ROIProjection[] = Array.from({ length: 10 }, (_, i) => {
      const year = i + 1;
      const inflationFactor = Math.pow(1.03, year - 1); // 3% annual inflation
      return {
        year,
        savings: Math.round((loadShiftSavings + exportRevenue) * inflationFactor),
        cumulativeSavings: Math.round((loadShiftSavings + exportRevenue) * inflationFactor * year),
        evTaxSavings: Math.round(evTaxSavings * inflationFactor),
        exportRevenue: Math.round(exportRevenue * inflationFactor),
        loadShiftSavings: Math.round(loadShiftSavings * inflationFactor),
      };
    });

    return {
      productCost,
      productPrice,
      subtotal,
      vatRate,
      vatAmount,
      total,
      totalCost,
      profit,
      marginPercentage,
      annualSavings: Math.round(annualSavings),
      paybackYears: Math.round(paybackYears * 10) / 10,
      batteryCapacity,
      roiProjections,
      loadShiftSavings: Math.round(loadShiftSavings),
      exportRevenue: Math.round(exportRevenue),
      evTaxSavings: Math.round(evTaxSavings),
    };
  }, [lineItems, installationCost, batteries, tariff, customer]);

  // Add product to line items
  const addProduct = (type: 'battery' | 'inverter', productId: string) => {
    const product = type === 'battery' 
      ? batteries.find(b => b.id === productId)
      : inverters.find(i => i.id === productId);
    
    if (!product) return;

    setLineItems([...lineItems, {
      id: uuidv4(),
      type,
      productId,
      description: `${product.manufacturerName} ${product.model}`,
      quantity: 1,
      unitPrice: product.rrp,
      costPrice: product.costPrice,
    }]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, updates: Partial<QuoteLineItem>) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  // Prefill installer roles for document signatures when creating a new quote
  useEffect(() => {
    if (id || !user?.name) return;
    setCustomer((current) => {
      const details = getDocumentDetails(current);
      if (details.designerName || details.technicalOpName || details.surveyorName) {
        return current;
      }
      return {
        ...current,
        documentDetails: {
          ...details,
          designerName: user.name,
          technicalOpName: user.name,
          surveyorName: user.name,
        },
      };
    });
  }, [id, user?.name]);

  // Load existing quote data for editing
  useEffect(() => {
    if (id) {
      const existingQuote = getQuote(id);
      if (existingQuote) {
        setIsEditMode(true);
        setCustomer({
          ...existingQuote.customer,
          documentDetails: {
            ...emptyDocumentDetails(),
            ...getDocumentDetails(existingQuote.customer),
            designerName:
              getDocumentDetails(existingQuote.customer).designerName ||
              existingQuote.installerName ||
              '',
            technicalOpName:
              getDocumentDetails(existingQuote.customer).technicalOpName ||
              existingQuote.installerName ||
              '',
            surveyorName:
              getDocumentDetails(existingQuote.customer).surveyorName ||
              existingQuote.installerName ||
              '',
          },
        });
        setTariff(existingQuote.tariff);
        setLineItems(existingQuote.lineItems);
        setMargin(existingQuote.marginPercentage); // Use margin percentage from existing quote
        setNotes(existingQuote.notes);
        // Extract installation cost from line items if present
        const installItem = existingQuote.lineItems.find(item => item.type === 'installation');
        if (installItem) {
          setInstallationCost(installItem.unitPrice);
        }
      } else {
        toast.error('Quote not found');
        navigate('/installer/quotes');
      }
    }
  }, [id, getQuote, navigate, toast]);

  // Navigation
  const nextStep = () => {
    if (currentStep === 0) {
      const errors = validateCustomerStep(customer, user?.name, companyInstallerSignature);
      if (errors.length) {
        toast.error(`Please complete: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '…' : ''}`);
        return;
      }
    }
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  // Submit quote
  const getShareLink = () => {
    if (!shareToken || !quoteForShare) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/quote/${quoteForShare.id}/${shareToken}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareLink());
      toast.success('Secure link copied to clipboard!');
    } catch (error) {
      console.error('Error copying link:', error);
      toast.error('Failed to copy link');
    }
  };

  const handleOpenCustomerView = () => {
    window.open(getShareLink(), '_blank');
  };

  const markQuoteSentAndDeductCredit = async () => {
    if (!quoteForShare || !user?.companyId || quoteForShare.status !== 'draft') return;

    const eligibility = await canCreateQuote(user.companyId);
    if (!eligibility.canCreate) {
      toast.error(eligibility.reason || 'Unable to send quote');
      throw new Error(eligibility.reason || 'Unable to send quote');
    }

    const sentAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('quotes')
      .update({
        status: 'sent',
        sent_at: sentAt,
      })
      .eq('id', quoteForShare.id);

    if (updateError) throw updateError;

    await deductQuoteCredit(user.companyId);
    setQuoteForShare({ ...quoteForShare, status: 'sent', sentAt });
  };

  const handleShareWhatsApp = async () => {
    if (!quoteForShare || !shareToken) return;

    try {
      if (quoteForShare.status === 'draft') {
        await markQuoteSentAndDeductCredit();
        toast.success('Quote sent — 1 credit used.');
      }

      const link = getShareLink();
      const customerPhone = customer.phone.replace(/\s+/g, '');
      const company = user?.companyId ? getCompany(user.companyId) : null;
      const message = `Hi ${customer.name}, here is your solar quote from ${company?.name || 'our team'}: ${link}`;
      const whatsappUrl = `https://wa.me/${customerPhone}?text=${encodeURIComponent(message)}`;

      window.open(whatsappUrl, '_blank');
    } catch (error: unknown) {
      console.error('Error sharing quote on WhatsApp:', error);
      const message = error instanceof Error ? error.message : 'Failed to send quote';
      toast.error(message);
    }
  };

  const handleSendEmail = async () => {
    if (!quoteForShare || !shareToken || !user) return;
    
    setIsSendingEmail(true);
    try {
      if (quoteForShare.status === 'draft') {
        await markQuoteSentAndDeductCredit();
        toast.success('Quote sent — 1 credit used.');
      }

      const emailPayload = {
        quote: quoteForShare,
        recipient: {
          email: customer.email,
          name: customer.name,
        },
        shareLink: getShareLink(),
        companyName: (user.companyId ? getCompany(user.companyId)?.name : '') || 'Your Company',
        companyEmail: user.email || '',
        companyPhone: '+44 782346382',
      };

      const result = await sendQuoteToCustomer(emailPayload);

      if (result.success) {
        toast.success('Email sent successfully to customer!');
      } else {
        openQuoteInEmailClient(emailPayload);
        toast.info('Opening your email app — send the message from there.');
      }
    } catch (error: unknown) {
      console.error('Error in handleSendEmail:', error);
      const message = error instanceof Error ? error.message : 'Failed to send quote';
      toast.error(message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSubmit = async (status: 'draft' | 'sent') => {
    if (!user || !user.companyId) {
      toast.error('Please log in to create a quote');
      return;
    }

    // Capture signature from the pad if it hasn't been stored yet
    if (
      (!getDocumentDetails(customer).installerSignature) &&
      installerSigRef.current &&
      !installerSigRef.current.isEmpty()
    ) {
      updateDocumentDetails({
        installerSignature: installerSigRef.current.toDataURL('image/png'),
      });
    }
    const customerForSave: CustomerInfo = {
      ...customer,
      documentDetails: {
        ...getDocumentDetails(customer),
        installerSignature:
          getDocumentDetails(customer).installerSignature ||
          (installerSigRef.current && !installerSigRef.current.isEmpty()
            ? installerSigRef.current.toDataURL('image/png')
            : '') ||
          companyInstallerSignature,
      },
    };
    const saveErrors = validateQuoteForDocumentGeneration({
      customer: customerForSave,
      lineItems,
      installerName: user.name,
      companyInstallerSignature,
    });
    if (saveErrors.length) {
      toast.error(
        `Fill required document details first: ${saveErrors.slice(0, 3).join(', ')}${
          saveErrors.length > 3 ? '…' : ''
        }`,
      );
      setCurrentStep(0);
      return;
    }

    try {
      setIsSubmitting(true);
      setShowGeneratingModal(true);

      const company = getCompany(user.companyId);
      
      // Check if company can create a quote
      if (status === 'sent') {
        const eligibility = await canCreateQuote(user.companyId);
        if (!eligibility.canCreate) {
          // If it's a credit/limit issue and still on trial, show payment modal
          if (company && company.subscriptionStatus === 'trial') {
            setShowPaymentModal(true);
          }
          toast.error(eligibility.reason || 'Unable to create quote');
          setIsSubmitting(false);
          setShowGeneratingModal(false);
          return;
        }
      }

      // Add installation line item if not present
      const finalLineItems = [...lineItems];
      if (!finalLineItems.some(item => item.type === 'installation')) {
        finalLineItems.push({
          id: uuidv4(),
          type: 'installation',
          description: 'Professional Installation & Commissioning',
          quantity: 1,
          unitPrice: installationCost,
          costPrice: installationCost * 0.6,
        });
      }

      let quoteToUse: Quote;
      const previousStatus =
        isEditMode && id ? (getQuote(id)?.status ?? 'draft') : 'draft';

      if (isEditMode && id) {
        // Update existing quote
        const updateData: Partial<Quote> = {
          status,
          customer: customerForSave,
          tariff,
          lineItems: finalLineItems,
          subtotal: calculations.subtotal,
          vatRate: calculations.vatRate,
          vatAmount: calculations.vatAmount,
          total: calculations.total,
          deposit: Math.round(calculations.total * 0.25),
          margin: calculations.profit,
          marginPercentage: calculations.marginPercentage,
          roiProjections: calculations.roiProjections,
          paybackYears: calculations.paybackYears,
          annualSavings: calculations.annualSavings,
          notes,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          sentAt: status === 'sent' ? new Date().toISOString() : undefined,
        };

        await updateQuote(id, updateData);
        const updatedQuote = getQuote(id);
        if (!updatedQuote) throw new Error('Updated quote not found');
        quoteToUse = { ...updatedQuote, customer: customerForSave };
      } else {
        // Create new quote
        const quoteData: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'> = {
          companyId: user.companyId,
          installerId: user.id,
          installerName: user.name,
          reference: `QT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
          status,
          installationType: 'residential',
          customer: customerForSave,
          tariff,
          lineItems: finalLineItems,
          subtotal: calculations.subtotal,
          vatRate: calculations.vatRate,
          vatAmount: calculations.vatAmount,
          total: calculations.total,
          deposit: Math.round(calculations.total * 0.25),
          margin: calculations.profit,
          marginPercentage: calculations.marginPercentage,
          roiProjections: calculations.roiProjections,
          paybackYears: calculations.paybackYears,
          annualSavings: calculations.annualSavings,
          notes,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          sentAt: status === 'sent' ? new Date().toISOString() : undefined,
        };

        quoteToUse = await createQuote(quoteData);
        quoteToUse = { ...quoteToUse, customer: customerForSave };
      }

      setQuoteForShare(quoteToUse);

      if (status === 'sent' && previousStatus === 'draft') {
        await deductQuoteCredit(user.companyId);
      }

      try {
        // 🎯 STEP 1: Generate share token
        const { data: tokenData, error: tokenError } = await supabase.rpc('generate_quote_share_token');
        if (tokenError) {
          console.error('Error generating token:', tokenError);
        } else {
          const token = tokenData as string;
          setShareToken(token);
          await supabase
            .from('quotes')
            .update({ share_token: token })
            .eq('id', quoteToUse.id);
          console.log('✅ Share token generated');
        }

        // 🎯 STEP 2: Create living documents (PDF generated only after all roles finish)
        const livingResult = await createLivingDocumentsForQuote(quoteToUse);

        if (livingResult.errors.length) {
          console.error('Living document errors:', livingResult.errors);
          toast.warning('Some proposal documents could not be prepared');
        }

        // 🎯 STEP 3: Auto-attach Document Bank documents (leaflets / product docs)
        const { error: attachError } = await supabase.rpc('attach_documents_to_quote', {
          p_quote_id: quoteToUse.id
        });

        if (attachError) {
          console.error('Error attaching Document Bank files:', attachError);
        } else {
          console.log('✅ Document Bank files attached');
        }

        setShowGeneratingModal(false);
        setShowShareModal(true);
        if (livingResult.created.length === 0) {
          toast.warning(
            livingResult.errors[0] ||
              'No proposal templates prepared. Check Admin → Templates for an active Proposal Pack.',
          );
        } else {
          toast.success(
            `Prepared ${livingResult.created.length} live proposal document(s). PDF is generated after Customer, Engineer and Compliance complete their parts.`,
          );
        }

      } catch (error) {
        console.error('Error preparing proposal pack:', error);
        toast.warning('Quote saved but some documents may be missing');
        setShowGeneratingModal(false);
        navigate(`/installer/quotes/${quoteToUse.id}`);
      }

    } catch (error) {
      console.error('Error creating/updating quote:', error);
      toast.error('Failed to save quote. Please try again.');
      setShowGeneratingModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors shrink-0">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div className="min-w-0">
          <h1 className="page-title text-lg sm:text-2xl">{isEditMode ? 'Edit Quote' : 'Create New Quote'}</h1>
          <p className="page-subtitle text-xs sm:text-sm">Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center justify-between min-w-max sm:min-w-0">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => index < currentStep && setCurrentStep(index)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all ${
                  index === currentStep
                    ? 'bg-primary-600 text-white'
                    : index < currentStep
                    ? 'bg-success-600/20 text-success-400 cursor-pointer hover:bg-success-600/30'
                    : 'bg-slate-800/50 text-slate-500'
                }`}
              >
                {index < currentStep ? <Check className="w-4 h-4" /> : <span className="[&>svg]:w-4 [&>svg]:h-4">{step.icon}</span>}
                <span className="hidden lg:inline text-sm font-medium">{step.title}</span>
              </button>
              {index < steps.length - 1 && (
                <div className={`w-4 sm:w-8 lg:w-16 h-0.5 mx-1 sm:mx-2 ${
                  index < currentStep ? 'bg-success-500' : 'bg-slate-700'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative z-10"
        >
          {/* Step 1: Customer Info */}
          {currentStep === 0 && (
            <Card padding="sm">
              <h2 className="section-title mb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-primary-400" />
                Customer Information
              </h2>
              <div className="form-grid gap-4">
                <Input
                  label="Full Name"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  placeholder="John Smith"
                  required
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={customer.email}
                  onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  placeholder="john@example.com"
                  required
                />
                <Input
                  label="Phone Number"
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  placeholder="07700 900123"
                  required
                />
                <Select
                  label="Property Type"
                  value={customer.propertyType}
                  onChange={(e) => setCustomer({ ...customer, propertyType: e.target.value as CustomerInfo['propertyType'] })}
                  options={[
                    { value: 'house', label: 'House' },
                    { value: 'flat', label: 'Flat' },
                    { value: 'bungalow', label: 'Bungalow' },
                    { value: 'commercial', label: 'Commercial' },
                  ]}
                />
                <UkAddressFields
                  address={customer.address}
                  postcode={customer.postcode}
                  onAddressChange={(address) => setCustomer((current) => ({ ...current, address }))}
                  onPostcodeChange={(postcode) => setCustomer((current) => ({ ...current, postcode }))}
                  addressClassName="md:col-span-2"
                  required
                />
              </div>

              <div className="mt-6 pt-5 border-t border-slate-700 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary-400" />
                    Document pack details
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Survey date is required for templates. Commissioning date is set automatically when the engineer completes the commissioning stage. Names and signature come from your account / company settings.
                  </p>
                </div>

                <div className="form-grid gap-4">
                  <Input
                    label="Survey date"
                    type="date"
                    value={documentDetails.surveyDate || ''}
                    onChange={(e) => updateDocumentDetails({ surveyDate: e.target.value })}
                    required
                  />
                </div>

                {templateCustomFields.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      Extra fields used by your proposal templates
                    </p>
                    <div className="form-grid gap-4">
                      {templateCustomFields.map((field) => (
                        <Input
                          key={field.key}
                          label={field.label}
                          value={(documentDetails.customFields || {})[field.key] || ''}
                          onChange={(e) =>
                            updateDocumentDetails({
                              customFields: {
                                ...(documentDetails.customFields || {}),
                                [field.key]: e.target.value,
                              },
                            })
                          }
                          placeholder={`Enter ${field.label}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {!companyInstallerSignature && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-slate-300">
                        <span className="inline-flex items-center gap-2">
                          <PenLine className="w-4 h-4 text-primary-400" />
                          Installer signature
                        </span>
                        <span className="text-red-400 ml-1">*</span>
                      </label>
                      <button
                        type="button"
                        className="text-xs text-slate-400 hover:text-white"
                        onClick={() => {
                          installerSigRef.current?.clear();
                          updateDocumentDetails({ installerSignature: '' });
                        }}
                      >
                        Clear
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">
                      No company signature found. Draw one here, or save it once in Settings → Company.
                    </p>
                    <div className="border-2 border-slate-700 rounded-lg bg-white overflow-hidden">
                      {documentDetails.installerSignature ? (
                        <div className="relative">
                          <img
                            src={documentDetails.installerSignature}
                            alt="Installer signature"
                            className="w-full h-40 object-contain bg-white"
                          />
                          <button
                            type="button"
                            className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-slate-900/80 text-white hover:bg-slate-900"
                            onClick={() => updateDocumentDetails({ installerSignature: '' })}
                          >
                            Redraw
                          </button>
                        </div>
                      ) : (
                        <SignatureCanvas
                          ref={installerSigRef}
                          onEnd={() => {
                            if (!installerSigRef.current || installerSigRef.current.isEmpty()) return;
                            updateDocumentDetails({
                              installerSignature: installerSigRef.current.toDataURL('image/png'),
                            });
                          }}
                          canvasProps={{
                            className: 'w-full h-40 rounded-lg',
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Step 2: Property & Energy */}
          {currentStep === 1 && (
            <Card>
              <h2 className="section-title flex items-center gap-2">
                <Home className="w-5 h-5 text-primary-400" />
                Property & Energy Details
              </h2>
              <div className="space-y-6">
                <div className="form-grid">
                  <Input
                    label="Annual Electricity Consumption (kWh)"
                    type="number"
                    value={customer.annualConsumptionKwh}
                    onChange={(e) => setCustomer({ ...customer, annualConsumptionKwh: Number(e.target.value) })}
                    hint="Average UK household uses 3,500-4,500 kWh"
                  />
                  <Input
                    label="Current Tariff Name"
                    value={customer.currentTariff}
                    onChange={(e) => setCustomer({ ...customer, currentTariff: e.target.value })}
                    placeholder="e.g., Octopus Go, British Gas Fixed"
                  />
                </div>

                {/* Solar Section */}
                <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customer.existingSolar}
                      onChange={(e) => setCustomer({ ...customer, existingSolar: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-primary-600 focus:ring-primary-500/50"
                    />
                    <div className="flex items-center gap-2">
                      <Sun className="w-5 h-5 text-warning-400" />
                      <span className="font-medium text-white">Customer has existing solar panels</span>
                    </div>
                  </label>
                  
                  {customer.existingSolar && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 space-y-4"
                    >
                      <Input
                        label="Solar System Size (kWp)"
                        type="number"
                        step="0.1"
                        value={customer.solarCapacityKwp || ''}
                        onChange={(e) => setCustomer({ ...customer, solarCapacityKwp: Number(e.target.value) })}
                        placeholder="e.g., 4.5"
                        required
                      />
                      <div className="form-grid gap-4">
                        <Input
                          label="PV panel count"
                          value={documentDetails.pvPanelCount || ''}
                          onChange={(e) => updateDocumentDetails({ pvPanelCount: e.target.value })}
                          placeholder="e.g. 12"
                        />
                        <Input
                          label="PV panel model"
                          value={documentDetails.pvPanelModel || ''}
                          onChange={(e) => updateDocumentDetails({ pvPanelModel: e.target.value })}
                          placeholder="e.g. JA Solar 430W"
                        />
                        <Input
                          label="Est. annual PV yield"
                          value={documentDetails.pvAnnualYield || ''}
                          onChange={(e) => updateDocumentDetails({ pvAnnualYield: e.target.value })}
                          placeholder="e.g. 3,800 kWh"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* EV Section */}
                <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customer.hasEv}
                      onChange={(e) => setCustomer({ ...customer, hasEv: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-primary-600 focus:ring-primary-500/50"
                    />
                    <div className="flex items-center gap-2">
                      <Car className="w-5 h-5 text-success-400" />
                      <span className="font-medium text-white">Customer has an electric vehicle</span>
                    </div>
                  </label>
                  
                  {customer.hasEv && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4"
                    >
                      <Input
                        label="Annual EV Mileage"
                        type="number"
                        value={customer.evMileagePerYear || ''}
                        onChange={(e) => setCustomer({ ...customer, evMileagePerYear: Number(e.target.value) })}
                        placeholder="e.g., 8000"
                        hint="Used to calculate fuel savings vs petrol"
                      />
                    </motion.div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Step 3: Tariff Details */}
          {currentStep === 2 && (
            <Card>
              <h2 className="section-title flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary-400" />
                Tariff Details
              </h2>
              <div className="space-y-6">
                <div className="form-grid">
                  <Input
                    label="Import Rate (£/kWh)"
                    type="number"
                    step="0.01"
                    value={tariff.importRate}
                    onChange={(e) => setTariff({ ...tariff, importRate: Number(e.target.value) })}
                    leftIcon={<PoundSterling className="w-4 h-4" />}
                  />
                  <Input
                    label="Export Rate (£/kWh)"
                    type="number"
                    step="0.01"
                    value={tariff.exportRate}
                    onChange={(e) => setTariff({ ...tariff, exportRate: Number(e.target.value) })}
                    leftIcon={<PoundSterling className="w-4 h-4" />}
                  />
                  <Input
                    label="Standing Charge (£/day)"
                    type="number"
                    step="0.01"
                    value={tariff.standingCharge}
                    onChange={(e) => setTariff({ ...tariff, standingCharge: Number(e.target.value) })}
                    leftIcon={<PoundSterling className="w-4 h-4" />}
                  />
                </div>

                {/* Time of Use */}
                <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tariff.hasTimeOfUse}
                      onChange={(e) => setTariff({ ...tariff, hasTimeOfUse: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-primary-600 focus:ring-primary-500/50"
                    />
                    <div>
                      <span className="font-medium text-white">Time-of-Use Tariff</span>
                      <p className="text-sm text-slate-500">e.g., Octopus Go, Intelligent Octopus</p>
                    </div>
                  </label>
                  
                  {tariff.hasTimeOfUse && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4"
                    >
                      <Input
                        label="Peak Rate (£/kWh)"
                        type="number"
                        step="0.01"
                        value={tariff.peakRate || ''}
                        onChange={(e) => setTariff({ ...tariff, peakRate: Number(e.target.value) })}
                      />
                      <Input
                        label="Off-Peak Rate (£/kWh)"
                        type="number"
                        step="0.01"
                        value={tariff.offPeakRate || ''}
                        onChange={(e) => setTariff({ ...tariff, offPeakRate: Number(e.target.value) })}
                      />
                      <Input
                        label="Peak Start"
                        type="time"
                        value={tariff.peakHoursStart || ''}
                        onChange={(e) => setTariff({ ...tariff, peakHoursStart: e.target.value })}
                      />
                      <Input
                        label="Peak End"
                        type="time"
                        value={tariff.peakHoursEnd || ''}
                        onChange={(e) => setTariff({ ...tariff, peakHoursEnd: e.target.value })}
                      />
                    </motion.div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Step 4: Products */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <Card>
                <h2 className="section-title flex items-center gap-2">
                  <Battery className="w-5 h-5 text-primary-400" />
                  Select Products
                </h2>
                
                {/* Battery Selection */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Batteries</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {batteries.filter(b => b.isActive).map((battery) => (
                      <button
                        key={battery.id}
                        onClick={() => addProduct('battery', battery.id)}
                        className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl hover:border-primary-500/50 hover:bg-slate-800/50 transition-all text-left group"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-white">{battery.model}</p>
                            <p className="text-sm text-slate-500">{battery.manufacturerName}</p>
                          </div>
                          <Plus className="w-5 h-5 text-slate-600 group-hover:text-primary-400 transition-colors" />
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                          <span>{battery.capacityKwh} kWh</span>
                          <span>{battery.powerKw} kW</span>
                          <span className="text-primary-400">£{battery.rrp.toLocaleString()}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inverter Selection */}
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Inverters</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {inverters.filter(i => i.isActive).map((inverter) => (
                      <button
                        key={inverter.id}
                        onClick={() => addProduct('inverter', inverter.id)}
                        className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl hover:border-primary-500/50 hover:bg-slate-800/50 transition-all text-left group"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-white">{inverter.model}</p>
                            <p className="text-sm text-slate-500">{inverter.manufacturerName}</p>
                          </div>
                          <Plus className="w-5 h-5 text-slate-600 group-hover:text-primary-400 transition-colors" />
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                          <span>{inverter.powerKw} kW</span>
                          <span>{inverter.phases}ph</span>
                          <span className="text-primary-400">£{inverter.rrp.toLocaleString()}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Selected Products */}
              {lineItems.length > 0 && (
                <Card>
                  <h3 className="section-title">Selected Products</h3>
                  <div className="space-y-3">
                    {lineItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-3 bg-slate-800/30 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-white">{item.description}</p>
                          <p className="text-sm text-slate-500 capitalize">{item.type}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, { quantity: Number(e.target.value) })}
                            className="w-20"
                          />
                          <Input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(item.id, { unitPrice: Number(e.target.value) })}
                            className="w-28"
                            leftIcon={<PoundSterling className="w-3 h-3" />}
                          />
                          <button
                            onClick={() => removeLineItem(item.id)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Step 5: Pricing & ROI */}
          {currentStep === 4 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h2 className="section-title flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-primary-400" />
                  Pricing
                </h2>
                <div className="space-y-4">
                  <Input
                    label="Installation Cost (£)"
                    type="number"
                    value={installationCost}
                    onChange={(e) => setInstallationCost(Number(e.target.value))}
                    leftIcon={<PoundSterling className="w-4 h-4" />}
                  />

                  <div className="pt-4 border-t border-slate-700 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Products</span>
                      <span className="text-white">£{calculations.productPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Installation</span>
                      <span className="text-white">£{installationCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Subtotal</span>
                      <span className="text-white">£{calculations.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">VAT (0%)</span>
                      <span className="text-white">£0</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-3 border-t border-slate-700">
                      <span className="text-white">Total</span>
                      <span className="text-primary-400">£{calculations.total.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-700">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Your Margin</span>
                      <span className="text-success-400">
                        £{calculations.profit.toLocaleString()} ({calculations.marginPercentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <h2 className="section-title flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-success-400" />
                  ROI Projection
                </h2>
                <div className="space-y-4">
                  <div className="p-4 bg-success-500/10 border border-success-500/30 rounded-xl">
                    <p className="text-sm text-success-400 mb-1">Estimated Annual Savings</p>
                    <p className="text-3xl font-bold text-white">£{calculations.annualSavings.toLocaleString()}</p>
                  </div>

                  <div className="p-4 bg-primary-500/10 border border-primary-500/30 rounded-xl">
                    <p className="text-sm text-primary-400 mb-1">Payback Period</p>
                    <p className="text-3xl font-bold text-white">{calculations.paybackYears} years</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Load Shift Savings</span>
                      <span className="text-white">£{calculations.loadShiftSavings}/year</span>
                    </div>
                    {customer.existingSolar && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Export Revenue</span>
                        <span className="text-white">£{calculations.exportRevenue}/year</span>
                      </div>
                    )}
                    {customer.hasEv && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">EV Fuel Savings</span>
                        <span className="text-white">£{calculations.evTaxSavings}/year</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-700">
                    <p className="text-xs text-slate-500">
                      * Projections based on current energy prices with 3% annual inflation. 
                      Actual savings may vary based on usage patterns.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Step 6: Review */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <Card>
                <h2 className="section-title">Quote Summary</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer Details */}
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-3">Customer</h3>
                    <div className="space-y-2">
                      <p className="text-white">{customer.name}</p>
                      <p className="text-slate-400 text-sm">{customer.email}</p>
                      <p className="text-slate-400 text-sm">{customer.phone}</p>
                      <p className="text-slate-400 text-sm">{customer.address}</p>
                      <p className="text-slate-400 text-sm">{customer.postcode}</p>
                      {(documentDetails.surveyDate || documentDetails.commissioningDate) && (
                        <p className="text-slate-400 text-sm mt-2">
                          Survey {documentDetails.surveyDate || '—'}
                          {documentDetails.commissioningDate
                            ? ` · Comm. ${documentDetails.commissioningDate} (from job stage)`
                            : ' · Comm. auto at commissioning'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* System Details */}
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-3">System</h3>
                    <div className="space-y-2">
                      <p className="text-white">{calculations.batteryCapacity} kWh Battery</p>
                      {customer.existingSolar && (
                        <p className="text-slate-400 text-sm">Existing Solar: {customer.solarCapacityKwp} kWp</p>
                      )}
                      {customer.hasEv && (
                        <p className="text-slate-400 text-sm">EV: {customer.evMileagePerYear?.toLocaleString()} miles/year</p>
                      )}
                      <p className="text-slate-400 text-sm">Consumption: {customer.annualConsumptionKwh.toLocaleString()} kWh/year</p>
                    </div>
                  </div>
                </div>

                {/* Line Items */}
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Products & Services</h3>
                  <div className="space-y-2">
                    {lineItems.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-slate-300">{item.quantity}x {item.description}</span>
                        <span className="text-white">£{(item.unitPrice * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Installation & Commissioning</span>
                      <span className="text-white">£{installationCost.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-2xl font-bold text-white">£{calculations.total.toLocaleString()}</p>
                      <p className="text-sm text-slate-500">Total (0% VAT on battery storage)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-medium text-success-400">£{calculations.annualSavings}/year savings</p>
                      <p className="text-sm text-slate-500">{calculations.paybackYears} year payback</p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-6">
                  <Input
                    label="Notes (visible to customer)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes or special conditions..."
                  />
                </div>
              </Card>

              {/* Actions */}
              <Card className="!p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">
                    Ready to proceed? Complete customer details, then save to prepare live proposal forms (PDF only at the end).
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleSubmit('draft')}
                      isLoading={isSubmitting}
                      className="min-w-[150px]"
                    >
                      Save Quote
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="relative z-0 flex justify-between mt-6">
        <Button
          variant="secondary"
          onClick={prevStep}
          disabled={currentStep === 0}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Previous
        </Button>
        {currentStep < steps.length - 1 && (
          <Button
            onClick={nextStep}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Next Step
          </Button>
        )}
      </div>

      {/* Payment Modal - Shown when trial credits are used */}
      {user?.companyId && (
        <ChoosePaymentModel
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          companyId={user.companyId}
          title="Trial Credits Used!"
          message="You've used your 5 free trial credits. Choose a payment model to continue creating quotes."
        />
      )}

      {/* Preparing living documents modal */}
      <Modal
        isOpen={showGeneratingModal}
        onClose={() => {}} // Prevent closing while preparing
        title="Preparing proposal pack"
        size="sm"
      >
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
          <p className="text-slate-300 font-medium">Setting up live documents…</p>
          <p className="text-sm text-slate-500 text-center">
            We’re attaching your proposal forms for the customer, engineer, and compliance to complete.
            PDFs are created only after every required role finishes.
          </p>
        </div>
      </Modal>

      {/* Share Link Modal */}
      <Modal
        isOpen={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          if (quoteForShare) {
            navigate(`/installer/quotes/${quoteForShare.id}`);
          }
        }}
        title="Share Quote with Customer"
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <p className="text-slate-300 mb-4">
              Share this link with your customer so they can view and accept the quote online.
            </p>
            
            {/* Quote Status Info */}
            {quoteForShare?.sentAt && (
              <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                  <Send className="w-4 h-4" />
                  <span>Sent on {format(new Date(quoteForShare.sentAt), 'dd MMMM yyyy \'at\' HH:mm')}</span>
                </div>
              </div>
            )}

            <label className="block text-sm font-medium text-slate-300 mb-2">
              Secure Shareable Link
            </label>
            {isGeneratingToken ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400 mb-3"></div>
                  <p className="text-slate-400 text-sm">Generating secure link...</p>
                </div>
              </div>
            ) : shareToken ? (
              <>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={getShareLink()}
                    readOnly
                    className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm"
                  />
                  <Button
                    variant="secondary"
                    leftIcon={<Copy className="w-4 h-4" />}
                    onClick={handleCopyLink}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  🔒 This link is secure and unique to this quote. Only users with this link can view the proposal.
                </p>
              </>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                Failed to generate secure link. Please try again.
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              leftIcon={<Mail className="w-4 h-4" />}
              onClick={handleSendEmail}
              isLoading={isSendingEmail}
              className="flex-1"
            >
              Share through Email
            </Button>
            <Button
              onClick={handleShareWhatsApp}
              leftIcon={<MessageCircle className="w-4 h-4" />}
              className="flex-1  !border-[#25D366]  text-white"
            >
              Share on WhatsApp
            </Button>
          </div>

          <div className="pt-4 border-t border-slate-700">
            <p className="text-xs text-slate-500">
              💡 Tip: You can copy this link and send it to your customer via email, WhatsApp, or SMS.
              They'll be able to view the quote and accept it online without creating an account.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

