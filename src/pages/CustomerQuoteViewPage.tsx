import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  CheckCircle2,
  Battery,
  Zap,
  Home,
  TrendingUp,
  Calendar,
  Mail,
  Phone,
  MapPin,
  FileText,
  Sun,
  Car,
  Download,
  Loader2,
  Check,
  X,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  Clock,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Logo } from '../components/ui/Logo';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { format } from 'date-fns';
import { listLivingDocumentsForShare } from '../lib/livingDocuments';
import { buildQuoteMergeData } from '../services/proposalPdfGenerator';
import { LivingDocumentPanel } from '../components/documents/LivingDocumentPanel';
import type { Quote, QuoteLivingDocument } from '../types';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

// Payment Form Component
interface PaymentFormProps {
  clientSecret: string;
  quote: Quote;
  token: string;
  customerName: string;
  customerSignature: string;
  onSuccess: () => void;
  onBack: () => void;
}

function PaymentForm({ clientSecret, quote, token, customerName, customerSignature, onSuccess, onBack }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const toast = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { error: submitError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (submitError) {
        setError(submitError.message || 'Payment failed');
        setIsProcessing(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment succeeded! Update quote immediately
        console.log('Payment succeeded, updating quote status...');
        const { error: updateError } = await supabase.functions.invoke('update-public-quote', {
          body: {
            quoteId: quote.id,
            token,
            action: 'mark_deposit_paid',
            payload: {
              customerName,
              customerSignature,
              stripePaymentIntentId: paymentIntent.id,
            },
          },
        });

        if (updateError) {
          console.error('Error updating quote:', updateError);
          console.error('Update error details:', JSON.stringify(updateError));
          // Payment succeeded but quote update failed
          // Webhook will update it as backup
          toast.success('Payment successful! Processing your quote...');
        } else {
          console.log('Quote updated successfully to deposit_paid status');
          toast.success('Payment successful! Deposit paid.');
        }
        
        // Always call onSuccess to refresh the page
        onSuccess();
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'An unexpected error occurred');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-slate-400">Deposit Amount</span>
          <span className="text-2xl font-bold text-primary-400">£{quote.deposit.toLocaleString()}</span>
        </div>
        <p className="text-xs text-slate-500">
          Balance of £{(quote.total - quote.deposit).toLocaleString()} due on completion
        </p>
      </div>

      <div className="min-h-[200px]">
        <PaymentElement 
          options={{
            layout: 'tabs'
          }}
        />
      </div>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          disabled={isProcessing}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          isLoading={isProcessing}
          leftIcon={<CreditCard className="w-4 h-4" />}
          className="flex-1"
        >
          Pay £{quote.deposit.toLocaleString()}
        </Button>
      </div>
    </form>
  );
}

export function CustomerQuoteViewPage() {
  const { quoteId, token } = useParams<{ quoteId: string; token: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [livingDocs, setLivingDocs] = useState<QuoteLivingDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [error, setError] = useState('');
  
  // Payment flow states
  const [acceptanceStep, setAcceptanceStep] = useState<'confirm' | 'payment' | 'availability'>('confirm');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string>('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<'morning' | 'afternoon' | 'fullday'>('fullday');
  const [additionalNotes, setAdditionalNotes] = useState('');
  // Fetch quote data
  useEffect(() => {
    if (quoteId && token) {
      fetchQuote();
    } else {
      setError('Invalid or missing quote link');
      setIsLoading(false);
    }
  }, [quoteId, token]);

  const fetchQuote = async () => {
    if (!quoteId || !token) return;

    try {
      setIsLoading(true);
      setError('');

      // Fetch quote with token validation via edge function
      const { data, error: quoteError } = await supabase.functions.invoke('get-public-quote', {
        body: { quoteId, token },
      });

      if (quoteError) {
        setError('Invalid or expired quote link. Please request a new link from your installer.');
        return;
      }

      if (!data?.quote) {
        setError('Quote not found or link has expired');
        return;
      }

      const quoteData = data.quote;

      // Map database format to Quote type
      const mappedQuote: Quote = {
        id: quoteData.id,
        companyId: quoteData.company_id,
        installerId: quoteData.installer_id,
        installerName: quoteData.installer_name,
        reference: quoteData.reference,
        status: quoteData.status,
        installationType: quoteData.installation_type,
        customer: quoteData.customer,
        tariff: quoteData.tariff,
        lineItems: quoteData.line_items,
        subtotal: quoteData.subtotal,
        vatRate: quoteData.vat_rate,
        vatAmount: quoteData.vat_amount,
        total: quoteData.total,
        deposit: quoteData.deposit,
        margin: quoteData.margin,
        marginPercentage: quoteData.margin_percentage,
        roiProjections: quoteData.roi_projections,
        paybackYears: quoteData.payback_years,
        annualSavings: quoteData.annual_savings,
        notes: quoteData.notes,
        validUntil: quoteData.valid_until,
        createdAt: quoteData.created_at,
        updatedAt: quoteData.updated_at,
        sentAt: quoteData.sent_at,
        viewedAt: quoteData.viewed_at,
        acceptedAt: quoteData.accepted_at,
        customerSignature: quoteData.customer_signature,
      };

      setQuote(mappedQuote);
      setCustomerName(mappedQuote.customer.name);

      setCompany(data.company || null);
      setDocuments(data.documents || []);

      const living = await listLivingDocumentsForShare(quoteId, token);
      setLivingDocs(living);
    } catch (err: any) {
      console.error('Error fetching quote:', err);
      setError(err.message || 'Failed to load quote');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      if (!doc || !doc.file_url) {
        toast.error('File URL not found');
        return;
      }

      toast.info('Preparing download...');
      
      // Extract the file path from the URL
      // URL format: https://{project}.supabase.co/storage/v1/object/public/documents/{path}
      const fileUrl = doc.file_url;
      const fileName = doc.file_name || doc.name || 'download';
      
      const urlParts = fileUrl.split('/storage/v1/object/public/documents/');
      if (urlParts.length < 2) {
        // Fallback: just open in new tab if parsing fails
        window.open(fileUrl, '_blank');
        toast.success('Opening file...');
        return;
      }
      
      const filePath = urlParts[1];
      
      // Download file from Supabase Storage
      const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath);
      
      if (error) throw error;
      
      // Create blob URL and trigger download
      const blob = new Blob([data], { type: data.type });
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      toast.success('Download started');
    } catch (error: any) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file: ' + error.message);
    }
  };

  const getSignatureFromProposalPack = (): string => {
    for (const doc of livingDocs) {
      const sig = doc.responses?.customer_signature;
      if (typeof sig === 'string' && sig.startsWith('data:image')) {
        return sig;
      }
    }
    return quote?.customerSignature || '';
  };

  const handleProceedToAvailability = () => {
    if (!quote) return;

    if (!customerName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    const awaitingCustomerForms = livingDocs.some(
      (doc) =>
        doc.requiredRoles.includes('customer') &&
        !doc.completedRoles.includes('customer') &&
        doc.status !== 'completed',
    );
    if (awaitingCustomerForms) {
      toast.error('Please complete and submit your sections on the proposal forms first');
      return;
    }

    // Reuse the signature from the living proposal form — do not ask again here.
    const signature = getSignatureFromProposalPack();
    setSignatureData(signature);
    setAcceptanceStep('availability');
  };

  const handleProceedToPayment = async () => {
    if (selectedDates.length === 0) {
      toast.error('Please select at least one available date');
      return;
    }

    setIsAccepting(true);

    try {
      // Store availability in the quote first
      const { error: availabilityError } = await supabase.functions.invoke('update-public-quote', {
        body: {
          quoteId: quote?.id,
          token,
          action: 'save_availability',
          payload: {
            dates: selectedDates,
            timeSlot: preferredTimeSlot,
            notes: additionalNotes,
          },
        },
      });

      if (availabilityError) throw availabilityError;

      // Create payment intent via edge function
      const { data, error } = await supabase.functions.invoke('create-quote-deposit-payment', {
        body: {
          quoteId: quote?.id,
          depositAmount: quote?.deposit,
          shareToken: token,
        },
      });

      if (error) throw error;

      setClientSecret(data.clientSecret);
      setAcceptanceStep('payment');
      toast.success('Availability saved! Proceed to payment.');
    } catch (err: any) {
      console.error('Error:', err);
      toast.error(err.message || 'Failed to proceed');
    } finally {
      setIsAccepting(false);
    }
  };

  const handlePaymentSuccess = async () => {
    // Refresh quote to show accepted status
    await fetchQuote();
    
    // Close modal and reset
    setShowAcceptModal(false);
    setAcceptanceStep('confirm');
    setClientSecret(null);
    setSignatureData('');
    setSelectedDates([]);
    setPreferredTimeSlot('fullday');
    setAdditionalNotes('');
    
    toast.success('Payment successful! Thank you. The installer will contact you shortly.');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading your quote...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <div className="text-center py-8">
            <X className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Quote Not Found</h2>
            <p className="text-slate-400 mb-6">
              {error || 'This quote may have been removed or the link is invalid.'}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const isExpired = new Date(quote.validUntil) < new Date();
  const canAccept = quote.status !== 'deposit_paid' && !isExpired;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {company?.logo ? (
              <img src={company.logo} alt={company.name} className="h-10" />
            ) : (
              <Logo variant="light" size="md" />
            )}
            <div>
              <h1 className="text-lg font-bold text-white">{company?.name || 'heliOS'}</h1>
              <p className="text-xs text-slate-500">Battery Storage Proposal</p>
            </div>
          </div>
          {quote.status === 'deposit_paid' ? (
            <Badge className="bg-success-500/20 text-success-400 border-success-500/30">
              <Check className="w-3 h-3 mr-1" />
              Deposit Paid
            </Badge>
          ) : isExpired ? (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Expired</Badge>
          ) : (
            <Badge className="bg-primary-500/20 text-primary-400 border-primary-500/30">
              Pending Response
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Quote Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-primary-500/10 to-primary-600/5 border-primary-500/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Hello {quote.customer.name}!</h2>
                <p className="text-slate-300 mb-4">
                  Thank you for your interest in battery storage. We've prepared a personalized proposal for you.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <FileText className="w-4 h-4" />
                    <span>Quote Ref: <span className="text-primary-400 font-mono">{quote.reference}</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span>Valid until: {format(new Date(quote.validUntil), 'dd MMMM yyyy')}</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-6">
                <p className="text-sm text-slate-400 mb-2">Total Investment</p>
                <p className="text-4xl font-bold text-white mb-1">£{quote.total.toLocaleString()}</p>
                <p className="text-sm text-slate-400 mb-4">Inc. VAT (0% on battery storage)</p>
                <div className="pt-4 border-t border-slate-700">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Deposit Required</span>
                    <span className="text-white font-medium">£{quote.deposit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Balance on Completion</span>
                    <span className="text-white font-medium">£{(quote.total - quote.deposit).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ROI Highlight */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-success-500/10 rounded-xl border border-success-500/20">
                <TrendingUp className="w-8 h-8 text-success-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">£{quote.annualSavings.toLocaleString()}</p>
                <p className="text-sm text-slate-400">Estimated Annual Savings</p>
              </div>
              <div className="text-center p-4 bg-primary-500/10 rounded-xl border border-primary-500/20">
                <Calendar className="w-8 h-8 text-primary-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{quote.paybackYears} Years</p>
                <p className="text-sm text-slate-400">Payback Period</p>
              </div>
              <div className="text-center p-4 bg-warning-500/10 rounded-xl border border-warning-500/20">
                <Battery className="w-8 h-8 text-warning-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">
                  {quote.lineItems
                    .filter(item => item.type === 'battery')
                    .reduce((sum, item) => sum + item.quantity, 0)}
                  x Battery
                </p>
                <p className="text-sm text-slate-400">System Components</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* System Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card>
            <h3 className="text-xl font-bold text-white mb-4">Your Proposed System</h3>
            <div className="space-y-3">
              {quote.lineItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    {item.type === 'battery' ? (
                      <Battery className="w-5 h-5 text-primary-400" />
                    ) : item.type === 'inverter' ? (
                      <Zap className="w-5 h-5 text-warning-400" />
                    ) : (
                      <FileText className="w-5 h-5 text-slate-400" />
                    )}
                    <div>
                      <p className="font-medium text-white">{item.description}</p>
                      <p className="text-sm text-slate-500 capitalize">{item.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-white">£{(item.unitPrice * item.quantity).toLocaleString()}</p>
                    <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Subtotal</span>
                  <span className="text-white">£{quote.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">VAT (0%)</span>
                  <span className="text-white">£0</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-700">
                  <span className="text-white">Total</span>
                  <span className="text-primary-400">£{quote.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Property & Energy Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card>
            <h3 className="text-xl font-bold text-white mb-4">Your Property Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm font-medium">Address</span>
                  </div>
                  <p className="text-white">{quote.customer.address}</p>
                  <p className="text-white">{quote.customer.postcode}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Home className="w-4 h-4" />
                    <span className="text-sm font-medium">Property Type</span>
                  </div>
                  <p className="text-white capitalize">{quote.customer.propertyType}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Zap className="w-4 h-4" />
                    <span className="text-sm font-medium">Annual Consumption</span>
                  </div>
                  <p className="text-white">{quote.customer.annualConsumptionKwh.toLocaleString()} kWh/year</p>
                </div>
                {quote.customer.existingSolar && (
                  <div>
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                      <Sun className="w-4 h-4" />
                      <span className="text-sm font-medium">Existing Solar</span>
                    </div>
                    <p className="text-white">{quote.customer.solarCapacityKwp} kWp</p>
                  </div>
                )}
                {quote.customer.hasEv && (
                  <div>
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                      <Car className="w-4 h-4" />
                      <span className="text-sm font-medium">Electric Vehicle</span>
                    </div>
                    <p className="text-white">{quote.customer.evMileagePerYear?.toLocaleString()} miles/year</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ROI Projections */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <Card>
            <h3 className="text-xl font-bold text-white mb-4">10-Year Savings Projection</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Year</th>
                    <th className="text-right py-3 px-2 text-slate-400 font-medium">Annual Savings</th>
                    <th className="text-right py-3 px-2 text-slate-400 font-medium">Cumulative</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.roiProjections.map((projection) => (
                    <tr key={projection.year} className="border-b border-slate-800">
                      <td className="py-3 px-2 text-white">Year {projection.year}</td>
                      <td className="text-right py-3 px-2 text-success-400">
                        £{projection.savings.toLocaleString()}
                      </td>
                      <td className="text-right py-3 px-2 text-white font-medium">
                        £{projection.cumulativeSavings.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              * Projections based on current energy prices with 3% annual inflation. Actual savings may vary based on usage patterns.
            </p>
          </Card>
        </motion.div>

        {/* Notes */}
        {quote.notes && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <Card>
              <h3 className="text-xl font-bold text-white mb-4">Additional Information</h3>
              <p className="text-slate-300 whitespace-pre-wrap">{quote.notes}</p>
            </Card>
          </motion.div>
        )}

        {/* Accept Quote CTA */}
        {canAccept && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.6 }}
          >
            <Card className="bg-gradient-to-br from-primary-500/20 to-success-500/10 border-primary-500/30">
              <div className="text-center py-6">
                <CheckCircle2 className="w-16 h-16 text-success-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">Ready to Proceed?</h3>
                <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
                  Accept this quote to begin your journey to energy independence. We'll contact you shortly to arrange your installation.
                </p>
                <Button
                  size="lg"
                  onClick={() => setShowAcceptModal(true)}
                  leftIcon={<CheckCircle2 className="w-5 h-5" />}
                  className="bg-gradient-to-r from-primary-500 to-success-500 hover:from-primary-600 hover:to-success-600"
                >
                  Accept Quote & Continue
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Deposit Paid */}
        {quote.status === 'deposit_paid' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.6 }}
          >
            <Card className="bg-gradient-to-br from-success-500/20 to-success-600/10 border-success-500/30">
              <div className="text-center py-6">
                <Check className="w-16 h-16 text-success-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">Deposit Paid!</h3>
                <p className="text-slate-300 mb-4">
                  Thank you for your payment. The installer will contact you shortly to schedule the installation.
                </p>
                {quote.depositPaidAt && (
                  <p className="text-sm text-slate-500">
                    Deposit paid on {format(new Date(quote.depositPaidAt), 'dd MMMM yyyy \'at\' HH:mm')}
                  </p>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Proposal Pack Documents — fillable templates + static bank files */}
        {(livingDocs.length > 0 || documents.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card>
              <div className="flex items-center gap-3 mb-6">
                <FileText className="w-6 h-6 text-primary-400" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Proposal Pack Documents</h2>
                  <p className="text-slate-400">
                    Complete your sections on the forms below, then download product leaflets included with your proposal.
                  </p>
                </div>
              </div>

              {livingDocs.length > 0 && quoteId && token && (
                <div className="space-y-4 mb-6">
                  <p className="text-sm font-medium text-slate-300">Forms to complete</p>
                  {livingDocs.map((doc) => (
                    <LivingDocumentPanel
                      key={doc.id}
                      document={doc}
                      mergeData={
                        company
                          ? buildQuoteMergeData(quote!, company)
                          : {}
                      }
                      role="customer"
                      share={{ quoteId, token }}
                      onUpdated={(updated) =>
                        setLivingDocs((prev) =>
                          prev.map((d) => (d.id === updated.id ? updated : d)),
                        )
                      }
                    />
                  ))}
                </div>
              )}

              {documents.length > 0 && (
                <div className="grid gap-3">
                  {livingDocs.length > 0 && (
                    <p className="text-sm font-medium text-slate-300">Product leaflets &amp; extras</p>
                  )}
                  {documents.map((doc: any, index: number) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-500/10 rounded-lg">
                          <FileText className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{doc.name}</p>
                          {doc.description && (
                            <p className="text-sm text-slate-400">{doc.description}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-1">
                            {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''} • {doc.file_name}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Download className="w-4 h-4" />}
                        onClick={() => handleDownload(doc)}
                      >
                        Download
                      </Button>
                    </motion.div>
                  ))}
                </div>
              )}

              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-400">
                  <strong>Note:</strong> These documents are part of your complete proposal pack.
                  Fill only the customer sections on the forms; product datasheets and manuals are for download.
                </p>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Footer */}
        <div className="text-center py-8 border-t border-slate-800">
          <p className="text-sm text-slate-500 mb-2">
            Have questions? Contact {company?.name || 'us'}
          </p>
          <div className="flex items-center justify-center gap-6 text-sm">
            {company?.email && (
              <a href={`mailto:${company.email}`} className="flex items-center gap-2 text-primary-400 hover:text-primary-300">
                <Mail className="w-4 h-4" />
                {company.email}
              </a>
            )}
            {company?.phone && (
              <a href={`tel:${company.phone}`} className="flex items-center gap-2 text-primary-400 hover:text-primary-300">
                <Phone className="w-4 h-4" />
                {company.phone}
              </a>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-6">Powered by heliOS</p>
        </div>
      </div>

      {/* Accept Quote Modal */}
      <Modal
        isOpen={showAcceptModal}
        onClose={() => {
          setShowAcceptModal(false);
          setAcceptanceStep('confirm');
          setClientSecret(null);
          setSignatureData('');
        }}
        title={
          acceptanceStep === 'confirm' ? 'Accept Quote' : 
          acceptanceStep === 'availability' ? 'Select Availability' : 
          'Pay Deposit'
        }
        size="lg"
      >
        <div className="space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`flex items-center gap-2 ${acceptanceStep === 'confirm' ? 'text-primary-400' : 'text-success-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                acceptanceStep === 'confirm' ? 'bg-primary-500/20 border-2 border-primary-500' : 'bg-success-500'
              }`}>
                {acceptanceStep !== 'confirm' ? <Check className="w-5 h-5 text-white" /> : '1'}
              </div>
              <span className="text-sm font-medium">Confirm</span>
            </div>
            <div className="w-12 h-0.5 bg-slate-700"></div>
            <div className={`flex items-center gap-2 ${
              acceptanceStep === 'availability' ? 'text-primary-400' : 
              acceptanceStep === 'payment' ? 'text-success-400' : 
              'text-slate-500'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                acceptanceStep === 'availability' ? 'bg-primary-500/20 border-2 border-primary-500' : 
                acceptanceStep === 'payment' ? 'bg-success-500' :
                'bg-slate-700'
              }`}>
                {acceptanceStep === 'payment' ? <Check className="w-5 h-5 text-white" /> : '2'}
              </div>
              <span className="text-sm font-medium">Availability</span>
            </div>
            <div className="w-12 h-0.5 bg-slate-700"></div>
            <div className={`flex items-center gap-2 ${acceptanceStep === 'payment' ? 'text-primary-400' : 'text-slate-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                acceptanceStep === 'payment' ? 'bg-primary-500/20 border-2 border-primary-500' : 'bg-slate-700'
              }`}>
                3
              </div>
              <span className="text-sm font-medium">Payment</span>
            </div>
          </div>

          {acceptanceStep === 'confirm' ? (
            <>
              <p className="text-slate-300">
                By accepting this quote, you agree to proceed with the installation at the quoted price of{' '}
                <span className="font-bold text-primary-400">£{quote.total.toLocaleString()}</span>.
              </p>

              <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-primary-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-primary-300 mb-1">Deposit Required</p>
                    <p className="text-xs text-slate-400">
                      You'll need to pay a <span className="font-semibold text-white">£{quote.deposit.toLocaleString()}</span> deposit 
                      to confirm this quote. Balance of <span className="font-semibold text-white">£{(quote.total - quote.deposit).toLocaleString()}</span> due on completion.
                    </p>
                  </div>
                </div>
              </div>

              {livingDocs.some((d) => d.requiredRoles.includes('customer')) && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 text-sm text-slate-400">
                  Your signature on the proposal forms above is used for acceptance — you do not need to sign again here.
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm Your Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 outline-none"
                  placeholder="Enter your full name"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setShowAcceptModal(false)}
                  disabled={isAccepting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleProceedToAvailability}
                  isLoading={isAccepting}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="flex-1"
                >
                  Continue
                </Button>
              </div>
            </>
          ) : acceptanceStep === 'availability' ? (
            // Step 2: Availability Selection
            <>
              <p className="text-slate-300">
                Please select the dates when you're available for the installation. This helps us schedule at a time convenient for you.
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Select Available Dates (Select multiple dates)
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    const date = e.target.value;
                    if (date && !selectedDates.includes(date)) {
                      setSelectedDates([...selectedDates, date]);
                    }
                  }}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 outline-none"
                />
                
                {/* Display selected dates */}
                {selectedDates.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-slate-400 mb-2">Selected Dates:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedDates.map((date, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 bg-primary-500/20 border border-primary-500/30 rounded-lg px-3 py-2"
                        >
                          <Calendar className="w-4 h-4 text-primary-400" />
                          <span className="text-sm text-white">
                            {format(new Date(date), 'dd MMM yyyy')}
                          </span>
                          <button
                            onClick={() => setSelectedDates(selectedDates.filter((_, i) => i !== index))}
                            className="ml-2 text-slate-400 hover:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Preferred Time Slot
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setPreferredTimeSlot('morning')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      preferredTimeSlot === 'morning'
                        ? 'border-primary-500 bg-primary-500/20'
                        : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <Sun className={`w-6 h-6 mx-auto mb-2 ${
                      preferredTimeSlot === 'morning' ? 'text-primary-400' : 'text-slate-400'
                    }`} />
                    <p className={`text-sm font-medium ${
                      preferredTimeSlot === 'morning' ? 'text-white' : 'text-slate-400'
                    }`}>
                      Morning
                    </p>
                    <p className="text-xs text-slate-500">8AM - 12PM</p>
                  </button>

                  <button
                    onClick={() => setPreferredTimeSlot('afternoon')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      preferredTimeSlot === 'afternoon'
                        ? 'border-primary-500 bg-primary-500/20'
                        : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <Sun className={`w-6 h-6 mx-auto mb-2 ${
                      preferredTimeSlot === 'afternoon' ? 'text-primary-400' : 'text-slate-400'
                    }`} />
                    <p className={`text-sm font-medium ${
                      preferredTimeSlot === 'afternoon' ? 'text-white' : 'text-slate-400'
                    }`}>
                      Afternoon
                    </p>
                    <p className="text-xs text-slate-500">12PM - 5PM</p>
                  </button>

                  <button
                    onClick={() => setPreferredTimeSlot('fullday')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      preferredTimeSlot === 'fullday'
                        ? 'border-primary-500 bg-primary-500/20'
                        : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <Clock className={`w-6 h-6 mx-auto mb-2 ${
                      preferredTimeSlot === 'fullday' ? 'text-primary-400' : 'text-slate-400'
                    }`} />
                    <p className={`text-sm font-medium ${
                      preferredTimeSlot === 'fullday' ? 'text-white' : 'text-slate-400'
                    }`}>
                      Full Day
                    </p>
                    <p className="text-xs text-slate-500">Flexible</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 outline-none resize-none"
                  placeholder="Any specific requirements or preferences for the installation day?"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setAcceptanceStep('confirm')}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleProceedToPayment}
                  isLoading={isAccepting}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="flex-1"
                >
                  Proceed to Payment
                </Button>
              </div>
            </>
          ) : (
            // Step 3: Payment
            <>
              {clientSecret && quote ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <PaymentForm
                    clientSecret={clientSecret}
                    quote={quote}
                    token={token || ''}
                    customerName={customerName}
                    customerSignature={signatureData}
                    onSuccess={handlePaymentSuccess}
                    onBack={() => setAcceptanceStep('availability')}
                  />
                </Elements>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p>Preparing payment...</p>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
