import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  FileText,
  AlertTriangle,
  Building2,
  Calendar,
  User,
  MessageSquare,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { BulkDocumentActions } from '../../components/admin/BulkDocumentActions';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { format } from 'date-fns';
import type { InstallerOnboardingDoc, OnboardingDocumentStatus } from '../../types';

interface Company {
  id: string;
  name: string;
  onboardingStatus: string;
  onboardingCompletedAt?: string;
}

export function VerificationPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [documents, setDocuments] = useState<InstallerOnboardingDoc[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<InstallerOnboardingDoc | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      fetchDocuments(selectedCompany);
    }
  }, [selectedCompany]);

  const fetchCompanies = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, onboarding_status, onboarding_completed_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCompanies(
        (data || []).map((c) => ({
          id: c.id,
          name: c.name,
          onboardingStatus: c.onboarding_status || 'pending',
          onboardingCompletedAt: c.onboarding_completed_at,
        }))
      );

      if (data && data.length > 0) {
        setSelectedCompany(data[0].id);
      }
    } catch (error: any) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to load companies');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDocuments = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('installer_onboarding_docs')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_current', true)
        .order('document_type', { ascending: true });

      if (error) throw error;

      const mappedDocs = (data || []).map(mapDocument);
      setDocuments(mappedDocs);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    }
  };

  const mapDocument = (data: any): InstallerOnboardingDoc => ({
    id: data.id,
    companyId: data.company_id,
    uploadedBy: data.uploaded_by,
    documentType: data.document_type,
    fileName: data.file_name,
    fileUrl: data.file_url,
    fileSize: data.file_size,
    mimeType: data.mime_type,
    issuedDate: data.issued_date,
    expiryDate: data.expiry_date,
    referenceNumber: data.reference_number,
    providerName: data.provider_name,
    status: data.status,
    reviewedBy: data.reviewed_by,
    reviewedAt: data.reviewed_at,
    rejectionReason: data.rejection_reason,
    adminNotes: data.admin_notes,
    version: data.version,
    isCurrent: data.is_current,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });

  const openReviewModal = (doc: InstallerOnboardingDoc, action: 'approve' | 'reject') => {
    setSelectedDoc(doc);
    setReviewAction(action);
    setRejectionReason('');
    setAdminNotes(doc.adminNotes || '');
    setIsReviewModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedDoc || !reviewAction || !user) return;

    if (reviewAction === 'reject' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setIsSubmitting(true);

      const updateData: any = {
        status: reviewAction === 'approve' ? 'approved' : 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: adminNotes || null,
      };

      if (reviewAction === 'reject') {
        updateData.rejection_reason = rejectionReason;
      }

      const { error } = await supabase
        .from('installer_onboarding_docs')
        .update(updateData)
        .eq('id', selectedDoc.id);

      if (error) throw error;

      toast.success(`Document ${reviewAction}d successfully`);
      setIsReviewModalOpen(false);
      fetchDocuments(selectedCompany!);
      fetchCompanies(); // Refresh company status
    } catch (error: any) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: OnboardingDocumentStatus) => {
    const colors = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      approved: 'bg-green-500/20 text-green-400',
      rejected: 'bg-red-500/20 text-red-400',
      expired: 'bg-red-500/20 text-red-400',
      requires_update: 'bg-orange-500/20 text-orange-400',
    };
    return colors[status];
  };

  const getStatusIcon = (status: OnboardingDocumentStatus) => {
    const icons = {
      pending: <Clock className="w-4 h-4" />,
      approved: <CheckCircle className="w-4 h-4" />,
      rejected: <XCircle className="w-4 h-4" />,
      expired: <AlertTriangle className="w-4 h-4" />,
      requires_update: <AlertTriangle className="w-4 h-4" />,
    };
    return icons[status];
  };

  const getCompanyOnboardingColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-slate-500/20 text-slate-400',
      documents_submitted: 'bg-blue-500/20 text-blue-400',
      under_review: 'bg-yellow-500/20 text-yellow-400',
      approved: 'bg-green-500/20 text-green-400',
      rejected: 'bg-red-500/20 text-red-400',
      requires_update: 'bg-orange-500/20 text-orange-400',
    };
    return colors[status] || 'bg-slate-500/20 text-slate-400';
  };

  const handleToggleDocument = (docId: string) => {
    setSelectedDocuments(prev =>
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleToggleAll = () => {
    if (selectedDocuments.length === documents.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(documents.map(d => d.id));
    }
  };

  const handleBulkActionComplete = () => {
    setSelectedDocuments([]);
    fetchDocuments(selectedCompany!);
    fetchCompanies();
  };

  const selectedCompanyData = companies.find((c) => c.id === selectedCompany);
  const pendingCount = documents.filter((d) => d.status === 'pending').length;
  const selectedDocsData = documents.filter(d => selectedDocuments.includes(d.id));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-slate-400">Loading verification queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Installer Verification</h1>
        <p className="page-subtitle">Review and approve installer onboarding documents</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Companies List */}
        <Card className="lg:col-span-1">
          <h2 className="text-xl font-bold text-white mb-4">Companies</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {companies.map((company) => (
              <motion.button
                key={company.id}
                onClick={() => setSelectedCompany(company.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedCompany === company.id
                    ? 'bg-primary-500/20 border border-primary-500'
                    : 'bg-slate-800/50 hover:bg-slate-700/50 border border-transparent'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-white text-sm">{company.name}</span>
                </div>
                <Badge className={getCompanyOnboardingColor(company.onboardingStatus)}>
                  {company.onboardingStatus.replace(/_/g, ' ')}
                </Badge>
              </motion.button>
            ))}
          </div>
        </Card>

        {/* Documents Review */}
        <div className="lg:col-span-2 space-y-4">
          {selectedCompanyData && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  {documents.length > 0 && (
                    <input
                      type="checkbox"
                      checked={selectedDocuments.length === documents.length && documents.length > 0}
                      onChange={handleToggleAll}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-primary-500 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 cursor-pointer"
                    />
                  )}
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedCompanyData.name}</h2>
                    <p className="text-sm text-slate-400">
                      {pendingCount} document{pendingCount !== 1 ? 's' : ''} pending review
                      {selectedDocuments.length > 0 && ` • ${selectedDocuments.length} selected`}
                    </p>
                  </div>
                </div>
                <Badge className={getCompanyOnboardingColor(selectedCompanyData.onboardingStatus)}>
                  {selectedCompanyData.onboardingStatus.replace(/_/g, ' ')}
                </Badge>
              </div>
            </Card>
          )}

          {documents.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No documents uploaded yet</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className={doc.status === 'pending' ? 'border-yellow-500/50' : ''}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedDocuments.includes(doc.id)}
                          onChange={() => handleToggleDocument(doc.id)}
                          className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-800 text-primary-500 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 cursor-pointer"
                        />
                        <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <FileText className="w-5 h-5 text-primary-400" />
                          <h3 className="text-lg font-semibold text-white">
                            {doc.documentType.replace(/_/g, ' ')}
                          </h3>
                          <Badge className={getStatusColor(doc.status)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(doc.status)}
                              {doc.status}
                            </span>
                          </Badge>
                        </div>

                        <p className="text-sm text-slate-300 mb-2">{doc.fileName}</p>

                        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                          {doc.providerName && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {doc.providerName}
                            </span>
                          )}
                          {doc.referenceNumber && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {doc.referenceNumber}
                            </span>
                          )}
                          {doc.expiryDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Expires: {format(new Date(doc.expiryDate), 'dd MMM yyyy')}
                            </span>
                          )}
                          {doc.reviewedAt && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Reviewed: {format(new Date(doc.reviewedAt), 'dd MMM yyyy')}
                            </span>
                          )}
                        </div>

                        {doc.rejectionReason && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mt-3">
                            <p className="text-sm text-red-400">
                              <strong>Rejection Reason:</strong> {doc.rejectionReason}
                            </p>
                          </div>
                        )}

                        {doc.adminNotes && (
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mt-3">
                            <p className="text-sm text-blue-400">
                              <strong>Admin Notes:</strong> {doc.adminNotes}
                            </p>
                          </div>
                        )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<Eye className="w-4 h-4" />}
                          onClick={() => window.open(doc.fileUrl, '_blank')}
                        >
                          View
                        </Button>
                        {doc.status === 'pending' && (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<CheckCircle className="w-4 h-4" />}
                              onClick={() => openReviewModal(doc, 'approve')}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              leftIcon={<XCircle className="w-4 h-4" />}
                              onClick={() => openReviewModal(doc, 'reject')}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title={`${reviewAction === 'approve' ? 'Approve' : 'Reject'} Document`}
      >
        <div className="space-y-4">
          {selectedDoc && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-sm text-slate-400 mb-1">Document</p>
              <p className="text-white font-semibold">
                {selectedDoc.documentType.replace(/_/g, ' ')}
              </p>
              <p className="text-sm text-slate-300">{selectedDoc.fileName}</p>
            </div>
          )}

          {reviewAction === 'reject' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Rejection Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 transition-colors resize-none"
                rows={4}
                placeholder="Explain why this document is being rejected..."
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Admin Notes (Optional)
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 transition-colors resize-none"
              rows={3}
              placeholder="Add any internal notes..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="secondary"
              onClick={() => setIsReviewModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant={reviewAction === 'approve' ? 'primary' : 'danger'}
              onClick={handleSubmitReview}
              isLoading={isSubmitting}
              leftIcon={reviewAction === 'approve' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            >
              {reviewAction === 'approve' ? 'Approve' : 'Reject'} Document
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Actions */}
      <BulkDocumentActions
        selectedDocuments={selectedDocsData}
        onAction={handleBulkActionComplete}
        onClearSelection={() => setSelectedDocuments([])}
      />
    </div>
  );
}
