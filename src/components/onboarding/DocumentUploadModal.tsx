import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, X, Calendar, FileText } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import type { OnboardingDocumentType } from '../../types';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: OnboardingDocumentType;
  documentLabel: string;
  onUpload: (
    type: OnboardingDocumentType,
    file: File,
    metadata: {
      issuedDate?: string;
      expiryDate?: string;
      referenceNumber?: string;
      providerName?: string;
    }
  ) => Promise<void>;
}

export function DocumentUploadModal({
  isOpen,
  onClose,
  documentType,
  documentLabel,
  onUpload,
}: DocumentUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [issuedDate, setIssuedDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [providerName, setProviderName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        alert('Please upload a PDF or image file');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      alert('Please select a file');
      return;
    }

    try {
      setIsUploading(true);
      await onUpload(documentType, selectedFile, {
        issuedDate: issuedDate || undefined,
        expiryDate: expiryDate || undefined,
        referenceNumber: referenceNumber || undefined,
        providerName: providerName || undefined,
      });
      handleClose();
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setIssuedDate('');
    setExpiryDate('');
    setReferenceNumber('');
    setProviderName('');
    setIsUploading(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Upload ${documentLabel}`}>
      <div className="space-y-6">
        {/* File Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-primary-500 bg-primary-500/10'
              : 'border-slate-700 hover:border-slate-600'
          }`}
        >
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept="image/*,application/pdf"
            onChange={handleFileSelect}
          />

          {selectedFile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-10 h-10 text-primary-400" />
                <div className="text-left">
                  <p className="text-white font-semibold">{selectedFile.name}</p>
                  <p className="text-sm text-slate-400">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="ml-auto p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <Upload className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-white mb-2">Drag & drop your file here</p>
              <p className="text-sm text-slate-400 mb-4">or</p>
              <label 
                htmlFor="file-upload"
                className="inline-block cursor-pointer"
              >
                <span className="inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium text-sm bg-slate-700 hover:bg-slate-600 text-white transition-colors">
                  Browse Files
                </span>
              </label>
              <p className="text-xs text-slate-500 mt-4">
                Supported formats: PDF, JPG, PNG (Max 10MB)
              </p>
            </div>
          )}
        </div>

        {/* Metadata Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Issued Date
            </label>
            <Input
              type="date"
              value={issuedDate}
              onChange={(e) => setIssuedDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Expiry Date (if applicable)
            </label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Reference Number
            </label>
            <Input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g., MCS-12345"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Provider/Issuer
            </label>
            <Input
              type="text"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder="e.g., NICEIC, MCS"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4">
          <Button variant="secondary" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isUploading}
            disabled={!selectedFile || isUploading}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Upload Document
          </Button>
        </div>
      </div>
    </Modal>
  );
}
