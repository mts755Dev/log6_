import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Download,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  User,
  MapPin,
  Calendar,
  Clock,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { JobStatusPipeline } from '../../components/ui/JobStatusPipeline';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { format } from 'date-fns';
import type { Quote } from '../../types';

interface CommissioningDocument {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  notes: string | null;
  review_status: 'pending' | 'approved' | 'rejected';
  reviewed_at: string | null;
  review_notes: string | null;
}

export function InstallationReviewPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [documents, setDocuments] = useState<CommissioningDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Document rejection modal
  const [showDocRejectModal, setShowDocRejectModal] = useState(false);
  const [documentToReject, setDocumentToReject] = useState<CommissioningDocument | null>(null);
  const [docRejectionReason, setDocRejectionReason] = useState('');

  useEffect(() => {
    if (quoteId) {
      fetchReviewData();
    }
  }, [quoteId]);

  const fetchReviewData = async () => {
    try {
      setIsLoading(true);

      // Fetch quote
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();

      if (quoteError) throw quoteError;

      setQuote(mapQuote(quoteData));

      // Fetch commissioning documents
      const { data: docsData, error: docsError } = await supabase
        .from('commissioning_documents')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;

      setDocuments(docsData || []);
    } catch (error: any) {
      console.error('Error fetching review data:', error);
      toast.error('Failed to load installation data');
    } finally {
      setIsLoading(false);
    }
  };

  const mapQuote = (data: any): Quote => ({
    id: data.id,
    companyId: data.company_id,
    installerId: data.installer_id,
    installerName: data.installer_name,
    reference: data.reference,
    status: data.status,
    installationType: data.installation_type,
    customer: data.customer,
    tariff: data.tariff,
    lineItems: data.line_items || [],
    subtotal: parseFloat(data.subtotal),
    vatRate: parseFloat(data.vat_rate),
    vatAmount: parseFloat(data.vat_amount),
    total: parseFloat(data.total),
    deposit: parseFloat(data.deposit),
    margin: parseFloat(data.margin),
    marginPercentage: parseFloat(data.margin_percentage),
    roiProjections: data.roi_projections || [],
    paybackYears: parseFloat(data.payback_years),
    annualSavings: parseFloat(data.annual_savings),
    notes: data.notes || '',
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
  });

  const handleApproveDocument = async (docId: string) => {
    // ✨ OPTIMISTIC UPDATE - Update UI immediately
    const previousDocuments = [...documents];
    
    setDocuments(documents.map(doc => 
      doc.id === docId 
        ? { 
            ...doc, 
            review_status: 'approved' as const,
            reviewed_by: user?.id,
            reviewed_at: new Date().toISOString(),
          }
        : doc
    ));

    try {
      const { error } = await supabase
        .from('commissioning_documents')
        .update({
          review_status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', docId);

      if (error) throw error;

      toast.success('Document approved');
      // ✅ NO PAGE RELOAD - UI already updated!
    } catch (error: any) {
      console.error('Error approving document:', error);
      toast.error('Failed to approve document');
      
      // ❌ ROLLBACK - Restore previous state on error
      setDocuments(previousDocuments);
    }
  };

  // Open document rejection modal
  const handleOpenDocRejectModal = (doc: CommissioningDocument) => {
    setDocumentToReject(doc);
    setDocRejectionReason('');
    setShowDocRejectModal(true);
  };

  // Confirm document rejection
  const handleConfirmDocReject = async () => {
    if (!documentToReject || !docRejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    const docId = documentToReject.id;
    const reason = docRejectionReason;

    // ✨ OPTIMISTIC UPDATE - Update UI immediately
    const previousDocuments = [...documents];
    
    setDocuments(documents.map(doc => 
      doc.id === docId 
        ? { 
            ...doc, 
            review_status: 'rejected' as const,
            reviewed_by: user?.id,
            reviewed_at: new Date().toISOString(),
            review_notes: reason,
          }
        : doc
    ));

    // Close modal immediately for better UX
    setShowDocRejectModal(false);
    setDocumentToReject(null);
    setDocRejectionReason('');

    try {
      const { error } = await supabase
        .from('commissioning_documents')
        .update({
          review_status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reason,
        })
        .eq('id', docId);

      if (error) throw error;

      toast.success('Document rejected');
      // ✅ NO PAGE RELOAD - UI already updated!
    } catch (error: any) {
      console.error('Error rejecting document:', error);
      toast.error('Failed to reject document');
      
      // ❌ ROLLBACK - Restore previous state on error
      setDocuments(previousDocuments);
    }
  };

  const handleApproveInstallation = async () => {
    if (!user?.id || !quoteId) return;

    try {
      setIsProcessing(true);

      const { data, error } = await supabase.rpc('approve_installation_compliance', {
        p_quote_id: quoteId,
        p_compliance_officer_id: user.id,
        p_notes: approvalNotes || null,
      });

      if (error) throw error;

      toast.success('Installation approved! MCS certificate will be generated.');
      setShowApproveModal(false);
      navigate('/compliance/dashboard');
    } catch (error: any) {
      console.error('Error approving installation:', error);
      toast.error(error.message || 'Failed to approve installation');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectInstallation = async () => {
    if (!user?.id || !quoteId || !rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    try {
      setIsProcessing(true);

      const { data, error } = await supabase.rpc('reject_installation_compliance', {
        p_quote_id: quoteId,
        p_compliance_officer_id: user.id,
        p_reason: rejectionReason,
      });

      if (error) throw error;

      toast.success('Installation rejected. Installer will be notified to resubmit.');
      setShowRejectModal(false);
      navigate('/compliance/dashboard');
    } catch (error: any) {
      console.error('Error rejecting installation:', error);
      toast.error('Failed to reject installation');
    } finally {
      setIsProcessing(false);
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      site_photos: 'Site Photos (CC18)',
      delivery_notes: 'Delivery Notes (CC19)',
      test_certificates: 'Test Certificates (CC21)',
      battery_testing: 'Battery Testing (F74)',
      commissioning_form: 'Commissioning Form (F75)',
      other: 'Other Documents',
    };
    return labels[type] || type;
  };

  const allDocumentsApproved = documents.length > 0 && documents.every((d) => d.review_status === 'approved');
  const hasRejectedDocuments = documents.some((d) => d.review_status === 'rejected');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-slate-400">Loading installation...</p>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <p className="text-slate-400 mb-4">Installation not found</p>
        <Button variant="secondary" onClick={() => navigate('/compliance/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/compliance/dashboard')}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="page-title">{quote.reference}</h1>
            <p className="page-subtitle">Compliance Review</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!hasRejectedDocuments && (
            <>
              <Button
                variant="danger"
                leftIcon={<XCircle className="w-4 h-4" />}
                onClick={() => setShowRejectModal(true)}
              >
                Reject
              </Button>
              <Button
                variant="primary"
                leftIcon={<CheckCircle className="w-4 h-4" />}
                onClick={() => setShowApproveModal(true)}
                disabled={!allDocumentsApproved}
              >
                Approve Installation
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status Alert */}
      {!allDocumentsApproved && !hasRejectedDocuments && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            <p className="text-yellow-400">
              Review all documents before approving the installation
            </p>
          </div>
        </div>
      )}

      {hasRejectedDocuments && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-400">
              Some documents have been rejected. Awaiting resubmission from installer.
            </p>
          </div>
        </div>
      )}

      {/* Job Progress */}
      <Card>
        <h2 className="text-xl font-bold text-white mb-6">Installation Progress</h2>
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

      {/* Customer & Installation Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="section-title flex items-center gap-2">
            <User className="w-5 h-5 text-primary-400" />
            Customer Information
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Name</p>
              <p className="text-white font-medium">{quote.customer.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Email</p>
              <p className="text-white">{quote.customer.email}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Address</p>
              <p className="text-white">{quote.customer.address}</p>
              <p className="text-slate-400 text-sm">{quote.customer.postcode}</p>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="section-title flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-400" />
            Installation Details
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Installation Date</p>
              <p className="text-white">
                {quote.installationCompletedAt
                  ? format(new Date(quote.installationCompletedAt), 'dd MMMM yyyy, HH:mm')
                  : 'Not completed'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Commissioning Uploaded</p>
              <p className="text-white">
                {quote.commissioningUploadedAt
                  ? format(new Date(quote.commissioningUploadedAt), 'dd MMMM yyyy, HH:mm')
                  : 'Not uploaded'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Company</p>
              <p className="text-white">{quote.installerName}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Commissioning Documents */}
      <Card>
        <h2 className="text-xl font-bold text-white mb-6">Commissioning Documents</h2>

        {documents.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No commissioning documents uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800/50 rounded-lg p-4 border border-slate-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                      {doc.mime_type?.startsWith('image/') ? (
                        <ImageIcon className="w-6 h-6 text-primary-400" />
                      ) : (
                        <FileText className="w-6 h-6 text-primary-400" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-white">{getDocumentTypeLabel(doc.document_type)}</h4>
                        <motion.div
                          key={`${doc.id}-${doc.review_status}`}
                          initial={{ scale: 1.3, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.3, type: "spring" }}
                        >
                          <Badge
                            className={
                              doc.review_status === 'approved'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : doc.review_status === 'rejected'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            }
                          >
                            {doc.review_status === 'approved' && <CheckCircle className="w-3 h-3 mr-1 inline" />}
                            {doc.review_status === 'rejected' && <XCircle className="w-3 h-3 mr-1 inline" />}
                            {doc.review_status === 'pending' && <Clock className="w-3 h-3 mr-1 inline" />}
                            {doc.review_status}
                          </Badge>
                        </motion.div>
                      </div>

                      <p className="text-sm text-slate-400 mb-1">{doc.file_name}</p>
                      <p className="text-xs text-slate-500">
                        Uploaded {format(new Date(doc.uploaded_at), 'dd MMM yyyy, HH:mm')}
                      </p>

                      {doc.notes && (
                        <p className="text-sm text-slate-300 mt-2 bg-slate-900/50 p-2 rounded">
                          {doc.notes}
                        </p>
                      )}

                      {doc.review_notes && (
                        <p className="text-sm text-red-300 mt-2 bg-red-500/10 p-2 rounded border border-red-500/30">
                          <strong>Rejection Reason:</strong> {doc.review_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Download className="w-4 h-4" />}
                      onClick={() => window.open(doc.file_url, '_blank')}
                    >
                      View
                    </Button>

                    {doc.review_status === 'pending' && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex items-center gap-2"
                      >
                        <Button
                          variant="success"
                          size="sm"
                          leftIcon={<CheckCircle className="w-4 h-4" />}
                          onClick={() => handleApproveDocument(doc.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          leftIcon={<XCircle className="w-4 h-4" />}
                          onClick={() => handleOpenDocRejectModal(doc)}
                        >
                          Reject
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Installation"
      >
        <div className="space-y-4">
          <p className="text-slate-300">
            You are about to approve this installation. This will trigger the MCS certificate generation process.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Approval Notes (Optional)
            </label>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
              rows={4}
              placeholder="Add any notes about this approval..."
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowApproveModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleApproveInstallation}
              isLoading={isProcessing}
              leftIcon={<CheckCircle className="w-4 h-4" />}
              className="flex-1"
            >
              Confirm Approval
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Installation Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Installation"
      >
        <div className="space-y-4">
          <p className="text-slate-300">
            Please provide a detailed reason for rejecting this installation. The installer will be notified.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Rejection Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
              rows={4}
              placeholder="Explain what needs to be corrected..."
              required
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowRejectModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRejectInstallation}
              isLoading={isProcessing}
              leftIcon={<XCircle className="w-4 h-4" />}
              className="flex-1"
              disabled={!rejectionReason.trim()}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Document Modal */}
      <Modal
        isOpen={showDocRejectModal}
        onClose={() => {
          setShowDocRejectModal(false);
          setDocumentToReject(null);
          setDocRejectionReason('');
        }}
        title="Reject Document"
      >
        <div className="space-y-4">
          <p className="text-slate-300">
            Why are you rejecting <strong>{documentToReject && getDocumentTypeLabel(documentToReject.document_type)}</strong>?
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Rejection Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              value={docRejectionReason}
              onChange={(e) => setDocRejectionReason(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
              rows={4}
              placeholder="Explain why this document is not acceptable..."
              autoFocus
            />
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-xs text-yellow-400">
              The engineer will see this reason and can reupload the document.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDocRejectModal(false);
                setDocumentToReject(null);
                setDocRejectionReason('');
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDocReject}
              leftIcon={<XCircle className="w-4 h-4" />}
              className="flex-1"
              disabled={!docRejectionReason.trim()}
            >
              Reject Document
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
