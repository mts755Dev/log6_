import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Calendar,
  Eye,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { DocumentUploadModal } from '../../components/onboarding/DocumentUploadModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { format } from 'date-fns';
import { terminateWorker } from '../../utils/documentScanner';
import { Select } from '../../components/ui/Select';
import type {
  InstallerOnboardingDoc,
  OnboardingDocumentType,
  OnboardingDocumentStatus,
  ConsumerCode,
} from '../../types';
import { CONSUMER_CODE_LABELS } from '../../types';

const DOCUMENT_UPLOAD_FIELDS: Partial<
  Record<OnboardingDocumentType, { showDates: boolean; showReference: boolean; showProvider: boolean }>
> = {
  competency_cards: { showDates: true, showReference: true, showProvider: true },
  course_certificates: { showDates: true, showReference: true, showProvider: true },
  insurance: { showDates: true, showReference: true, showProvider: true },
  mcs_certificate: { showDates: true, showReference: true, showProvider: false },
  ibg_certificate: { showDates: true, showReference: true, showProvider: true },
  waste_carrier_license: { showDates: true, showReference: true, showProvider: true },
  weee_license: { showDates: true, showReference: true, showProvider: true },
};

const REQUIRED_DOCUMENTS: Array<{
  type: OnboardingDocumentType;
  label: string;
  description: string;
  required: boolean;
}> = [
  { type: 'competency_cards', label: 'Competency Cards', description: 'Relevant competency cards for installation work', required: true },
  { type: 'course_certificates', label: 'Course Completion Certificates', description: 'Training and certification records', required: true },
  { type: 'insurance', label: 'Insurance Documents', description: 'Public liability and professional indemnity insurance', required: true },
  { type: 'mcs_certificate', label: 'MCS Certificate', description: 'Microgeneration Certification Scheme certificate', required: true },
  { type: 'ibg_certificate', label: 'Insurance Backed Guarantee Certificate', description: 'IBG provider certificate', required: true },
  { type: 'waste_carrier_license', label: 'Waste Carrier License', description: 'Waste removal license (if applicable)', required: false },
  { type: 'weee_license', label: 'WEEE Transfer License', description: 'WEEE transfer license (if applicable)', required: false },
];

/** Required document files that admins review individually (progress bars use this count only) */
const ONBOARDING_DOCUMENT_COUNT = REQUIRED_DOCUMENTS.filter((d) => d.required).length;

