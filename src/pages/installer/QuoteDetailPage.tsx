import { useState } from 'react';
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
} from 'lucide-react';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { QuoteStatusBadge } from '../../components/ui/Badge';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { generateQuotePDF } from '../../services/pdfGenerator';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
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
  const { getQuote, updateQuote, deleteQuote, canCreateQuote, deductQuoteCredit } = useData();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  const quote = id ? getQuote(id) : null;

  const handleExportPDF = async () => {
    if (!quote || !user) return;
    setIsExporting(true);
    try {
      await generateQuotePDF(quote, user.companyName || 'heliOS Platform');
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

  const handleSendQuote = async () => {
    if (!user || !user.companyId) return;
    setIsSending(true);

    try {
      // Check eligibility
      const eligibility = await canCreateQuote(user.companyId);
      if (!eligibility.canCreate) {
        toast.error(eligibility.reason || 'Unable to send quote');
        setIsSending(false);
        return;
      }

      // Update quote status
      await updateQuote(quote.id, {
        status: 'sent',
        sentAt: new Date().toISOString(),
      });

      // Deduct credit/increment counter
      await deductQuoteCredit(user.companyId);
      toast.success('Quote sent successfully! Credit deducted.');
    } catch (error) {
      console.error('Error sending quote:', error);
      toast.error('Failed to send quote. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

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

  const handleOpenShareModal = async () => {
    setShowShareModal(true);
    await generateOrFetchShareToken();
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
          {quote.status === 'draft' && (
            <Button 
              onClick={handleSendQuote} 
              leftIcon={<Send className="w-4 h-4" />}
              isLoading={isSending}
            >
              Send to Customer
            </Button>
          )}
          {(quote.status === 'sent' || quote.status === 'viewed' || quote.status === 'accepted') && (
            <Button 
              variant="secondary" 
              leftIcon={<Share2 className="w-4 h-4" />}
              onClick={handleOpenShareModal}
            >
              Share Link
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
            <div className="space-y-4">
              <TimelineItem
                title="Created"
                date={quote.createdAt}
                isComplete
              />
              <TimelineItem
                title="Sent to Customer"
                date={quote.sentAt}
                isComplete={!!quote.sentAt}
              />
              <TimelineItem
                title="Viewed by Customer"
                date={quote.viewedAt}
                isComplete={!!quote.viewedAt}
              />
              <TimelineItem
                title="Customer Response"
                date={quote.acceptedAt}
                isComplete={quote.status === 'accepted' || quote.status === 'rejected'}
                status={quote.status === 'accepted' ? 'success' : quote.status === 'rejected' ? 'error' : undefined}
              />
            </div>
          </Card>

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
              leftIcon={<ExternalLink className="w-4 h-4" />}
              onClick={handleOpenCustomerView}
              className="flex-1"
            >
              Preview Customer View
            </Button>
            <Button
              onClick={() => setShowShareModal(false)}
              className="flex-1"
            >
              Done
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
  status 
}: { 
  title: string; 
  date?: string; 
  isComplete: boolean;
  status?: 'success' | 'error';
}) {
  const getColor = () => {
    if (!isComplete) return 'bg-slate-700';
    if (status === 'success') return 'bg-success-500';
    if (status === 'error') return 'bg-red-500';
    return 'bg-primary-500';
  };

  return (
    <div className="flex items-start gap-3">
      <div className={`w-3 h-3 rounded-full mt-1.5 ${getColor()}`} />
      <div className="flex-1">
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

