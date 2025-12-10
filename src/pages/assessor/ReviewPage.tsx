import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Battery,
  Home,
  User,
  Calendar,
  Camera,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, CommissionStatusBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getCommission, updateCommission, createCertificate } = useData();
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const commission = id ? getCommission(id) : null;

  if (!commission) {
    return (
      <div className="text-center py-20">
        <FileText className="w-12 h-12 mx-auto mb-4 text-slate-700" />
        <p className="text-slate-400 mb-4">Submission not found</p>
        <Button variant="secondary" onClick={() => navigate('/assessor/pending')}>
          Back to Pending
        </Button>
      </div>
    );
  }

  const handleApprove = async () => {
    if (!user) return;
    setIsProcessing(true);
    
    try {
      // Update commission status
      updateCommission(commission.id, {
        status: 'approved',
        assessorId: user.id,
        assessorName: user.name,
        reviewedAt: new Date().toISOString(),
      });

      // Generate certificate
      const certificate = createCertificate({
        submissionId: commission.id,
        quoteId: commission.quoteId,
        companyId: commission.companyId,
        installerId: commission.installerId,
        certificateNumber: `CERT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
        issueDate: new Date().toISOString(),
        systemDetails: commission.systemDetails,
        siteDetails: commission.siteDetails,
      });

      // Update commission with certificate ID
      updateCommission(commission.id, { certificateId: certificate.id });

      setShowApproveModal(false);
      navigate('/assessor/pending');
    } catch (error) {
      console.error('Error approving submission:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!user || !rejectionReason.trim()) return;
    setIsProcessing(true);
    
    try {
      updateCommission(commission.id, {
        status: 'rejected',
        assessorId: user.id,
        assessorName: user.name,
        reviewedAt: new Date().toISOString(),
        rejectionReason,
      });

      setShowRejectModal(false);
      navigate('/assessor/pending');
    } catch (error) {
      console.error('Error rejecting submission:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestChanges = () => {
    if (!user) return;
    
    updateCommission(commission.id, {
      status: 'requires_changes',
      assessorId: user.id,
      assessorName: user.name,
      reviewedAt: new Date().toISOString(),
    });

    navigate('/assessor/pending');
  };

  const checklistItems = [
    { key: 'visualInspection', label: 'Visual Inspection Complete' },
    { key: 'cablingCompliant', label: 'Cabling Compliant with Standards' },
    { key: 'labelingComplete', label: 'All Labels Applied' },
    { key: 'isolationDevices', label: 'Isolation Devices Installed' },
    { key: 'earthingVerified', label: 'Earthing Verified' },
    { key: 'testingComplete', label: 'Testing Complete' },
    { key: 'customerBriefed', label: 'Customer Briefed on Operation' },
    { key: 'documentationProvided', label: 'Documentation Provided' },
  ] as const;

  const allChecklistComplete = checklistItems.every(
    item => commission.checklist[item.key]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/assessor/pending')}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="page-title">Review Submission</h1>
              <CommissionStatusBadge status={commission.status} />
            </div>
            <p className="page-subtitle">
              Submitted {format(new Date(commission.submittedAt), 'dd MMMM yyyy')}
            </p>
          </div>
        </div>

        {commission.status === 'pending_review' && (
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              leftIcon={<AlertTriangle className="w-4 h-4" />}
              onClick={handleRequestChanges}
            >
              Request Changes
            </Button>
            <Button
              variant="danger"
              leftIcon={<XCircle className="w-4 h-4" />}
              onClick={() => setShowRejectModal(true)}
            >
              Reject
            </Button>
            <Button
              variant="success"
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => setShowApproveModal(true)}
            >
              Approve
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Installer Info */}
          <Card>
            <h3 className="section-title flex items-center gap-2">
              <User className="w-5 h-5 text-primary-400" />
              Installer Details
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-slate-500 mb-1">Installer</p>
                <p className="text-white font-medium">{commission.installerName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Company</p>
                <p className="text-white">{commission.companyName}</p>
              </div>
            </div>
          </Card>

          {/* Site Details */}
          <Card>
            <h3 className="section-title flex items-center gap-2">
              <Home className="w-5 h-5 text-primary-400" />
              Site Details
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-slate-500 mb-1">Customer Name</p>
                <p className="text-white font-medium">{commission.siteDetails.customerName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Postcode</p>
                <p className="text-white">{commission.siteDetails.postcode}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-slate-500 mb-1">Address</p>
                <p className="text-white">{commission.siteDetails.address}</p>
              </div>
            </div>
          </Card>

          {/* System Details */}
          <Card>
            <h3 className="section-title flex items-center gap-2">
              <Battery className="w-5 h-5 text-primary-400" />
              System Details
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-slate-500 mb-1">Battery Model</p>
                <p className="text-white font-medium">{commission.systemDetails.batteryModel}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Inverter Model</p>
                <p className="text-white">{commission.systemDetails.inverterModel}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Capacity</p>
                <p className="text-white">{commission.systemDetails.capacityKwh} kWh</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Installation Date</p>
                <p className="text-white">
                  {format(new Date(commission.systemDetails.installationDate), 'dd MMM yyyy')}
                </p>
              </div>
            </div>
          </Card>

          {/* Photos */}
          <Card>
            <h3 className="section-title flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary-400" />
              Installation Photos ({commission.photos.length})
            </h3>
            {commission.photos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {commission.photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <div className="aspect-square bg-slate-800 rounded-xl overflow-hidden">
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <Camera className="w-8 h-8" />
                      </div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-slate-900/90">
                      <p className="text-xs text-white font-medium capitalize">{photo.type}</p>
                      <p className="text-xs text-slate-500 truncate">{photo.caption}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No photos uploaded</p>
            )}
          </Card>

          {/* Notes */}
          {commission.notes && (
            <Card>
              <h3 className="section-title flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary-400" />
                Installer Notes
              </h3>
              <p className="text-slate-300">{commission.notes}</p>
            </Card>
          )}
        </div>

        {/* Right Column - Checklist */}
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title mb-0">Checklist</h3>
              {allChecklistComplete ? (
                <Badge variant="success">Complete</Badge>
              ) : (
                <Badge variant="warning">Incomplete</Badge>
              )}
            </div>
            <div className="space-y-3">
              {checklistItems.map((item) => {
                const isChecked = commission.checklist[item.key];
                return (
                  <div
                    key={item.key}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      isChecked ? 'bg-success-500/10' : 'bg-slate-800/50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      isChecked ? 'bg-success-500 text-white' : 'bg-slate-700'
                    }`}>
                      {isChecked && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <span className={`text-sm ${isChecked ? 'text-white' : 'text-slate-500'}`}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Submission Timeline */}
          <Card>
            <h3 className="section-title">Timeline</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-primary-500 mt-1.5" />
                <div>
                  <p className="text-sm font-medium text-white">Submitted</p>
                  <p className="text-xs text-slate-500">
                    {format(new Date(commission.submittedAt), 'dd MMM yyyy, HH:mm')}
                  </p>
                </div>
              </div>
              {commission.reviewedAt && (
                <div className="flex items-start gap-3">
                  <div className={`w-3 h-3 rounded-full mt-1.5 ${
                    commission.status === 'approved' ? 'bg-success-500' :
                    commission.status === 'rejected' ? 'bg-red-500' :
                    'bg-warning-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-white capitalize">
                      {commission.status.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(commission.reviewedAt), 'dd MMM yyyy, HH:mm')}
                    </p>
                    {commission.assessorName && (
                      <p className="text-xs text-slate-500">by {commission.assessorName}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Submission"
        size="sm"
      >
        <p className="text-slate-300 mb-6">
          Are you sure you want to approve this submission? A certificate will be generated
          automatically.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setShowApproveModal(false)}>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleApprove}
            isLoading={isProcessing}
          >
            Approve & Generate Certificate
          </Button>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Submission"
        size="md"
      >
        <p className="text-slate-300 mb-4">
          Please provide a reason for rejecting this submission. This will be sent to the installer.
        </p>
        <Input
          label="Rejection Reason"
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="e.g., Photos are unclear, missing labeling verification..."
        />
        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleReject}
            isLoading={isProcessing}
            disabled={!rejectionReason.trim()}
          >
            Reject Submission
          </Button>
        </div>
      </Modal>
    </div>
  );
}

