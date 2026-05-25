import { useState, useCallback } from 'react';
import { Upload, X, FileText, Loader2, Sparkles, Eye } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useToast } from '../../contexts/ToastContext';
import { scanDocument } from '../../utils/documentScanner';
import { cn } from '../../utils/cn';
import type { OnboardingDocumentType } from '../../types';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: OnboardingDocumentType;
  documentLabel: string;
  showDates?: boolean;
  showReference?: boolean;
  showProvider?: boolean;
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

type ScanStatus = 'idle' | 'scanning' | 'done' | 'error';

type ScannedFields = Partial<{
  issuedDate: string;
  expiryDate: string;
  referenceNumber: string;
  providerName: string;
}>;

export function DocumentUploadModal({
  isOpen,
  onClose,
  documentType,
  documentLabel,
  showDates = true,
  showReference = true,
  showProvider = true,
  onUpload,
}: DocumentUploadModalProps) {
  const toast = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [issuedDate, setIssuedDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [providerName, setProviderName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scannedFields, setScannedFields] = useState<ScannedFields>({});
  const [scanConfidence, setScanConfidence] = useState<number | undefined>();
  const [showRawText, setShowRawText] = useState(false);
  const [rawText, setRawText] = useState('');

  const runDocumentScan = useCallback(async (file: File) => {
    setScanStatus('scanning');
    setScannedFields({});
    setScanConfidence(undefined);
    setRawText('');

    try {
      const result = await scanDocument(file);
      const detected: ScannedFields = {};

      if (result.issuedDate && showDates) {
        setIssuedDate(result.issuedDate);
        detected.issuedDate = result.issuedDate;
      }
      if (result.expiryDate && showDates) {
        setExpiryDate(result.expiryDate);
        detected.expiryDate = result.expiryDate;
      }
      if (result.referenceNumber && showReference) {
        setReferenceNumber(result.referenceNumber);
        detected.referenceNumber = result.referenceNumber;
      }
      if (result.providerName && showProvider) {
        setProviderName(result.providerName);
        detected.providerName = result.providerName;
      }

      setScannedFields(detected);
      setScanConfidence(result.confidence);
      setRawText(result.rawText);
      setScanStatus('done');
    } catch {
      setScanStatus('error');
    }
  }, [showDates, showReference, showProvider]);

  const applyFile = (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Please upload a PDF or image file');
      return;
    }
    setSelectedFile(file);
    void runDocumentScan(file);
  };

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
    if (files.length > 0) applyFile(files[0]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyFile(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
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
    setScanStatus('idle');
    setScannedFields({});
    setScanConfidence(undefined);
    setShowRawText(false);
    setRawText('');
    onClose();
  };

  const extractedCount = Object.keys(scannedFields).length;
  const showMetadata = selectedFile && (showDates || showReference || showProvider);

  const dateInputClass = (autoDetected?: string) =>
    cn(
      'w-full bg-slate-800 border rounded-lg px-2.5 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 [color-scheme:dark]',
      autoDetected ? 'border-green-500/40' : 'border-slate-700',
    );

  const textInputClass = (autoDetected?: string) =>
    cn(
      'w-full bg-slate-800 border rounded-lg px-2.5 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-500',
      autoDetected ? 'border-green-500/40' : 'border-slate-700',
    );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Upload ${documentLabel}`}>
      <div className="space-y-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors',
            isDragging ? 'border-primary-500 bg-primary-500/10' : 'border-slate-700 hover:border-slate-600',
          )}
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
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setScanStatus('idle');
                    setScannedFields({});
                    setIssuedDate('');
                    setExpiryDate('');
                    setReferenceNumber('');
                    setProviderName('');
                  }}
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
              <label htmlFor="file-upload" className="inline-block cursor-pointer">
                <span className="inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium text-sm bg-slate-700 hover:bg-slate-600 text-white transition-colors">
                  Browse Files
                </span>
              </label>
              <p className="text-xs text-slate-500 mt-4">Supported formats: PDF, JPG, PNG (Max 10MB)</p>
            </div>
          )}
        </div>

        {selectedFile && scanStatus === 'scanning' && (
          <div className="flex items-center gap-2 text-xs text-primary-400 bg-primary-500/5 border border-primary-500/20 rounded-lg px-3 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
            <span>Scanning document for dates, references, and provider info...</span>
          </div>
        )}

        {selectedFile && scanStatus === 'error' && (
          <div className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
            Could not scan this document. Please fill in the fields manually.
          </div>
        )}

        {selectedFile && scanStatus === 'done' && extractedCount > 0 && (
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="font-medium">
                  {extractedCount} field{extractedCount !== 1 ? 's' : ''} auto-detected
                  {scanConfidence ? ` (${scanConfidence}% confidence)` : ''}
                </span>
              </div>
              {rawText && (
                <button
                  type="button"
                  onClick={() => setShowRawText((v) => !v)}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-300 transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  {showRawText ? 'Hide' : 'View'} raw text
                </button>
              )}
            </div>
          </div>
        )}

        {selectedFile && scanStatus === 'done' && extractedCount === 0 && (
          <div className="text-xs text-slate-400 bg-slate-800/30 border border-slate-700/30 rounded-lg px-3 py-2">
            No fields auto-detected. Please fill in the date fields manually.
          </div>
        )}

        {showRawText && rawText && (
          <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-2.5 max-h-32 overflow-y-auto custom-scrollbar">
            <p className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap break-all leading-relaxed">
              {rawText}
            </p>
          </div>
        )}

        {showMetadata && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {showDates && (
              <>
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">Issued Date</label>
                  <input
                    type="date"
                    value={issuedDate}
                    onChange={(e) => setIssuedDate(e.target.value)}
                    className={dateInputClass(scannedFields.issuedDate)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">
                    Expiry Date (if applicable)
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className={dateInputClass(scannedFields.expiryDate)}
                  />
                </div>
              </>
            )}
            {showReference && (
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Reference Number</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g., MCS-12345"
                  className={textInputClass(scannedFields.referenceNumber)}
                />
              </div>
            )}
            {showProvider && (
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Provider/Issuer</label>
                <input
                  type="text"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder="e.g., NICEIC, MCS"
                  className={textInputClass(scannedFields.providerName)}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-4">
          <Button variant="secondary" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isUploading}
            disabled={!selectedFile || isUploading || scanStatus === 'scanning'}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Upload Document
          </Button>
        </div>
      </div>
    </Modal>
  );
}
