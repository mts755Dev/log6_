import { useRef, useState } from 'react';
import { Upload, X, FileText, CheckCircle, Plus, Loader2, Image as ImageIcon, ChevronDown, Eye, Sparkles } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface DocumentGroup {
  files: File[];
  issuedDate: string;
  expiryDate: string;
  referenceNumber: string;
  providerName: string;
  scanStatus?: 'idle' | 'scanning' | 'done' | 'error';
  scannedFields?: Partial<{
    issuedDate: string;
    expiryDate: string;
    referenceNumber: string;
    providerName: string;
    holderName: string;
    qualificationType: string;
    organizationName: string;
    cardNumber: string;
    policyNumber: string;
    membershipId: string;
  }>;
  rawText?: string;
  confidence?: number;
}

interface MultiFileUploadProps {
  label: string;
  name: string;
  accept?: string;
  required?: boolean;
  groups: DocumentGroup[];
  onChange: (groups: DocumentGroup[]) => void;
  onScanFile?: (file: File, groupIndex: number) => void;
  showDates?: boolean;
  showReference?: boolean;
  showProvider?: boolean;
  hint?: string;
  maxGroups?: number;
  groupLabel?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(file: File) {
  if (file.type.startsWith('image/')) {
    return <ImageIcon className="w-4 h-4 text-blue-400" />;
  }
  return <FileText className="w-4 h-4 text-primary-400" />;
}

export function MultiFileUpload({
  label,
  name,
  accept = '.pdf,.jpg,.jpeg,.png',
  required = false,
  groups,
  onChange,
  onScanFile,
  showDates = false,
  showReference = false,
  showProvider = false,
  hint,
  maxGroups = 10,
  groupLabel = 'document',
}: MultiFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState<number | null>(null);
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
  const [showRawText, setShowRawText] = useState<number | null>(null);

  const handleAddGroup = () => {
    if (groups.length >= maxGroups) return;
    onChange([
      ...groups,
      { files: [], issuedDate: '', expiryDate: '', referenceNumber: '', providerName: '', scanStatus: 'idle' },
    ]);
  };

  const handleRemoveGroup = (index: number) => {
    onChange(groups.filter((_, i) => i !== index));
  };

  const handleFilesAdded = (newFiles: FileList | File[], groupIndex: number) => {
    const filesArray = Array.from(newFiles);
    const updated = [...groups];
    updated[groupIndex] = {
      ...updated[groupIndex],
      files: [...updated[groupIndex].files, ...filesArray],
    };
    onChange(updated);

    if (onScanFile) {
      filesArray.forEach(f => onScanFile(f, groupIndex));
    }
  };

  const handleRemoveFile = (groupIndex: number, fileIndex: number) => {
    const updated = [...groups];
    updated[groupIndex] = {
      ...updated[groupIndex],
      files: updated[groupIndex].files.filter((_, i) => i !== fileIndex),
    };
    onChange(updated);
  };

  const handleFieldChange = (groupIndex: number, field: keyof DocumentGroup, value: string) => {
    const updated = [...groups];
    updated[groupIndex] = { ...updated[groupIndex], [field]: value };
    onChange(updated);
  };

  const handleDragOver = (e: React.DragEvent, groupIndex: number) => {
    e.preventDefault();
    setIsDragging(groupIndex);
  };

  const handleDragLeave = () => {
    setIsDragging(null);
  };

  const handleDrop = (e: React.DragEvent, groupIndex: number) => {
    e.preventDefault();
    setIsDragging(null);
    if (e.dataTransfer.files?.length) {
      handleFilesAdded(e.dataTransfer.files, groupIndex);
    }
  };

  const handleUploadClick = (groupIndex: number) => {
    setActiveGroupIndex(groupIndex);
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeGroupIndex === null || !e.target.files?.length) return;
    handleFilesAdded(e.target.files, activeGroupIndex);
    e.target.value = '';
    setActiveGroupIndex(null);
  };

  const ensureAtLeastOneGroup = () => {
    if (groups.length === 0) {
      handleAddGroup();
    }
  };

  if (groups.length === 0) {
    ensureAtLeastOneGroup();
    return null;
  }

  const countExtractedFields = (fields?: DocumentGroup['scannedFields']) => {
    if (!fields) return 0;
    return Object.values(fields).filter(Boolean).length;
  };

