import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  Download,
  Edit,
  Trash2,
  User,
  Home,
  Zap,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Battery,
  Share2,
  Copy,
  ExternalLink,
  Eye,
  CreditCard,
  Loader2,
  MessageCircle,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { QuoteStatusBadge } from '../../components/ui/Badge';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { JobStatusPipeline } from '../../components/ui/JobStatusPipeline';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { generateQuotePDF } from '../../services/pdfGenerator';
import { generateAllProposalPdfs } from '../../services/proposalPdfGenerator';
import { sendQuoteToCustomer } from '../../services/emailNotifications';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import type { Quote } from '../../types';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { getQuote, updateQuote, deleteQuote, canCreateQuote, deductQuoteCredit, refreshData } = useData();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showGeneratingModal, setShowGeneratingModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [resolvedCompanyName, setResolvedCompanyName] = useState('');

  // Fetch fresh quote data on mount and when id changes
  useEffect(() => {
    if (id) {
      fetchFreshQuote();
    }
  }, [id]);

  useEffect(() => {
    const fetchCompanyName = async () => {
      if (user?.companyName) {
        setResolvedCompanyName(user.companyName);
      } else if (user?.companyId) {
        const { data } = await supabase
          .from('companies')
          .select('name')
          .eq('id', user.companyId)
          .single();
        if (data?.name) setResolvedCompanyName(data.name);
      }
    };
    fetchCompanyName();
  }, [user?.companyId, user?.companyName]);

  const fetchFreshQuote = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      if (data) {
        // Map database format to Quote type
        const mappedQuote: Quote = {
          id: data.id,
          companyId: data.company_id,
          installerId: data.installer_id,
          installerName: data.installer_name,
          reference: data.reference,
          status: data.status,
          installationType: data.installation_type,
          customer: data.customer,
          tariff: data.tariff,
          lineItems: data.line_items,
          subtotal: data.subtotal,
          vatRate: data.vat_rate,
          vatAmount: data.vat_amount,
          total: data.total,
          deposit: data.deposit,
          margin: data.margin,
          marginPercentage: data.margin_percentage,
          roiProjections: data.roi_projections,
          paybackYears: data.payback_years,
          annualSavings: data.annual_savings,
          notes: data.notes,
          validUntil: data.valid_until,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          sentAt: data.sent_at,
          viewedAt: data.viewed_at,
          acceptedAt: data.accepted_at,
          customerSignature: data.customer_signature,
          depositPaidAt: data.deposit_paid_at,
          scheduledAt: data.scheduled_at,
          installationDate: data.installation_date,
          installationStartedAt: data.installation_started_at,
          installationCompletedAt: data.installation_completed_at,
          commissioningUploadedAt: data.commissioning_uploaded_at,
          complianceReviewedAt: data.compliance_reviewed_at,
          mcsCertifiedAt: data.mcs_certified_at,
          finalInvoiceSentAt: data.final_invoice_sent_at,
          closedAt: data.closed_at,
          customerAvailability: data.customer_availability,
        };
        
        // Debug log
        console.log('📊 Quote Timeline Debug:', {
          status: mappedQuote.status,
          sentAt: mappedQuote.sentAt,
          viewedAt: mappedQuote.viewedAt,
          'sentAt is truthy': !!mappedQuote.sentAt,
          'viewedAt is truthy': !!mappedQuote.viewedAt,
        });
        
        setQuote(mappedQuote);
      }
    } catch (error) {
      console.error('Error fetching quote:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchFreshQuote();
    await refreshData();
    setIsRefreshing(false);
    toast.success('Quote refreshed!');
  };

  const handleExportPDF = async () => {
    if (!quote || !user) return;
    setIsExporting(true);
    try {
      await generateQuotePDF(quote, resolvedCompanyName || 'Your Company');
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (!quote) {
    return (
      <div className="text-center py-20">
        <FileText className="w-12 h-12 mx-auto mb-4 text-slate-700" />
        <p className="text-slate-400 mb-4">Quote not found</p>
        <Link to="/installer/quotes">
          <Button variant="secondary">Back to Quotes</Button>
        </Link>
      </div>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteQuote(quote.id);
      navigate('/installer/quotes');
    } catch (error) {
      console.error('Error deleting quote:', error);
    }
  };

  const generateOrFetchShareToken = async () => {
    if (!quote) return null;

    setIsGeneratingToken(true);
    try {
      // First, check if quote already has a token
      const { data: existingQuote, error: fetchError } = await supabase
        .from('quotes')
        .select('share_token')
        .eq('id', quote.id)
        .single();

      if (fetchError) throw fetchError;

      if (existingQuote.share_token) {
        setShareToken(existingQuote.share_token);
        return existingQuote.share_token;
      }

      // Generate new token using the database function
      const { data: tokenData, error: tokenError } = await supabase
        .rpc('generate_quote_share_token');

      if (tokenError) throw tokenError;

      const newToken = tokenData as string;

      // Update quote with new token
      const { error: updateError } = await supabase
        .from('quotes')
        .update({ share_token: newToken })
        .eq('id', quote.id);

      if (updateError) throw updateError;

      setShareToken(newToken);
      return newToken;
    } catch (error: any) {
      console.error('Error generating share token:', error);
      toast.error('Failed to generate secure link');
      return null;
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const getShareLink = () => {
    if (!shareToken) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/quote/${quote.id}/${shareToken}`;
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

  const handleShareWhatsApp = async () => {
    if (!quote || !shareToken) return;
    
    // Update quote status to 'sent' if it's still a draft
    if (quote.status === 'draft') {
      try {
        await supabase
          .from('quotes')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', quote.id);
        
        // Refresh quote data
        await fetchFreshQuote();
      } catch (error) {
        console.error('Error updating quote status:', error);
      }
    }
    
    const link = getShareLink();
    const customerPhone = quote.customer.phone.replace(/\s+/g, '');
    const message = `Hi ${quote.customer.name}, here is your solar quote from ${resolvedCompanyName || 'our team'}: ${link}`;
    const whatsappUrl = `https://wa.me/${customerPhone}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
    toast.success('Quote marked as sent!');
  };

  const handleSendEmail = async () => {
    if (!quote || !shareToken || !user) return;
    
    setIsSendingEmail(true);
    try {
      // Update quote status to 'sent' if it's still a draft
      if (quote.status === 'draft') {
        await supabase
          .from('quotes')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', quote.id);
        
        // Refresh quote data
        await fetchFreshQuote();
        toast.success('Quote marked as sent!');
      }
      
      const result = await sendQuoteToCustomer({
        quote: quote,
        recipient: {
          email: quote.customer.email,
          name: quote.customer.name,
        },
        shareLink: getShareLink(),
        companyName: resolvedCompanyName || 'Your Company',
        companyEmail: user.email || '',
        companyPhone: '+44 782346382',
      });

      if (result.success) {
        toast.success('Email sent successfully to customer!');
      } else {
        // If email service fails, open default email client as fallback
        const subject = encodeURIComponent(`Your Quote from ${resolvedCompanyName || 'us'} - ${quote.reference}`);
        const body = encodeURIComponent(
          `Hi ${quote.customer.name},\n\n` +
          `Thank you for your interest in battery storage. We've prepared a personalized proposal for you.\n\n` +
          `Quote Reference: ${quote.reference}\n` +
          `Total Investment: £${quote.total.toLocaleString()}\n` +
          `Estimated Annual Savings: £${quote.annualSavings.toLocaleString()}\n\n` +
          `View your quote here:\n${getShareLink()}\n\n` +
          `Best regards,\n${resolvedCompanyName || 'Your Company'}`
        );
        const mailtoLink = `mailto:${quote.customer.email}?subject=${subject}&body=${body}`;
        window.location.href = mailtoLink;
        
        toast.info('Opening your email client...');
      }
    } catch (error) {
      console.error('Error in handleSendEmail:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleOpenShareModal = async () => {
    setShowShareModal(true);
    const token = await generateOrFetchShareToken();
    
    // Auto-attach documents when generating share link
    if (token && user?.companyId) {
      try {
        const { error: attachError } = await supabase.rpc('attach_documents_to_quote', {
          p_quote_id: quote.id
        });

        if (attachError) {
          console.error('Error attaching documents:', attachError);
          toast.error('Documents attached with warnings.');
        } else {
          console.log('Documents automatically attached to quote');
        }
      } catch (error) {
        console.error('Failed to attach documents:', error);
      }
    }
  };

  const battery = quote.lineItems.find(li => li.type === 'battery');
  const batteryCapacity = battery ? 
    parseFloat(battery.description.match(/(\d+\.?\d*)\s*kWh/i)?.[1] || '0') : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/installer/quotes')}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="page-title">{quote.reference}</h1>
              <QuoteStatusBadge status={quote.status} />
            </div>
            <p className="page-subtitle">
              Created {format(new Date(quote.createdAt), 'dd MMMM yyyy')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {quote.status === 'draft' && (
            <>
              <Button 
                variant="secondary" 
                leftIcon={<Edit className="w-4 h-4" />}
                onClick={() => navigate(`/installer/quotes/${quote.id}/edit`)}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={() => setShowDeleteModal(true)}
              >
                Delete
              </Button>
            </>
          )}
          {(quote.status === 'sent' || quote.status === 'viewed' || quote.status === 'draft') && (
            <Button 
              variant="primary" 
              leftIcon={<Share2 className="w-4 h-4" />}
              onClick={handleOpenShareModal}
            >
              Share Link
            </Button>
          )}
          {quote.status === 'deposit_paid' && (
            <Button 
              variant="primary" 
              leftIcon={<Calendar className="w-4 h-4" />}
              onClick={() => navigate(`/installer/scheduler?quoteId=${quote.id}`)}
            >
              Schedule Installation
            </Button>
          )}
          <Button 
            variant="secondary" 
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportPDF}
            isLoading={isExporting}
          >
            Export PDF
          </Button>
          <Button 
            variant="secondary" 
            leftIcon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
            onClick={handleRefresh}
            isLoading={isRefreshing}
            title="Refresh quote data"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Quote Total"
          value={`£${quote.total.toLocaleString()}`}
          icon={<FileText className="w-6 h-6" />}
        />
        <StatCard
          title="Annual Savings"
          value={`£${quote.annualSavings.toLocaleString()}`}
          change="Estimated"
          changeType="positive"
          icon={<TrendingUp className="w-6 h-6" />}
        />
        <StatCard
          title="Payback Period"
          value={`${quote.paybackYears} years`}
          icon={<Clock className="w-6 h-6" />}
        />
        <StatCard
          title="Your Margin"
          value={`£${quote.margin.toLocaleString()}`}
          change={`${quote.marginPercentage.toFixed(1)}%`}
          changeType="positive"
          icon={<CheckCircle2 className="w-6 h-6" />}
        />
      </div>

      {/* Job Status Pipeline - Phase 5A */}
      {quote.status !== 'draft' && quote.status !== 'rejected' && quote.status !== 'expired' && (
        <Card>
          <h3 className="section-title mb-6">Job Progress</h3>
          <JobStatusPipeline
            currentStatus={quote.status}
            timestamps={{
              createdAt: quote.createdAt,
              sentAt: quote.sentAt,
              viewedAt: quote.viewedAt,
              acceptedAt: quote.acceptedAt,
              depositPaidAt: quote.depositPaidAt,
              scheduledAt: quote.scheduledAt,
              installationStartedAt: quote.installationStartedAt,
              installationCompletedAt: quote.installationCompletedAt,
              commissioningUploadedAt: quote.commissioningUploadedAt,
              complianceReviewedAt: quote.complianceReviewedAt,
              mcsCertifiedAt: quote.mcsCertifiedAt,
              finalInvoiceSentAt: quote.finalInvoiceSentAt,
              closedAt: quote.closedAt,
            }}
          />
        </Card>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <Card>
            <h3 className="section-title flex items-center gap-2">
              <User className="w-5 h-5 text-primary-400" />
              Customer Information
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-slate-500 mb-1">Name</p>
                <p className="text-white font-medium">{quote.customer.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Email</p>
                <p className="text-white">{quote.customer.email}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Phone</p>
                <p className="text-white">{quote.customer.phone}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Property Type</p>
                <p className="text-white capitalize">{quote.customer.propertyType}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-slate-500 mb-1">Address</p>
                <p className="text-white">{quote.customer.address}, {quote.customer.postcode}</p>
              </div>
            </div>
          </Card>

          {/* Line Items */}
          <Card>
            <h3 className="section-title flex items-center gap-2">
              <Battery className="w-5 h-5 text-primary-400" />
              Products & Services
            </h3>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Type</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lineItems.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium text-white">{item.description}</td>
                      <td className="capitalize text-slate-400">{item.type}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">£{item.unitPrice.toLocaleString()}</td>
                      <td className="text-right font-medium">
                        £{(item.unitPrice * item.quantity).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-700">
                    <td colSpan={4} className="text-right font-medium text-slate-400">Subtotal</td>
                    <td className="text-right font-medium">£{quote.subtotal.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="text-right font-medium text-slate-400">VAT (0%)</td>
                    <td className="text-right font-medium">£0</td>
                  </tr>
                  <tr className="text-lg">
                    <td colSpan={4} className="text-right font-bold text-white">Total</td>
                    <td className="text-right font-bold text-primary-400">
                      £{quote.total.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* ROI Chart */}
          <Card>
            <h3 className="section-title flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-success-400" />
              10-Year Savings Projection
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={quote.roiProjections}>
                  <defs>
                    <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="year"
                    stroke="#64748b"
                    fontSize={12}
                    tickFormatter={(value) => `Y${value}`}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`£${value.toLocaleString()}`, 'Cumulative Savings']}
                    labelFormatter={(label) => `Year ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulativeSavings"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#colorSavings)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          {/* Status Timeline */}
          <Card>
            <h3 className="section-title">Quote Timeline</h3>
            <div className="space-y-0">
              <TimelineItem
                title="Created"
                date={quote.createdAt}
                isComplete
                isLast={quote.status === 'draft'}
                isNextComplete={!!quote.sentAt}
              />
              {quote.status !== 'draft' && (
                <>
                  <TimelineItem
                    title="Sent to Customer"
                    date={quote.sentAt}
                    isComplete={!!quote.sentAt}
                    isLast={false}
                    isNextComplete={!!quote.viewedAt}
                  />
                  <TimelineItem
                    title="Viewed by Customer"
                    date={quote.viewedAt}
                    isComplete={!!quote.viewedAt}
                    isLast={false}
                    isNextComplete={!!quote.depositPaidAt}
                  />
                  <TimelineItem
                    title="Deposit Paid"
                    date={quote.depositPaidAt}
                    isComplete={!!quote.depositPaidAt}
                    status={quote.depositPaidAt ? 'success' : undefined}
                    isLast={false}
                    isNextComplete={!!quote.scheduledAt}
                  />
                  <TimelineItem
                    title="Installation Scheduled"
                    date={quote.scheduledAt}
                    isComplete={!!quote.scheduledAt}
                    isLast={false}
                    isNextComplete={!!quote.installationStartedAt}
                  />
                  <TimelineItem
                    title="Installation Started"
                    date={quote.installationStartedAt}
                    isComplete={!!quote.installationStartedAt}
                    isLast={false}
                    isNextComplete={!!quote.installationCompletedAt}
                  />
                  <TimelineItem
                    title="Installation Completed"
                    date={quote.installationCompletedAt}
                    isComplete={!!quote.installationCompletedAt}
                    isLast={false}
                    isNextComplete={!!quote.commissioningUploadedAt}
                  />
                  <TimelineItem
                    title="Commissioning"
                    date={quote.commissioningUploadedAt}
                    isComplete={!!quote.commissioningUploadedAt}
                    isLast={false}
                    isNextComplete={!!quote.complianceReviewedAt}
                  />
                  <TimelineItem
                    title="Compliance Review"
                    date={quote.complianceReviewedAt}
                    isComplete={!!quote.complianceReviewedAt}
                    isLast={false}
                    isNextComplete={!!quote.mcsCertifiedAt}
                  />
                  <TimelineItem
                    title="MCS Certified"
                    date={quote.mcsCertifiedAt}
                    isComplete={!!quote.mcsCertifiedAt}
                    status={quote.mcsCertifiedAt ? 'success' : undefined}
                    isLast={false}
                    isNextComplete={!!quote.finalInvoiceSentAt}
                  />
                  <TimelineItem
                    title="Final Invoice Sent"
                    date={quote.finalInvoiceSentAt}
                    isComplete={!!quote.finalInvoiceSentAt}
                    isLast={false}
                    isNextComplete={!!quote.closedAt}
                  />
                  <TimelineItem
                    title="Job Closed"
                    date={quote.closedAt}
                    isComplete={!!quote.closedAt}
                    status={quote.closedAt ? 'success' : undefined}
                    isLast={true}
                    isNextComplete={false}
                  />
                </>
              )}
            </div>
          </Card>

          {/* Payment Summary */}
          {quote.status === 'deposit_paid' || quote.depositPaidAt ? (
            <Card className="bg-gradient-to-br from-success-500/10 to-success-600/5 border-success-500/20">
              <h3 className="section-title flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-success-400" />
                Payment Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                  <span className="text-sm text-slate-400">Total Quote Value</span>
                  <span className="text-lg font-bold text-white">£{quote.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-success-500/10 rounded-lg border border-success-500/20">
                  <div>
                    <span className="text-sm text-success-400 font-medium">Deposit Paid</span>
                    {quote.depositPaidAt && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {format(new Date(quote.depositPaidAt), 'dd MMM yyyy, HH:mm')}
                      </p>
                    )}
                  </div>
                  <span className="text-lg font-bold text-success-400">£{quote.deposit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-warning-500/10 rounded-lg border border-warning-500/20">
                  <span className="text-sm text-warning-400 font-medium">Balance Due on Completion</span>
                  <span className="text-lg font-bold text-warning-400">£{(quote.total - quote.deposit).toLocaleString()}</span>
                </div>
              </div>
              {quote.status === 'deposit_paid' && (
                <div className="mt-4 p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg">
                  <p className="text-xs text-primary-300">
                    💡 <strong>Next Step:</strong> Schedule the installation with the customer
                  </p>
                </div>
              )}
            </Card>
          ) : null}

          {/* Customer Availability */}
          {quote.customerAvailability && (
            <Card className="bg-gradient-to-br from-primary-500/10 to-primary-600/5 border-primary-500/20">
              <h3 className="section-title flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-400" />
                Customer Availability
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-400 mb-2">Available Dates:</p>
                  <div className="flex flex-wrap gap-2">
                    {quote.customerAvailability.dates.map((date, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-primary-500/20 border border-primary-500/30 rounded-lg px-3 py-2"
                      >
                        <Calendar className="w-4 h-4 text-primary-400" />
                        <span className="text-sm text-white">
                          {format(new Date(date), 'dd MMM yyyy')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg">
                  <Clock className="w-5 h-5 text-primary-400" />
                  <div>
                    <span className="text-xs text-slate-400">Preferred Time:</span>
                    <p className="text-sm text-white font-medium capitalize">
                      {quote.customerAvailability.timeSlot === 'fullday' ? 'Full Day (Flexible)' : quote.customerAvailability.timeSlot}
                    </p>
                  </div>
                </div>

                {quote.customerAvailability.notes && (
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-slate-400 mb-1">Additional Notes:</p>
                    <p className="text-sm text-slate-300">{quote.customerAvailability.notes}</p>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-700">
                  <p className="text-xs text-slate-500">
                    Submitted: {format(new Date(quote.customerAvailability.submittedAt), 'dd MMM yyyy, HH:mm')}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Tariff Info */}
          <Card>
            <h3 className="section-title flex items-center gap-2">
              <Zap className="w-5 h-5 text-warning-400" />
              Tariff Details
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Import Rate</span>
                <span className="text-white">£{quote.tariff.importRate.toFixed(2)}/kWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Export Rate</span>
                <span className="text-white">£{quote.tariff.exportRate.toFixed(2)}/kWh</span>
              </div>
              {quote.tariff.hasTimeOfUse && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Peak Rate</span>
                    <span className="text-white">£{quote.tariff.peakRate?.toFixed(2)}/kWh</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Off-Peak Rate</span>
                    <span className="text-white">£{quote.tariff.offPeakRate?.toFixed(2)}/kWh</span>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Property Details */}
          <Card>
            <h3 className="section-title flex items-center gap-2">
              <Home className="w-5 h-5 text-primary-400" />
              Property Details
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Annual Usage</span>
                <span className="text-white">{quote.customer.annualConsumptionKwh.toLocaleString()} kWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Existing Solar</span>
                <span className="text-white">
                  {quote.customer.existingSolar ? `${quote.customer.solarCapacityKwp} kWp` : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Electric Vehicle</span>
                <span className="text-white">
                  {quote.customer.hasEv ? `${quote.customer.evMileagePerYear?.toLocaleString()} miles/yr` : 'No'}
                </span>
              </div>
            </div>
          </Card>

          {/* Valid Until */}
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary-500/20 rounded-xl">
                <Calendar className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Quote Valid Until</p>
                <p className="text-white font-medium">
                  {format(new Date(quote.validUntil), 'dd MMMM yyyy')}
                </p>
              </div>
            </div>
          </Card>

          {/* Notes */}
          {quote.notes && (
            <Card>
              <h3 className="section-title">Notes</h3>
              <p className="text-slate-300">{quote.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {/* Generating Documents Modal */}
      <Modal
        isOpen={showGeneratingModal}
        onClose={() => {}} // Prevent closing while generating
        title="Generating Documents"
        size="sm"
      >
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
          <p className="text-slate-300 font-medium">Waiting for generating documents...</p>
          <p className="text-sm text-slate-500 text-center">
            We're preparing your proposal pack and generating all necessary PDFs. This may take a few moments.
          </p>
        </div>
      </Modal>

      {/* Share Link Modal */}
      <Modal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Quote with Customer"
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <p className="text-slate-300 mb-4">
              Share this link with your customer so they can view and accept the quote online.
            </p>
            
            {/* Quote Status Info */}
            {quote.sentAt && (
              <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                  <Send className="w-4 h-4" />
                  <span>Sent on {format(new Date(quote.sentAt), 'dd MMMM yyyy \'at\' HH:mm')}</span>
                </div>
                {quote.viewedAt && (
                  <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                    <Eye className="w-4 h-4" />
                    <span>Viewed on {format(new Date(quote.viewedAt), 'dd MMMM yyyy \'at\' HH:mm')}</span>
                  </div>
                )}
                {quote.acceptedAt && (
                  <div className="flex items-center gap-2 text-sm text-success-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Accepted on {format(new Date(quote.acceptedAt), 'dd MMMM yyyy \'at\' HH:mm')}</span>
                  </div>
                )}
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
              className="flex-1 !border-[#25D366] text-white"
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Quote"
        message="Are you sure you want to delete this quote? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

function TimelineItem({ 
  title, 
  date, 
  isComplete, 
  status,
  isLast = false,
  isNextComplete = false
}: { 
  title: string; 
  date?: string; 
  isComplete: boolean;
  status?: 'success' | 'error';
  isLast?: boolean;
  isNextComplete?: boolean;
}) {
  const getColor = () => {
    if (!isComplete) return 'bg-slate-700';
    if (status === 'error') return 'bg-red-500';
    // ALL completed items get yellow dots (no green for success)
    return 'bg-yellow-400';
  };

  const getBorderColor = () => {
    if (!isComplete) return 'border-slate-700';
    if (status === 'error') return 'border-red-500';
    // ALL completed items get yellow borders
    return 'border-yellow-400';
  };
  
  // Debug log for sent/viewed items
  if (title === 'Sent to Customer' || title === 'Viewed by Customer') {
    console.log(`🔍 ${title}:`, {
      date,
      isComplete,
      status,
      isNextComplete,
      color: getColor(),
      borderColor: getBorderColor(),
    });
  }

  return (
    <div className="flex items-start gap-3 relative">
      {/* Connecting Line - yellow only if both current AND next are complete */}
      {!isLast && (
        <div className={`absolute left-[5px] top-[18px] w-0.5 h-full ${
          isComplete && isNextComplete ? 'bg-yellow-400' : 'bg-slate-700'
        }`} />
      )}
      
      {/* Status Dot */}
      <div className={`w-3 h-3 rounded-full mt-1.5 relative z-10 border-2 ${getColor()} ${getBorderColor()}`} />
      
      {/* Content */}
      <div className="flex-1 pb-2">
        <p className={`text-sm font-medium ${isComplete ? 'text-white' : 'text-slate-500'}`}>
          {title}
        </p>
        {date && (
          <p className="text-xs text-slate-500">
            {format(new Date(date), 'dd MMM yyyy, HH:mm')}
          </p>
        )}
      </div>
    </div>
  );
}

