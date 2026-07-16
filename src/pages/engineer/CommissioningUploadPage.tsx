import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Upload,
  CheckCircle,
  Image as ImageIcon,
  FileText,
  Send,
  User,
  MapPin,
  Calendar,
  AlertCircle,
  Download,
  Trash2,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { JobStatusPipeline } from '../../components/ui/JobStatusPipeline';
import { supabase } from '../../lib/supabase';
import { compressForUpload } from '../../lib/compressUpload';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { format } from 'date-fns';
import type { Quote } from '../../types';

interface CommissioningDocument {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
  notes: string | null;
  review_status: 'pending' | 'approved' | 'rejected';
  review_notes: string | null;
}

const DOCUMENT_TYPES = [
  { value: 'site_photos', label: 'Site Photos (CC18)', required: true },
  { value: 'test_certificates', label: 'Test Certificates (CC21)', required: true },
  { value: 'battery_testing', label: 'Battery Testing (F74)', required: true },
  { value: 'commissioning_form', label: 'Commissioning Form (F75)', required: false },
  { value: 'delivery_notes', label: 'Delivery Notes (CC19)', required: false },
  { value: 'other', label: 'Other Documents', required: false },
];

export function CommissioningUploadPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  
  // ✨ Ref for file input to reset after upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [documents, setDocuments] = useState<CommissioningDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // ✨ NEW: Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<CommissioningDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [uploadForm, setUploadForm] = useState({
    documentType: 'site_photos',
    file: null as File | null,
    notes: '',
  });

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
    }
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      setIsLoading(true);

      // Fetch quote
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', jobId)
        .single();

      if (quoteError) throw quoteError;

      setQuote(mapQuote(quoteData));

      // Fetch documents
      const { data: docsData, error: docsError } = await supabase
        .from('commissioning_documents')
        .select('*')
        .eq('quote_id', jobId)
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;

      setDocuments(docsData || []);
    } catch (error: any) {
      console.error('Error fetching job details:', error);
      toast.error('Failed to load job details');
    } finally {
      setIsLoading(false);
    }
  };

  // ✨ NEW: Fetch only documents without re-rendering entire page
  const fetchDocuments = async () => {
    try {
      const { data: docsData, error: docsError } = await supabase
        .from('commissioning_documents')
        .select('*')
        .eq('quote_id', jobId)
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;

      setDocuments(docsData || []);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadForm({ ...uploadForm, file: e.target.files[0] });
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file || !user || !quote || !jobId) {
      toast.error('Please select a file');
      return;
    }

    try {
      setIsUploading(true);

      const { file: uploadFile } = await compressForUpload(uploadForm.file);

      // Upload file to Supabase Storage
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${jobId}/${uploadForm.documentType}_${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Save document metadata
      const { error: insertError } = await supabase
        .from('commissioning_documents')
        .insert({
          quote_id: jobId,
          company_id: quote.companyId,
          document_type: uploadForm.documentType,
          file_url: publicUrl,
          file_name: uploadFile.name,
          file_size: uploadFile.size,
          mime_type: uploadFile.type || uploadForm.file.type,
          uploaded_by: user.id,
          notes: uploadForm.notes || null,
        });

      if (insertError) throw insertError;

      // Enter commissioning stage + stamp commissioning_date from this moment
      if (['scheduled', 'in_progress', 'completed', 'commissioning'].includes(quote.status)) {
        const { uploadCommissioning, syncCommissioningDateFromJobStage } = await import(
          '../../services/jobTracking'
        );
        if (['scheduled', 'in_progress', 'completed'].includes(quote.status)) {
          await uploadCommissioning(jobId);
          setQuote({
            ...quote,
            status: 'commissioning',
            commissioningUploadedAt: new Date().toISOString(),
          });
        } else {
          await syncCommissioningDateFromJobStage(jobId);
        }
      }

      toast.success('Document uploaded successfully');
      
      // Reset form
      setUploadForm({ documentType: 'site_photos', file: null, notes: '' });
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // ✨ OPTIMIZED: Only fetch documents, not the entire page
      await fetchDocuments();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  // Open delete confirmation modal
  const handleDeleteClick = (doc: CommissioningDocument) => {
    setDocumentToDelete(doc);
    setShowDeleteModal(true);
  };

  // Actual delete handler
  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;

    try {
      setIsDeleting(true);

      const { error } = await supabase
        .from('commissioning_documents')
        .delete()
        .eq('id', documentToDelete.id);

      if (error) {
        console.error('Delete error:', error);
        throw new Error(error.message || 'Failed to delete document');
      }

      // ✨ Optimistic UI update - remove from list immediately
      setDocuments(documents.filter(d => d.id !== documentToDelete.id));

      toast.success('Document deleted successfully');
      setShowDeleteModal(false);
      setDocumentToDelete(null);
      
      // Re-fetch to ensure sync (optional, since we already updated optimistically)
      await fetchDocuments();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      
      // Show specific error message
      if (error.message?.includes('policy')) {
        toast.error('Permission denied: Cannot delete this document');
      } else if (error.message?.includes('review')) {
        toast.error('Cannot delete: Job already submitted for review');
      } else {
        toast.error(error.message || 'Failed to delete document');
      }
      
      // If error, re-fetch to restore the document
      await fetchDocuments();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!user?.id || !jobId) return;

    try {
      setIsSubmitting(true);

      const { data, error } = await supabase.rpc('submit_for_compliance', {
        p_quote_id: jobId,
        p_engineer_id: user.id,
      });

      if (error) throw error;

      const { syncCommissioningDateFromJobStage } = await import('../../services/jobTracking');
      await syncCommissioningDateFromJobStage(jobId);

      toast.success('Submitted for compliance review!');
      setShowSubmitModal(false);
      navigate('/engineer');
    } catch (error: any) {
      console.error('Error submitting for review:', error);
      toast.error(error.message || 'Failed to submit for review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requiredDocs = DOCUMENT_TYPES.filter((dt) => dt.required);
  const uploadedRequiredTypes = documents
    .map((d) => d.document_type)
    .filter((type) => requiredDocs.some((rd) => rd.value === type));
  const canSubmit = uploadedRequiredTypes.length >= 3 && documents.length >= 3;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-slate-400">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <p className="text-slate-400 mb-4">Job not found</p>
        <Button variant="secondary" onClick={() => navigate('/engineer')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const isReviewSubmitted = quote.status === 'compliance_review' || quote.status === 'mcs_certified';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/engineer')}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="page-title">{quote.reference}</h1>
            <p className="page-subtitle">Upload Commissioning Documents</p>
          </div>
        </div>

        {!isReviewSubmitted && canSubmit && (
          <Button
            variant="primary"
            leftIcon={<Send className="w-4 h-4" />}
            onClick={() => setShowSubmitModal(true)}
          >
            Submit for Review
          </Button>
        )}
      </div>

      {/* Status Alert */}
      {isReviewSubmitted && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p className="text-green-400">
              Submitted for compliance review. You'll be notified once reviewed.
            </p>
          </div>
        </div>
      )}

      {!canSubmit && !isReviewSubmitted && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            <p className="text-yellow-400">
              Upload at least 3 required documents before submitting for review
            </p>
          </div>
        </div>
      )}

      {/* Job Progress */}
      <Card>
        <h2 className="text-xl font-bold text-white mb-6">Job Progress</h2>
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

      {/* Customer Info */}
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
              <p className="text-sm text-slate-500">Address</p>
              <p className="text-white">{quote.customer.address}</p>
              <p className="text-slate-400 text-sm">{quote.customer.postcode}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Phone</p>
              <p className="text-white">{quote.customer.phone}</p>
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
                {quote.installationDate
                  ? format(new Date(quote.installationDate), 'dd MMMM yyyy')
                  : 'Not scheduled'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Completed</p>
              <p className="text-white">
                {quote.installationCompletedAt
                  ? format(new Date(quote.installationCompletedAt), 'dd MMMM yyyy, HH:mm')
                  : 'Not completed'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Company</p>
              <p className="text-white">{quote.installerName}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Upload Form */}
      {!isReviewSubmitted && (
        <Card>
          <h2 className="text-xl font-bold text-white mb-6">Upload Document</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Document Type *
              </label>
              <select
                value={uploadForm.documentType}
                onChange={(e) => setUploadForm({ ...uploadForm, documentType: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label} {type.required ? '(Required)' : '(Optional)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                File *
              </label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept="image/*,.pdf"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Accepted: Images (PNG, JPG) and PDF files
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={uploadForm.notes}
                onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
                rows={3}
                placeholder="Add any notes about this document..."
              />
            </div>

            <Button
              variant="primary"
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={handleUpload}
              isLoading={isUploading}
              disabled={!uploadForm.file}
            >
              Upload Document
            </Button>
          </div>
        </Card>
      )}

      {/* Uploaded Documents */}
      <Card>
        <h2 className="text-xl font-bold text-white mb-6">
          Uploaded Documents ({documents.length})
        </h2>

        {documents.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No documents uploaded yet</p>
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
                      <FileText className="w-6 h-6 text-primary-400" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-white">
                          {DOCUMENT_TYPES.find((dt) => dt.value === doc.document_type)?.label || doc.document_type}
                        </h4>
                        <Badge
                          className={
                            doc.review_status === 'approved'
                              ? 'bg-green-500/20 text-green-400'
                              : doc.review_status === 'rejected'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }
                        >
                          {doc.review_status}
                        </Badge>
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
                          <strong>Review Notes:</strong> {doc.review_notes}
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

                    {doc.review_status === 'pending' && !isReviewSubmitted && (
                      <Button
                        variant="danger"
                        size="sm"
                        leftIcon={<Trash2 className="w-4 h-4" />}
                        onClick={() => handleDeleteClick(doc)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* Submit Modal */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit for Compliance Review"
      >
        <div className="space-y-4">
          <p className="text-slate-300">
            You are about to submit this installation for compliance review. Make sure all required documents are uploaded.
          </p>

          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-sm font-medium text-white mb-2">Documents Uploaded:</p>
            <p className="text-2xl font-bold text-primary-400">{documents.length}</p>
            <p className="text-xs text-slate-500 mt-1">
              Minimum required: 3 (Site Photos, Test Certificates, Battery Testing)
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowSubmitModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitForReview}
              isLoading={isSubmitting}
              leftIcon={<Send className="w-4 h-4" />}
              className="flex-1"
            >
              Confirm Submit
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDocumentToDelete(null);
        }}
        title="Delete Document"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-red-500/10 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-medium mb-2">Are you sure you want to delete this document?</p>
              <p className="text-slate-400 text-sm">
                This action cannot be undone. The document will be permanently removed.
              </p>
            </div>
          </div>

          {documentToDelete && (
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-sm font-medium text-white mb-1">
                {DOCUMENT_TYPES.find((dt) => dt.value === documentToDelete.document_type)?.label || documentToDelete.document_type}
              </p>
              <p className="text-xs text-slate-400">{documentToDelete.file_name}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setDocumentToDelete(null);
              }}
              className="flex-1"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              isLoading={isDeleting}
              leftIcon={<Trash2 className="w-4 h-4" />}
              className="flex-1"
            >
              Delete Document
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