  return (
    <div className="w-full space-y-3">
      {label && (
        <label className="label mb-1">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}

      <input
        ref={fileInputRef}
        type="file"
        name={name}
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
        multiple
      />

      {groups.map((group, gi) => {
        const extractedCount = countExtractedFields(group.scannedFields);
        const isShowingRaw = showRawText === gi;

        return (
          <div key={gi} className="border border-slate-700/50 rounded-xl bg-slate-800/20 overflow-hidden">
            {/* Group header */}
            {groups.length > 1 && (
              <div className="flex items-center justify-between px-3 py-2 bg-slate-800/40 border-b border-slate-700/30">
                <span className="text-xs text-slate-400 font-medium">
                  {groupLabel} {gi + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveGroup(gi)}
                  className="p-0.5 hover:bg-slate-700 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            )}

            <div className="p-3 space-y-3">
              {/* File list */}
              {group.files.length > 0 && (
                <div className="space-y-1.5">
                  {group.files.map((file, fi) => (
                    <div key={fi} className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-2.5 py-1.5">
                      <div className="flex-shrink-0">{getFileIcon(file)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-300 font-medium truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-500">{formatFileSize(file.size)}</p>
                      </div>
                      <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(gi, fi)}
                        className="p-0.5 hover:bg-slate-700 rounded transition-colors flex-shrink-0"
                      >
                        <X className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Drop zone */}
              <div
                onClick={() => handleUploadClick(gi)}
                onDragOver={(e) => handleDragOver(e, gi)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, gi)}
                className={cn(
                  'border-2 border-dashed rounded-lg p-4 transition-all cursor-pointer text-center',
                  isDragging === gi
                    ? 'border-primary-500 bg-primary-500/5'
                    : 'border-slate-700/50 hover:border-slate-600',
                )}
              >
                <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                <p className="text-xs text-slate-300">
                  <span className="text-primary-400 font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {hint || 'PDF, PNG, JPG up to 10MB — multiple files allowed'}
                </p>
              </div>

              {/* Scan status */}
              {group.scanStatus === 'scanning' && (
                <div className="flex items-center gap-2 text-xs text-primary-400 bg-primary-500/5 border border-primary-500/20 rounded-lg px-3 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                  <span>Scanning document for dates, references, and provider info...</span>
                </div>
              )}

              {group.scanStatus === 'error' && (
                <div className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                  Could not scan this document. Please fill in the fields manually.
                </div>
              )}

              {/* Extraction results summary */}
              {group.scanStatus === 'done' && extractedCount > 0 && (
                <div className="bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-green-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="font-medium">
                        {extractedCount} field{extractedCount !== 1 ? 's' : ''} auto-detected
                        {group.confidence ? ` (${group.confidence}% confidence)` : ''}
                      </span>
                    </div>
                    {group.rawText && (
                      <button
                        type="button"
                        onClick={() => setShowRawText(isShowingRaw ? null : gi)}
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-300 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        {isShowingRaw ? 'Hide' : 'View'} raw text
                      </button>
                    )}
                  </div>

                  {/* Extracted fields summary chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {group.scannedFields?.holderName && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-300 rounded">
                        Name: {group.scannedFields.holderName}
                      </span>
                    )}
                    {group.scannedFields?.qualificationType && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-300 rounded">
                        Qual: {group.scannedFields.qualificationType}
                      </span>
                    )}
                    {group.scannedFields?.organizationName && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-300 rounded">
                        Org: {group.scannedFields.organizationName}
                      </span>
                    )}
                    {group.scannedFields?.cardNumber && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/10 text-cyan-300 rounded">
                        Card: {group.scannedFields.cardNumber}
                      </span>
                    )}
                    {group.scannedFields?.policyNumber && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-300 rounded">
                        Policy: {group.scannedFields.policyNumber}
                      </span>
                    )}
                    {group.scannedFields?.membershipId && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/10 text-orange-300 rounded">
                        Member: {group.scannedFields.membershipId}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {group.scanStatus === 'done' && extractedCount === 0 && (
                <div className="text-xs text-slate-400 bg-slate-800/30 border border-slate-700/30 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span>No fields auto-detected. Please fill in manually.</span>
                  {group.rawText && (
                    <button
                      type="button"
                      onClick={() => setShowRawText(isShowingRaw ? null : gi)}
                      className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-300 transition-colors ml-2 flex-shrink-0"
                    >
                      <Eye className="w-3 h-3" />
                      {isShowingRaw ? 'Hide' : 'View'} raw text
                    </button>
                  )}
                </div>
              )}

              {/* Raw text preview */}
              {isShowingRaw && group.rawText && (
                <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-2.5 max-h-32 overflow-y-auto custom-scrollbar">
                  <p className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap break-all leading-relaxed">
                    {group.rawText}
                  </p>
                </div>
              )}

              {/* Metadata fields */}
              {(showDates || showReference || showProvider) && group.files.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {showDates && (
                    <>
                      <div>
                        <label className="text-[10px] text-slate-400 mb-0.5 block">Issued Date</label>
                        <input
                          type="date"
                          value={group.issuedDate}
                          onChange={(e) => handleFieldChange(gi, 'issuedDate', e.target.value)}
                          className={cn(
                            'w-full bg-slate-800 border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500',
                            group.scannedFields?.issuedDate ? 'border-green-500/40' : 'border-slate-700'
                          )}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 mb-0.5 block">Expiry Date</label>
                        <input
                          type="date"
                          value={group.expiryDate}
                          onChange={(e) => handleFieldChange(gi, 'expiryDate', e.target.value)}
                          className={cn(
                            'w-full bg-slate-800 border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500',
                            group.scannedFields?.expiryDate ? 'border-green-500/40' : 'border-slate-700'
                          )}
                        />
                      </div>
                    </>
                  )}
                  {showReference && (
                    <div className={showProvider ? '' : 'col-span-2'}>
                      <label className="text-[10px] text-slate-400 mb-0.5 block">Reference No.</label>
                      <input
                        type="text"
                        value={group.referenceNumber}
                        onChange={(e) => handleFieldChange(gi, 'referenceNumber', e.target.value)}
                        placeholder="e.g. MCS 12345"
                        className={cn(
                          'w-full bg-slate-800 border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-500',
                          group.scannedFields?.referenceNumber ? 'border-green-500/40' : 'border-slate-700'
                        )}
                      />
                    </div>
                  )}
                  {showProvider && (
                    <div className={showReference ? '' : 'col-span-2'}>
                      <label className="text-[10px] text-slate-400 mb-0.5 block">Provider</label>
                      <input
                        type="text"
                        value={group.providerName}
                        onChange={(e) => handleFieldChange(gi, 'providerName', e.target.value)}
                        placeholder="e.g. NICEIC"
                        className={cn(
                          'w-full bg-slate-800 border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-500',
                          group.scannedFields?.providerName ? 'border-green-500/40' : 'border-slate-700'
                        )}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Add another group */}
      {groups.length < maxGroups && (
        <button
          type="button"
          onClick={handleAddGroup}
          className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 transition-colors py-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Add another {groupLabel}
        </button>
      )}
    </div>
  );
}
