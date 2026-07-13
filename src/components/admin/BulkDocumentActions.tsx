import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Download, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import type { InstallerOnboardingDoc } from '../../types';

interface BulkDocumentActionsProps {
  selectedDocuments: InstallerOnboardingDoc[];
  onAction: () => void;
  onClearSelection: () => void;
}

export function BulkDocumentActions({
  selectedDocuments,
  onAction,
  onClearSelection,
}: BulkDocumentActionsProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | 'download' | 'delete' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const openConfirmModal = (action: 'approve' | 'reject' | 'download' | 'delete') => {
    setBulkAction(action);
    setIsConfirmModalOpen(true);
  };

  const handleBulkApprove = async () => {
    if (!user) return;

    try {
      setIsProcessing(true);
      
      console.log('🔧 Bulk approve starting...');
      console.log('📋 Selected documents:', selectedDocuments.map(d => ({ id: d.id, type: d.documentType })));
      console.log('👤 Reviewer ID:', user.id);
      
      const updates = selectedDocuments.map(async (doc) => {
        console.log(`📤 Updating document ${doc.id}...`);
        
        const { data, error } = await supabase
          .from('installer_onboarding_docs')
          .update({
            status: 'approved',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', doc.id)
          .select();
        
        if (error) {
          console.error(`❌ Failed to update ${doc.id}:`, error);
          throw error;
        }
        
        console.log(`✅ Updated ${doc.id}:`, data);
        return data;
      });

      const results = await Promise.all(updates);
      console.log('✅ All updates completed:', results);
      
      toast.success(`${selectedDocuments.length} documents approved`);
      onAction();
      onClearSelection();
      setIsConfirmModalOpen(false);
    } catch (error: any) {
      console.error('❌ Bulk approve error:', error);
      toast.error('Failed to approve documents');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (!user || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setIsProcessing(true);
      
      console.log('🔧 Bulk reject starting...');
      console.log('📋 Selected documents:', selectedDocuments.map(d => ({ id: d.id, type: d.documentType })));
      console.log('👤 Reviewer ID:', user.id);
      console.log('📝 Rejection reason:', rejectionReason);
      
      const updates = selectedDocuments.map(async (doc) => {
        console.log(`📤 Rejecting document ${doc.id}...`);
        
        const { data, error } = await supabase
          .from('installer_onboarding_docs')
          .update({
            status: 'rejected',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            rejection_reason: rejectionReason,
          })
          .eq('id', doc.id)
          .select();
        
        if (error) {
          console.error(`❌ Failed to reject ${doc.id}:`, error);
          throw error;
        }
        
        console.log(`✅ Rejected ${doc.id}:`, data);
        return data;
      });

      const results = await Promise.all(updates);
      console.log('✅ All updates completed:', results);
      
      toast.success(`${selectedDocuments.length} documents rejected`);
      onAction();
      onClearSelection();
      setIsConfirmModalOpen(false);
      setRejectionReason('');
    } catch (error: any) {
      console.error('❌ Bulk reject error:', error);
      toast.error('Failed to reject documents');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDownload = async () => {
    try {
      setIsProcessing(true);
      
      // Download all documents
      for (const doc of selectedDocuments) {
        // Create a temporary anchor element to trigger download
        const link = document.createElement('a');
        link.href = doc.fileUrl;
        link.download = doc.fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Small delay between downloads to avoid blocking
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast.success(`Downloading ${selectedDocuments.length} documents`);
      setIsConfirmModalOpen(false);
    } catch (error: any) {
      console.error('Bulk download error:', error);
      toast.error('Failed to download documents');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkAction = async () => {
    switch (bulkAction) {
      case 'approve':
        await handleBulkApprove();
        break;
      case 'reject':
        await handleBulkReject();
        break;
      case 'download':
        await handleBulkDownload();
        break;
      default:
        break;
    }
  };

  if (selectedDocuments.length === 0) {
    return null;
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
      >
        <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-4 flex items-center gap-4">
          <div className="flex items-center gap-2 px-3">
            <CheckCircle className="w-5 h-5 text-primary-400" />
            <span className="text-white font-semibold">
              {selectedDocuments.length} document{selectedDocuments.length !== 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="h-8 w-px bg-slate-700" />

          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<CheckCircle className="w-4 h-4" />}
              onClick={() => openConfirmModal('approve')}
            >
              Approve All
            </Button>

            <Button
              variant="danger"
              size="sm"
              leftIcon={<XCircle className="w-4 h-4" />}
              onClick={() => openConfirmModal('reject')}
            >
              Reject All
            </Button>

            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={() => openConfirmModal('download')}
            >
              Download All
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={onClearSelection}
            >
              Clear
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title={`Bulk ${bulkAction?.charAt(0).toUpperCase()}${bulkAction?.slice(1)} Documents`}
      >
        <div className="space-y-4">
          <p className="text-slate-300">
            You are about to {bulkAction} <strong>{selectedDocuments.length}</strong> document
            {selectedDocuments.length !== 1 ? 's' : ''}:
          </p>

          <div className="bg-slate-800/50 rounded-lg p-4 max-h-48 overflow-y-auto">
            <ul className="space-y-2">
              {selectedDocuments.map((doc) => (
                <li key={doc.id} className="text-sm text-slate-400">
                  • {doc.documentType.replace(/_/g, ' ')} - {doc.fileName}
                </li>
              ))}
            </ul>
          </div>

          {bulkAction === 'reject' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Rejection Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 transition-colors resize-none"
                rows={4}
                placeholder="Explain why these documents are being rejected..."
              />
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="secondary"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant={bulkAction === 'approve' ? 'primary' : bulkAction === 'reject' ? 'danger' : 'secondary'}
              onClick={handleBulkAction}
              isLoading={isProcessing}
            >
              Confirm {bulkAction?.charAt(0).toUpperCase()}{bulkAction?.slice(1)}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