export function OnboardingPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [documents, setDocuments] = useState<InstallerOnboardingDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [onboardingStatus, setOnboardingStatus] = useState<string>('pending');
  const [progressStats, setProgressStats] = useState({
    uploaded: 0,
    approved: 0,
    pendingReview: 0,
    needsAction: 0,
    missing: 0,
    totalRequired: ONBOARDING_DOCUMENT_COUNT,
  });
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [currentUploadType, setCurrentUploadType] = useState<{
    type: OnboardingDocumentType;
    label: string;
  } | null>(null);
  const [consumerCode, setConsumerCode] = useState<string>('');
  const [savingConsumerCode, setSavingConsumerCode] = useState(false);

  useEffect(() => {
    if (user?.companyId) {
      fetchDocuments();
      fetchConsumerCode();
    }
    return () => {
      void terminateWorker();
    };
  }, [user]);

  useEffect(() => {
    if (user?.companyId) {
      calculateProgressMetrics();
    }
  }, [documents, user]);

  const fetchDocuments = async () => {
    if (!user?.companyId) return;
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('installer_onboarding_docs')
        .select('*')
        .eq('company_id', user.companyId)
        .eq('is_current', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments((data || []).map(mapDocument));

      const { data: companyData } = await supabase
        .from('companies')
        .select('onboarding_status')
        .eq('id', user.companyId)
        .single();
      if (companyData?.onboarding_status) {
        setOnboardingStatus(companyData.onboarding_status);
      }
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConsumerCode = async () => {
    if (!user?.companyId) return;
    try {
      const { data } = await supabase
        .from('companies')
        .select('consumer_code, onboarding_status, onboarding_completed_at')
        .eq('id', user.companyId)
        .single();
      if (data?.consumer_code) setConsumerCode(data.consumer_code);
      if (data?.onboarding_status) setOnboardingStatus(data.onboarding_status);
    } catch (error) {
      console.error('Error fetching consumer code:', error);
    }
  };

  const handleConsumerCodeChange = async (value: string) => {
    if (!user?.companyId) return;
    setConsumerCode(value);
    setSavingConsumerCode(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({ consumer_code: value || null })
        .eq('id', user.companyId);
      if (error) throw error;
      toast.success('Consumer code updated');
    } catch (error: any) {
      console.error('Error saving consumer code:', error);
      toast.error('Failed to update consumer code');
    } finally {
      setSavingConsumerCode(false);
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

  const calculateProgressMetrics = async () => {
    if (!user?.companyId) return;

    const requiredTypes = REQUIRED_DOCUMENTS.filter((d) => d.required).map((d) => d.type);
    const totalRequired = requiredTypes.length;

    let uploaded = 0;
    let approved = 0;
    let pendingReview = 0;
    let needsAction = 0;
    let missing = 0;

    for (const type of requiredTypes) {
      const doc = documents.find((d) => d.documentType === type);
      if (!doc) {
        missing += 1;
        continue;
      }
      uploaded += 1;
      if (doc.status === 'approved') approved += 1;
      else if (doc.status === 'pending') pendingReview += 1;
      else if (doc.status === 'rejected' || doc.status === 'requires_update' || doc.status === 'expired') {
        needsAction += 1;
      }
    }

    const uploadPct = Math.round((uploaded / totalRequired) * 100);
    const verificationPct = Math.round((approved / totalRequired) * 100);

    setUploadProgress(uploadPct);
    setProgressStats({
      uploaded,
      approved,
      pendingReview,
      needsAction,
      missing,
      totalRequired,
    });

    let finalVerificationPct = verificationPct;
    try {
      const { data: rpcData, error } = await supabase.rpc('get_onboarding_progress', {
        p_company_id: user.companyId,
      });
      if (!error && typeof rpcData === 'number') {
        finalVerificationPct = rpcData;
      }
    } catch (error) {
      console.warn('RPC progress fallback to client calculation:', error);
    }

    setVerificationProgress(finalVerificationPct);

    const allRequiredApproved =
      approved === totalRequired &&
      uploaded === totalRequired &&
      finalVerificationPct === 100;

    if (allRequiredApproved) {
      setOnboardingStatus('approved');
      const { data: companyData } = await supabase
        .from('companies')
        .select('onboarding_status')
        .eq('id', user.companyId)
        .single();
      if (companyData?.onboarding_status === 'approved') {
        setOnboardingStatus('approved');
      }
    }
  };

  const isFullyVerified =
    progressStats.approved === ONBOARDING_DOCUMENT_COUNT &&
    progressStats.uploaded === ONBOARDING_DOCUMENT_COUNT;

  const displayOnboardingStatus = isFullyVerified ? 'approved' : onboardingStatus;

  const openUploadModal = (type: OnboardingDocumentType, label: string) => {
    setCurrentUploadType({ type, label });
    setIsUploadModalOpen(true);
  };

  const handleFileUpload = async (
    type: OnboardingDocumentType,
    file: File,
    metadata: { issuedDate?: string; expiryDate?: string; referenceNumber?: string; providerName?: string }
  ) => {
    if (!user?.companyId) return;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `onboarding/${user.companyId}/${type}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('installer_onboarding_docs').insert({
        company_id: user.companyId,
        uploaded_by: user.id,
        document_type: type,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        issued_date: metadata.issuedDate || null,
        expiry_date: metadata.expiryDate || null,
        reference_number: metadata.referenceNumber || null,
        provider_name: metadata.providerName || null,
        status: 'pending',
      });
      if (dbError) throw dbError;

      toast.success('Document uploaded successfully!');
      await fetchDocuments();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
      throw error;
    }
  };

  const getDocumentForType = (type: OnboardingDocumentType) => {
    return documents.find(d => d.documentType === type);
  };

  const getStatusColor = (status: OnboardingDocumentStatus) => {
    const colors: Record<OnboardingDocumentStatus, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      approved: 'bg-green-500/20 text-green-400',
      rejected: 'bg-red-500/20 text-red-400',
      expired: 'bg-red-500/20 text-red-400',
      requires_update: 'bg-orange-500/20 text-orange-400',
    };
    return colors[status];
  };

  const getOnboardingStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Not started',
      documents_submitted: 'Documents submitted',
      under_review: 'Under admin review',
      approved: 'Fully verified',
      rejected: 'Requires updates',
      requires_update: 'Requires updates',
    };
    return labels[status] || status.replace(/_/g, ' ');
  };

  const getOnboardingStatusColor = (status: string) => {
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

  const getStatusIcon = (status: OnboardingDocumentStatus) => {
    const icons: Record<OnboardingDocumentStatus, React.ReactNode> = {
      pending: <Clock className="w-4 h-4" />,
      approved: <CheckCircle className="w-4 h-4" />,
      rejected: <XCircle className="w-4 h-4" />,
      expired: <AlertTriangle className="w-4 h-4" />,
      requires_update: <AlertTriangle className="w-4 h-4" />,
    };
    return icons[status];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-slate-400">Loading onboarding documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Company Onboarding</h1>
        <p className="page-subtitle">Upload required documents for verification</p>
      </div>

      <Card className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Onboarding Progress</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Track document uploads and admin verification for your {ONBOARDING_DOCUMENT_COUNT} required files.
            </p>
          </div>
          <Badge className={getOnboardingStatusColor(displayOnboardingStatus)}>
            {displayOnboardingStatus === 'approved' ? (
              <CheckCircle className="w-4 h-4 mr-1" />
            ) : (
              <Clock className="w-4 h-4 mr-1" />
            )}
            {getOnboardingStatusLabel(displayOnboardingStatus)}
          </Badge>
        </div>



        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-medium text-white">Upload completeness</p>
              <p className="text-xs text-slate-400">
                {progressStats.uploaded} of {ONBOARDING_DOCUMENT_COUNT} documents submitted
              </p>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Required document files only.
            </p>
            <div className="w-full bg-slate-800 rounded-full h-3">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">{uploadProgress}% uploaded</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-medium text-white">Admin verification</p>
              <p className="text-xs text-slate-400">
                {progressStats.approved} of {ONBOARDING_DOCUMENT_COUNT} files approved
              </p>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3">
              <div
                className="bg-green-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${verificationProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">{verificationProgress}% verified by admin</p>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 uppercase tracking-wide pt-1">
          Document status ({ONBOARDING_DOCUMENT_COUNT} required files)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 text-center">
            <p className="text-lg font-bold text-green-400">{progressStats.approved}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Approved</p>
          </div>
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-center">
            <p className="text-lg font-bold text-yellow-400">{progressStats.pendingReview}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Pending review</p>
          </div>
          <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2 text-center">
            <p className="text-lg font-bold text-orange-400">{progressStats.needsAction}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Needs re-upload</p>
          </div>
          <div className="rounded-lg bg-slate-500/10 border border-slate-600/30 px-3 py-2 text-center">
            <p className="text-lg font-bold text-slate-300">{progressStats.missing}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Not uploaded</p>
          </div>
        </div>

        {isFullyVerified && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm text-green-300">
              <CheckCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              All required documents are approved. Your company onboarding is fully verified.
            </p>
          </div>
        )}

        {uploadProgress === 100 && verificationProgress < 100 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-sm text-amber-200/90">
              <Clock className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              You have submitted everything. Verification progress updates when an admin approves each document — pending items are normal.
            </p>
          </div>
        )}
      </Card>

      {/* Consumer Code Selection */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Consumer Code Membership</h3>
            </div>
            <p className="text-sm text-slate-400 mb-3">
              Select your consumer code. This is required for proposals but is not counted in the progress bars above.
              The standard leaflet will be automatically attached to customer proposals.
            </p>
            <div className="max-w-sm">
              <Select
                label=""
                value={consumerCode}
                onChange={(e) => handleConsumerCodeChange(e.target.value)}
                options={Object.entries(CONSUMER_CODE_LABELS).map(([value, label]) => ({ value, label }))}
                placeholder="Select your consumer code..."
              />
            </div>
            {consumerCode && (
              <p className="text-xs text-green-400/80 mt-2">
                The standard {consumerCode} consumer code leaflet will be included with your proposals.
              </p>
            )}
          </div>
          {consumerCode && (
            <Badge className="bg-green-500/20 text-green-400">
              <CheckCircle className="w-4 h-4 mr-1" />
              {consumerCode}
            </Badge>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        {REQUIRED_DOCUMENTS.map((docType) => {
          const existingDoc = getDocumentForType(docType.type);
          return (
            <motion.div key={docType.type} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={existingDoc?.status === 'approved' ? 'border-green-500/50' : ''}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-5 h-5 text-primary-400" />
                      <h3 className="text-lg font-semibold text-white">{docType.label}</h3>
                      {docType.required && (
                        <Badge className="bg-red-500/20 text-red-400 text-xs">Required</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mb-3">{docType.description}</p>

                    {existingDoc && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(existingDoc.status)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(existingDoc.status)}
                              {existingDoc.status}
                            </span>
                          </Badge>
                          {existingDoc.expiryDate && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Expires: {format(new Date(existingDoc.expiryDate), 'dd MMM yyyy')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-300">{existingDoc.fileName}</p>
                        {existingDoc.rejectionReason && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mt-2">
                            <p className="text-sm text-red-400">
                              <strong>Rejection Reason:</strong> {existingDoc.rejectionReason}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {existingDoc ? (
                      <>
                        <Button variant="secondary" size="sm" leftIcon={<Eye className="w-4 h-4" />} onClick={() => window.open(existingDoc.fileUrl, '_blank')}>
                          View
                        </Button>
                        {existingDoc.status !== 'approved' && (
                          <Button variant="primary" size="sm" leftIcon={<Upload className="w-4 h-4" />} onClick={() => openUploadModal(docType.type, docType.label)}>
                            Re-upload
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button variant="primary" size="sm" leftIcon={<Upload className="w-4 h-4" />} onClick={() => openUploadModal(docType.type, docType.label)}>
                        Upload
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {currentUploadType && (
        <DocumentUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          documentType={currentUploadType.type}
          documentLabel={currentUploadType.label}
          showDates={DOCUMENT_UPLOAD_FIELDS[currentUploadType.type]?.showDates ?? true}
          showReference={DOCUMENT_UPLOAD_FIELDS[currentUploadType.type]?.showReference ?? true}
          showProvider={DOCUMENT_UPLOAD_FIELDS[currentUploadType.type]?.showProvider ?? true}
          onUpload={handleFileUpload}
        />
      )}
    </div>
  );
}
