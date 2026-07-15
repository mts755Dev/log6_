import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  FileText,
  Trash2,
  Eye,
  Plus,
  Search,
  FileType,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal, TypeConfirmModal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { compressForUpload } from '../../lib/compressUpload';
import {
  DOCUMENT_APPLIES_TO,
  DOCUMENT_APPLIES_TO_LABELS,
  fetchDocumentAppliesToMap,
  type DocumentAppliesTo,
} from '../../lib/documentProductLinks';
import type { Document as DocumentType, DocumentBankCategory, ConsumerCode } from '../../types';
import { DOCUMENT_BANK_CATEGORIES, CONSUMER_CODE_LABELS } from '../../types';

const CATEGORY_LABELS: Record<DocumentBankCategory, string> = {
  consumer_code_leaflet: 'Consumer leaflet',
  product_datasheet: 'Product datasheet',
  user_manual: 'User manual',
};

const CATEGORY_BADGES: Record<DocumentBankCategory, string> = {
  consumer_code_leaflet: 'bg-blue-500/20 text-blue-400',
  product_datasheet: 'bg-green-500/20 text-green-400',
  user_manual: 'bg-purple-500/20 text-purple-400',
};

const APPLIES_TO_BADGES: Record<DocumentAppliesTo, string> = {
  general: 'bg-emerald-500/20 text-emerald-300',
  battery: 'bg-amber-500/20 text-amber-300',
  inverter: 'bg-cyan-500/20 text-cyan-300',
  heat_pump: 'bg-orange-500/20 text-orange-300',
  cylinder: 'bg-sky-500/20 text-sky-300',
  radiator: 'bg-rose-500/20 text-rose-300',
};

const CONSUMER_CODES = Object.keys(CONSUMER_CODE_LABELS) as ConsumerCode[];

