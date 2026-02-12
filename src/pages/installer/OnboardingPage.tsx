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
  Trash2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { DocumentUploadModal } from '../../components/onboarding/DocumentUploadModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { format } from 'date-fns';
import type { InstallerOnboardingDoc, OnboardingDocumentType, OnboardingDocumentStatus } from '../../types';

const REQUIRED_DOCUMENTS: Array<{
  type: OnboardingDocumentType;
  label: string;
  description: string;
  required: boolean;
}> = [
  {
    type: 'competency_cards',
    label: 'Competency Cards',
    description: 'Relevant competency cards for installation work',
    required: true,
  },
  {
    type: 'course_certificates',
    label: 'Course Completion Certificates',
    description: 'Training and certification records',
    required: true,
  },
  {
    type: 'insurance',
    label: 'Insurance Documents',
    description: 'Public liability and professional indemnity insurance',
    required: true,
  },
  {
    type: 'mcs_certificate',
    label: 'MCS Certificate',
    description: 'Microgeneration Certification Scheme certificate',
    required: true,
  },
  {
    type: 'consumer_code_membership',
    label: 'Consumer Code Membership',
    description: 'Consumer code membership certificate',
    required: true,
  },
  {
    type: 'ibg_certificate',
    label: 'Insurance Backed Guarantee Certificate',
    description: 'IBG provider certificate',
    required: true,
  },
  {
    type: 'waste_carrier_license',
    label: 'Waste Carrier License',
    description: 'Waste removal license (if applicable)',
    required: false,
  },
  {
    type: 'weee_license',
    label: 'WEEE Transfer License',
    description: 'WEEE transfer license (if applicable)',
    required: false,
  },
];

export function OnboardingPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [documents, setDocuments] = useState<InstallerOnboardingDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [currentUploadType, setCurrentUploadType] = useState<{
    type: OnboardingDocumentType;
    label: string;
  } | null>(null);

  useEffect(() => {
    if (user?.companyId) {
      fetchDocuments();
    }
  }, [user]);

  // Recalculate progress whenever documents change
  useEffect(() => {
    if (user?.companyId && documents.length > 0) {
      calculateProgress();
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

      const mappedDocs = (data || []).map(mapDocument);
      setDocuments(mappedDocs);
      
      // Recalculate progress after fetching documents
      await calculateProgress();
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
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

  const calculateProgress = async () => {
    if (!user?.companyId) {
      console.log('❌ No company ID, cannot calculate progress');
      return;
    }

    try {
      console.log('🔄 Calculating progress for company:', user.companyId);
      
      const { data, error } = await supabase
        .rpc('get_onboarding_progress', { p_company_id: user.companyId });

      if (error) {
        console.error('❌ Error from RPC:', error);
        toast.error('Failed to calculate progress');
        return;
      }

      if (data && Array.isArray(data) && data.length > 0) {
        const progressData = data[0];
        const percentage = progressData.completion_percentage || 0;
        console.log('✅ Progress calculated:', percentage + '%');
        console.log('📊 Details:', progressData);
        setProgress(percentage);
      } else {
        console.log('⚠️ RPC returned no data');
        setProgress(0);
      }
    } catch (error) {
      console.error('❌ Error calculating progress:', error);
    }
  };

  const openUploadModal = (type: OnboardingDocumentType, label: string) => {
    setCurrentUploadType({ type, label });
    setIsUploadModalOpen(true);
  };

  const handleFileUpload = async (
    type: OnboardingDocumentType,
    file: File,
    metadata: {
      issuedDate?: string;
      expiryDate?: string;
      referenceNumber?: string;
      providerName?: string;
    }
  ) => {
    if (!user?.companyId) return;

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `onboarding/${user.companyId}/${type}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase
        .from('installer_onboarding_docs')
        .insert({
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
      fetchDocuments();
      calculateProgress();
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
      {/* Header */}
      <div>
        <h1 className="page-title">Company Onboarding</h1>
        <p className="page-subtitle">Upload required documents for verification</p>
      </div>

      {/* Progress */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Onboarding Progress</h2>
            <p className="text-sm text-slate-400">
              {progress}% complete
            </p>
          </div>
          <div className="text-right">
            <Badge className={progress === 100 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
              {progress === 100 ? <CheckCircle className="w-4 h-4 mr-1" /> : <Clock className="w-4 h-4 mr-1" />}
              {progress === 100 ? 'Completed' : 'In Progress'}
            </Badge>
          </div>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-4">
          <div
            className="bg-primary-500 h-4 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </Card>

      {/* Documents */}
      <div className="grid grid-cols-1 gap-6">
        {REQUIRED_DOCUMENTS.map((docType) => {
          const existingDoc = getDocumentForType(docType.type);

          return (
            <motion.div
              key={docType.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
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
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<Eye className="w-4 h-4" />}
                          onClick={() => window.open(existingDoc.fileUrl, '_blank')}
                        >
                          View
                        </Button>
                        {existingDoc.status !== 'approved' && (
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Upload className="w-4 h-4" />}
                            onClick={() => openUploadModal(docType.type, docType.label)}
                          >
                            Re-upload
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Upload className="w-4 h-4" />}
                        onClick={() => openUploadModal(docType.type, docType.label)}
                      >
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

      {/* Upload Modal */}
      {currentUploadType && (
        <DocumentUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          documentType={currentUploadType.type}
          documentLabel={currentUploadType.label}
          onUpload={handleFileUpload}
        />
      )}
    </div>
  );
}
