import { useRef, useState } from 'react';
import { Upload, X, FileText, CheckCircle, Calendar } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Input } from './Input';

interface FileUploadWithDatesProps {
  label: string;
  name: string;
  accept?: string;
  required?: boolean;
  onChange: (data: { file: File | null; issuedDate: string; expiryDate: string }) => void;
  value?: { file: File | null; issuedDate: string; expiryDate: string };
  hint?: string;
}

export function FileUploadWithDates({ 
  label, 
  name, 
  accept = '.pdf,.jpg,.jpeg,.png', 
  required = false,
  onChange,
  value,
  hint
}: FileUploadWithDatesProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localFile, setLocalFile] = useState<File | null>(value?.file || null);
  const [issuedDate, setIssuedDate] = useState(value?.issuedDate || '');
  const [expiryDate, setExpiryDate] = useState(value?.expiryDate || '');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setLocalFile(file);
    onChange({ file, issuedDate, expiryDate });
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
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setLocalFile(file);
      onChange({ file, issuedDate, expiryDate });
    }
  };

  const handleRemove = () => {
    setLocalFile(null);
    setIssuedDate('');
    setExpiryDate('');
    onChange({ file: null, issuedDate: '', expiryDate: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleIssuedDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setIssuedDate(newDate);
    onChange({ file: localFile, issuedDate: newDate, expiryDate });
  };

  const handleExpiryDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setExpiryDate(newDate);
    onChange({ file: localFile, issuedDate, expiryDate: newDate });
  };

  return (
    <div className="w-full space-y-4">
      <label className="label mb-2">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      
      {/* File Upload Section */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer',
          isDragging 
            ? 'border-primary-500 bg-primary-500/5' 
            : 'border-slate-700 hover:border-slate-600',
          localFile && 'bg-slate-800/50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          name={name}
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          required={required && !localFile}
        />

        {!localFile ? (
          <div className="flex flex-col items-center text-center">
            <Upload className="w-8 h-8 text-slate-400 mb-3" />
            <p className="text-sm text-slate-300 mb-1">
              <span className="text-primary-400 font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-slate-500">
              {hint || 'PDF, PNG, JPG up to 10MB'}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-500/10 rounded-lg">
                <FileText className="w-5 h-5 text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 font-medium truncate">
                  {localFile.name}
                </p>
                <p className="text-xs text-slate-500">
                  {(localFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              className="ml-3 p-1 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        )}
      </div>

      {/* Date Fields - Only show when file is uploaded */}
      {localFile && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <Input
            label="Issued Date"
            type="date"
            value={issuedDate}
            onChange={handleIssuedDateChange}
            leftIcon={<Calendar className="w-4 h-4" />}
            required={required}
          />
          <Input
            label="Expiry Date"
            type="date"
            value={expiryDate}
            onChange={handleExpiryDateChange}
            leftIcon={<Calendar className="w-4 h-4" />}
            required={required}
          />
        </div>
      )}
    </div>
  );
}