export function DocumentBankPage() {
  const toast = useToast();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [appliesToByDocId, setAppliesToByDocId] = useState<Map<string, DocumentAppliesTo[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [documentToReplace, setDocumentToReplace] = useState<DocumentType | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<DocumentBankCategory | 'all'>('all');
  const [filterProductType, setFilterProductType] = useState<DocumentAppliesTo | 'all' | 'unassigned'>('all');

  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    category: 'product_datasheet' as DocumentBankCategory,
    productType: '' as '' | DocumentAppliesTo,
    consumerCode: '' as '' | ConsumerCode,
    file: null as File | null,
  });

  const isReplaceMode = Boolean(documentToReplace);
  useEffect(() => {
    fetchDocuments();
  }, [filterCategory]);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('documents')
        .select('*')
        .in('category', [...DOCUMENT_BANK_CATEGORIES])
        .order('created_at', { ascending: false });

      if (filterCategory !== 'all') {
        query = query.eq('category', filterCategory);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mappedData = (data || []).map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        description: doc.description,
        category: doc.category,
        fileUrl: doc.file_url,
        fileName: doc.file_name,
        fileSize: doc.file_size,
        mimeType: doc.mime_type,
        insuranceProvider: doc.insurance_provider,
        productId: doc.product_id,
        productType: doc.product_type,
        consumerCode: doc.consumer_code,
        version: doc.version,
        uploadedBy: doc.uploaded_by,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }));

      setDocuments(mappedData);
      const appliesMap = await fetchDocumentAppliesToMap(mappedData);
      setAppliesToByDocId(appliesMap);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size must be less than 25MB (will be compressed before upload)');
      return;
    }

    try {
      const { file: compressed } = await compressForUpload(file);
      if (compressed.size > 10 * 1024 * 1024) {
        toast.error('File is still larger than 10MB after compression');
        return;
      }
      setUploadForm({ ...uploadForm, file: compressed });
    } catch {
      toast.error('Failed to prepare file for upload');
    }
  };

  const resetUploadForm = () => {
    setUploadForm({
      name: '',
      description: '',
      category: 'product_datasheet',
      productType: '',
      consumerCode: '',
      file: null,
    });
  };

  const closeDocumentModal = () => {
    setShowUploadModal(false);
    setDocumentToReplace(null);
    resetUploadForm();
  };

  const openReplaceModal = (doc: DocumentType) => {
    setDocumentToReplace(doc);
    const linked = appliesToByDocId.get(doc.id)?.[0];
    const isLeaflet = doc.category === 'consumer_code_leaflet';
    setUploadForm({
      name: doc.name,
      description: doc.description || '',
      category: (doc.category as DocumentBankCategory) || 'product_datasheet',
      productType: isLeaflet
        ? 'general'
        : (doc.productType as DocumentAppliesTo) || linked || '',
      consumerCode: (doc.consumerCode as ConsumerCode) || '',
      file: null,
    });
    setShowUploadModal(true);
  };

  const getStoragePathFromUrl = (fileUrl: string) => {
    const marker = '/storage/v1/object/public/documents/';
    const publicIndex = fileUrl.indexOf(marker);
    if (publicIndex !== -1) {
      return decodeURIComponent(fileUrl.slice(publicIndex + marker.length));
    }

    const legacyIndex = fileUrl.indexOf('/documents/');
    if (legacyIndex !== -1) {
      return `documents/${fileUrl.slice(legacyIndex + '/documents/'.length)}`;
    }

    return null;
  };

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.name) {
      toast.error('Please provide a document name and select a file');
      return;
    }

    const isLeaflet = uploadForm.category === 'consumer_code_leaflet';
    if (isLeaflet && !uploadForm.consumerCode) {
      toast.error('Select which consumer code this leaflet belongs to');
      return;
    }

    const resolvedProductType: DocumentAppliesTo | null = isLeaflet
      ? 'general'
      : uploadForm.productType || null;

    setUploading(true);

    try {
      const fileExt = uploadForm.file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `documents/${uploadForm.category}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, uploadForm.file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const payload = {
        name: uploadForm.name,
        description: uploadForm.description || null,
        category: uploadForm.category,
        product_type: resolvedProductType,
        consumer_code: isLeaflet ? uploadForm.consumerCode : null,
        file_url: publicUrl,
        file_name: uploadForm.file.name,
        file_size: uploadForm.file.size,
        mime_type: uploadForm.file.type,
      };

      if (documentToReplace) {
        const previousPath = getStoragePathFromUrl(documentToReplace.fileUrl);
        const nextVersion = (documentToReplace.version || 1) + 1;

        const { data, error: dbError } = await supabase
          .from('documents')
          .update({
            ...payload,
            version: nextVersion,
            updated_at: new Date().toISOString(),
          })
          .eq('id', documentToReplace.id)
          .select('id');

        if (dbError) throw dbError;
        if (!data?.length) {
          throw new Error('Document could not be replaced. Check admin permissions.');
        }

        if (previousPath && previousPath !== filePath) {
          const { error: storageError } = await supabase.storage
            .from('documents')
            .remove([previousPath]);
          if (storageError) {
            console.warn('Document replaced but old storage file cleanup failed:', storageError);
          }
        }

        toast.success('Document replaced successfully!');
      } else {
        const { error: dbError } = await supabase.from('documents').insert(payload);

        if (dbError) throw dbError;
        toast.success('Document uploaded successfully!');
      }

      closeDocumentModal();
      fetchDocuments();
    } catch (error: any) {
      console.error('Error saving document:', error);
      toast.error(error.message || (isReplaceMode ? 'Failed to replace document' : 'Failed to upload document'));
    } finally {
      setUploading(false);
    }
  };
  const handleDelete = async () => {
    if (!documentToDelete) return;

    const { id, fileUrl } = documentToDelete;

    try {
      setIsDeleting(true);

      const { data, error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)
        .select('id');

      if (error) throw error;

      if (!data?.length) {
        throw new Error('Document could not be deleted. Check admin permissions.');
      }

      const storagePath = getStoragePathFromUrl(fileUrl);
      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([storagePath]);

        if (storageError) {
          console.warn('Document record deleted but storage file cleanup failed:', storageError);
        }
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      toast.success('Document deleted successfully');
      await fetchDocuments();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast.error(error?.message || 'Failed to delete document');
    } finally {
      setIsDeleting(false);
      setDocumentToDelete(null);
    }
  };

  const handleView = (doc: DocumentType) => {
    if (!doc.fileUrl) {
      toast.error('File URL not available');
      return;
    }
    window.open(doc.fileUrl, '_blank', 'noopener,noreferrer');
  };

  const getAppliesTo = (doc: DocumentType): DocumentAppliesTo[] =>
    appliesToByDocId.get(doc.id) || [];

  const filteredDocuments = documents.filter((doc) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      doc.name.toLowerCase().includes(q) ||
      doc.description?.toLowerCase().includes(q) ||
      getAppliesTo(doc).some((t) => DOCUMENT_APPLIES_TO_LABELS[t].toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (filterProductType === 'unassigned') return getAppliesTo(doc).length === 0;
    if (filterProductType !== 'all') return getAppliesTo(doc).includes(filterProductType);
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header mb-0">
          <FileText className="w-8 h-8 text-primary-400" />
          <div>
            <h1>Document Bank</h1>
            <p className="text-slate-400">
              Product datasheets &amp; manuals, plus General consumer code leaflets that auto-attach on quote save.
            </p>
          </div>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setDocumentToReplace(null);
            resetUploadForm();
            setShowUploadModal(true);
          }}
        >
          Upload Document
        </Button>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as DocumentBankCategory | 'all')}
            className="input"
          >
            <option value="all">All Categories</option>
            {DOCUMENT_BANK_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
          <select
            value={filterProductType}
            onChange={(e) =>
              setFilterProductType(e.target.value as DocumentAppliesTo | 'all' | 'unassigned')
            }
            className="input"
          >
            <option value="all">All product types</option>
            {DOCUMENT_APPLIES_TO.map((type) => (
              <option key={type} value={type}>
                {DOCUMENT_APPLIES_TO_LABELS[type]}
              </option>
            ))}
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
      </Card>

      {isLoading ? (
        <Card>
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
            <p className="text-slate-400 mt-4">Loading documents...</p>
          </div>
        </Card>
      ) : filteredDocuments.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FileType className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No documents found</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDocuments.map((doc) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="hover:border-primary-400/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-slate-800 rounded-lg">
                      <FileText className="w-6 h-6 text-primary-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{doc.name}</h3>
                        <Badge className={CATEGORY_BADGES[doc.category as DocumentBankCategory]}>
                          {CATEGORY_LABELS[doc.category as DocumentBankCategory]}
                        </Badge>
                        {getAppliesTo(doc).length > 0 ? (
                          getAppliesTo(doc).map((type) => (
                            <Badge key={type} className={APPLIES_TO_BADGES[type]}>
                              {DOCUMENT_APPLIES_TO_LABELS[type]}
                            </Badge>
                          ))
                        ) : (
                          <Badge className="bg-slate-500/20 text-slate-400">Unassigned</Badge>
                        )}
                        {doc.category === 'consumer_code_leaflet' && doc.consumerCode && (
                          <Badge className="bg-indigo-500/20 text-indigo-300">
                            {doc.consumerCode}
                          </Badge>
                        )}
                      </div>
                      {doc.description && (
                        <p className="text-slate-400 text-sm mb-2">{doc.description}</p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        {doc.fileSize && <span>Size: {(doc.fileSize / 1024).toFixed(1)} KB</span>}
                        <span>Uploaded: {new Date(doc.createdAt).toLocaleDateString()}</span>
                        {doc.version != null && doc.version > 1 && (
                          <span>Version: {doc.version}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleView(doc)}
                      leftIcon={<Eye className="w-4 h-4" />}
                    >
                      View
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openReplaceModal(doc)}
                      leftIcon={<RefreshCw className="w-4 h-4" />}
                    >
                      Replace
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setDocumentToDelete(doc)}
                      leftIcon={<Trash2 className="w-4 h-4" />}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showUploadModal}
        onClose={closeDocumentModal}
        title={isReplaceMode ? 'Replace Document' : 'Upload Document'}
        size="lg"
      >
        <div className="space-y-4">
          {isReplaceMode && (
            <p className="text-sm text-slate-400">
              Upload a new file for <span className="text-white font-medium">{documentToReplace?.name}</span>.
              Product assignments stay linked to this document.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Document Name *
            </label>
            <Input
              value={uploadForm.name}
              onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
              placeholder="e.g., Tesla Powerwall 2 Datasheet"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Description
            </label>
            <textarea
              value={uploadForm.description}
              onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              className="input h-20 resize-none"
              placeholder="Optional description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Category *
            </label>
            <select
              value={uploadForm.category}
              onChange={(e) => {
                const category = e.target.value as DocumentBankCategory;
                setUploadForm({
                  ...uploadForm,
                  category,
                  productType: category === 'consumer_code_leaflet' ? 'general' : uploadForm.productType === 'general' ? '' : uploadForm.productType,
                  consumerCode: category === 'consumer_code_leaflet' ? uploadForm.consumerCode : '',
                });
              }}
              className="input"
            >
              {DOCUMENT_BANK_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </div>

          {uploadForm.category === 'consumer_code_leaflet' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Document type
                </label>
                <div className="input flex items-center text-emerald-300">
                  General — auto-attaches with the proposal pack
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Consumer code *
                </label>
                <select
                  value={uploadForm.consumerCode}
                  onChange={(e) =>
                    setUploadForm({
                      ...uploadForm,
                      consumerCode: e.target.value as '' | ConsumerCode,
                    })
                  }
                  className="input"
                >
                  <option value="">Select consumer code…</option>
                  {CONSUMER_CODES.map((code) => (
                    <option key={code} value={code}>
                      {CONSUMER_CODE_LABELS[code]}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  When an installer&apos;s company uses this consumer code, this leaflet is attached automatically on quote save.
                </p>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Applies to product type
              </label>
              <select
                value={uploadForm.productType}
                onChange={(e) =>
                  setUploadForm({
                    ...uploadForm,
                    productType: e.target.value as '' | DocumentAppliesTo,
                  })
                }
                className="input"
              >
                <option value="">Not set</option>
                {DOCUMENT_APPLIES_TO.filter((type) => type !== 'general').map((type) => (
                  <option key={type} value={type}>
                    {DOCUMENT_APPLIES_TO_LABELS[type]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-2">
                e.g. User Manual → Battery or Inverter. Assign on a product to use it in proposals.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {isReplaceMode ? 'New file * (Max ~10MB after compression)' : 'File * (Max ~10MB after compression)'}
            </label>
            {isReplaceMode && documentToReplace?.fileName && (
              <p className="text-xs text-slate-500 mb-2">
                Current file: {documentToReplace.fileName}
              </p>
            )}
            <input
              type="file"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx"
              className="block w-full text-sm text-slate-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-primary-500 file:text-white
                hover:file:bg-primary-600
                cursor-pointer"
            />
            {uploadForm.file && (
              <p className="text-xs text-slate-500 mt-2">
                Selected: {uploadForm.file.name} ({(uploadForm.file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={closeDocumentModal}
              disabled={uploading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              isLoading={uploading}
              disabled={uploading}
              leftIcon={isReplaceMode ? <RefreshCw className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
              className="flex-1"
            >
              {isReplaceMode ? 'Replace' : 'Upload'}
            </Button>
          </div>
        </div>
      </Modal>

      <TypeConfirmModal
        isOpen={Boolean(documentToDelete)}
        onClose={() => setDocumentToDelete(null)}
        onConfirm={handleDelete}
        title="Delete document"
        message={
          documentToDelete
            ? `This will permanently delete "${documentToDelete.name}". This cannot be undone.`
            : ''
        }
        confirmValue={documentToDelete?.name ?? ''}
        confirmLabel={
          documentToDelete
            ? `Type "${documentToDelete.name}" to confirm`
            : undefined
        }
        confirmText="Delete document"
        isLoading={isDeleting}
      />
    </div>
  );
}
