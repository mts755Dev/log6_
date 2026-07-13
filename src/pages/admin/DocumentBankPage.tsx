import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  FileText,
  Trash2,
  Eye,
  Plus,
  Filter,
  Search,
  FileType,
  Sparkles,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { queueDocumentIndexing, fetchDocumentIndexStatuses } from '../../services/assistant';
import type { DocumentIndexStatus } from '../../services/assistant';
import type { Document as DocumentType, DocumentCategory, InsuranceProvider, ProductType } from '../../types';

export function DocumentBankPage() {
  const toast = useToast();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<DocumentCategory | 'all'>('all');
  
  // Product lists for dropdowns
  const [batteries, setBatteries] = useState<any[]>([]);
  const [inverters, setInverters] = useState<any[]>([]);
  
  // Upload form state
  const [uploading, setUploading] = useState(false);
  const [indexingId, setIndexingId] = useState<string | null>(null);
  const [indexStatuses, setIndexStatuses] = useState<Record<string, DocumentIndexStatus>>({});
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    category: 'consumer_code_leaflet' as DocumentCategory,
    insuranceProvider: '' as InsuranceProvider | '',
    consumerCode: '',
    productId: '',
    productType: '' as ProductType | '',
    file: null as File | null,
  });

  useEffect(() => {
    fetchDocuments();
    fetchProducts();
    void loadIndexStatuses();
  }, [filterCategory]);

  const loadIndexStatuses = async () => {
    try {
      const statuses = await fetchDocumentIndexStatuses();
      setIndexStatuses(statuses);
    } catch {
      // non-fatal for document list
    }
  };

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterCategory !== 'all') {
        query = query.eq('category', filterCategory);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Map snake_case database fields to camelCase TypeScript interface
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
        version: doc.version,
        uploadedBy: doc.uploaded_by,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }));
      
      setDocuments(mappedData);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      // Fetch batteries with manufacturer info
      const { data: batteryData, error: batteryError } = await supabase
        .from('battery_products')
        .select(`
          id,
          model,
          capacity_kwh,
          manufacturer:manufacturers(name)
        `)
        .eq('is_active', true)
        .order('model');
      
      if (batteryError) {
        console.error('Error fetching batteries:', batteryError);
      } else if (batteryData) {
        const mappedBatteries = batteryData.map((b: any) => ({
          id: b.id,
          model: b.model,
          capacity_kwh: b.capacity_kwh,
          manufacturer_name: b.manufacturer?.name || 'Unknown',
        }));
        setBatteries(mappedBatteries);
        console.log('Loaded batteries:', mappedBatteries);
      }

      // Fetch inverters with manufacturer info
      const { data: inverterData, error: inverterError } = await supabase
        .from('inverter_products')
        .select(`
          id,
          model,
          power_kw,
          manufacturer:manufacturers(name)
        `)
        .eq('is_active', true)
        .order('model');
      
      if (inverterError) {
        console.error('Error fetching inverters:', inverterError);
      } else if (inverterData) {
        const mappedInverters = inverterData.map((i: any) => ({
          id: i.id,
          model: i.model,
          power_kw: i.power_kw,
          manufacturer_name: i.manufacturer?.name || 'Unknown',
        }));
        setInverters(mappedInverters);
        console.log('Loaded inverters:', mappedInverters);
      }
    } catch (error: any) {
      console.error('Error fetching products:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setUploadForm({ ...uploadForm, file });
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.name) {
      toast.error('Please provide file name and select a file');
      return;
    }

    // Validation based on category
    if (uploadForm.category === 'consumer_code_leaflet' && !uploadForm.consumerCode && !uploadForm.insuranceProvider) {
      toast.error('Please select a consumer code or insurance provider for consumer code leaflets');
      return;
    }

    if (uploadForm.category === 'product_datasheet' && (!uploadForm.productId || !uploadForm.productType)) {
      toast.error('Please provide product ID and type for product datasheets');
      return;
    }

    setUploading(true);

    try {
      // Upload file to Supabase Storage
      const fileExt = uploadForm.file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `documents/${uploadForm.category}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, uploadForm.file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Create document record
      const { data: newDoc, error: dbError } = await supabase.from('documents').insert({
        name: uploadForm.name,
        description: uploadForm.description || null,
        category: uploadForm.category,
        file_url: publicUrl,
        file_name: uploadForm.file.name,
        file_size: uploadForm.file.size,
        mime_type: uploadForm.file.type,
        insurance_provider: uploadForm.insuranceProvider || null,
        consumer_code: uploadForm.consumerCode || null,
        product_id: uploadForm.productId || null,
        product_type: uploadForm.productType || null,
      }).select('id').single();

      if (dbError) throw dbError;

      try {
        await queueDocumentIndexing(newDoc.id);
        toast.success('Document uploaded and queued for AI indexing');
      } catch {
        toast.success('Document uploaded successfully!');
      }
      setShowUploadModal(false);
      setUploadForm({
        name: '',
        description: '',
        category: 'consumer_code_leaflet',
        insuranceProvider: '',
        consumerCode: '',
        productId: '',
        productType: '',
        file: null,
      });
      fetchDocuments();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, fileUrl: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      // Extract file path from URL
      const filePath = fileUrl.split('/documents/')[1];
      
      // Delete from storage
      if (filePath) {
        await supabase.storage.from('documents').remove([`documents/${filePath}`]);
      }

      // Delete from database
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;

      toast.success('Document deleted successfully');
      fetchDocuments();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const handleView = (doc: DocumentType) => {
    setSelectedDocument(doc);
    setShowViewModal(true);
  };

  const handleIndexForAssistant = async (doc: DocumentType) => {
    try {
      setIndexingId(doc.id);
      const result = await queueDocumentIndexing(doc.id, 'compliance');
      toast.success(result?.message || 'Document indexed for AI');
      await loadIndexStatuses();
    } catch (error: any) {
      console.error('Error indexing document:', error);
      toast.error(error.message || 'Failed to index document');
    } finally {
      setIndexingId(null);
    }
  };

  const getIndexBadge = (docId: string) => {
    const status = indexStatuses[docId];
    if (!status) return null;
    const colors = {
      indexed: 'bg-emerald-500/20 text-emerald-300',
      pending: 'bg-amber-500/20 text-amber-300',
      failed: 'bg-red-500/20 text-red-300',
    };
    return (
      <Badge className={colors[status.status]}>
        AI: {status.status}
        {status.status === 'indexed' ? ` (${status.vectorCount})` : ''}
      </Badge>
    );
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryBadge = (category: DocumentCategory) => {
    const colors = {
      consumer_code_leaflet: 'bg-blue-500/20 text-blue-400',
      product_datasheet: 'bg-green-500/20 text-green-400',
      template: 'bg-purple-500/20 text-purple-400',
    };
    return colors[category];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header mb-0">
          <FileText className="w-8 h-8 text-primary-400" />
          <div>
            <h1>Document Bank</h1>
            <p className="text-slate-400">Manage all system documents and templates</p>
          </div>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowUploadModal(true)}>
          Upload Document
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
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
            onChange={(e) => setFilterCategory(e.target.value as DocumentCategory | 'all')}
            className="input"
          >
            <option value="all">All Categories</option>
            <option value="consumer_code_leaflet">Consumer Code Leaflets</option>
            <option value="product_datasheet">Product Datasheets</option>
            <option value="template">Templates</option>
          </select>
        </div>
      </Card>

      {/* Documents List */}
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
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{doc.name}</h3>
                        <Badge className={getCategoryBadge(doc.category)}>
                          {doc.category.replace('_', ' ')}
                        </Badge>
                        {getIndexBadge(doc.id)}
                      </div>
                      {doc.description && (
                        <p className="text-slate-400 text-sm mb-2">{doc.description}</p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        {doc.fileSize && <span>Size: {(doc.fileSize / 1024).toFixed(1)} KB</span>}
                        {doc.insuranceProvider && <span>Provider: {doc.insuranceProvider}</span>}
                        {doc.productType && <span>Type: {doc.productType}</span>}
                        {doc.productId && doc.productType && (
                          <span>
                            Product: {
                              doc.productType === 'battery'
                                ? (() => {
                                    const battery = batteries.find((b: any) => b.id === doc.productId);
                                    return battery ? `${battery.manufacturer_name} ${battery.model}` : doc.productId;
                                  })()
                                : (() => {
                                    const inverter = inverters.find((i: any) => i.id === doc.productId);
                                    return inverter ? `${inverter.manufacturer_name} ${inverter.model}` : doc.productId;
                                  })()
                            }
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleIndexForAssistant(doc)}
                      isLoading={indexingId === doc.id}
                      leftIcon={<Sparkles className="w-4 h-4" />}
                    >
                      Index AI
                    </Button>
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
                      onClick={() => handleDelete(doc.id, doc.fileUrl)}
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

      {/* View Document Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedDocument(null);
        }}
        title="Document Details"
        size="lg"
      >
        {selectedDocument && (
          <div className="space-y-6">
            {/* Document Name & Category */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2">Document Name</h3>
              <p className="text-lg font-semibold text-white">{selectedDocument.name}</p>
            </div>

            {/* Description */}
            {selectedDocument.description && (
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Description</h3>
                <p className="text-white">{selectedDocument.description}</p>
              </div>
            )}

            {/* Category */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2">Category</h3>
              <Badge className={getCategoryBadge(selectedDocument.category)}>
                {selectedDocument.category.replace(/_/g, ' ').toUpperCase()}
              </Badge>
            </div>

            {/* Insurance Provider (for consumer code leaflets) */}
            {selectedDocument.insuranceProvider && (
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Insurance Provider</h3>
                <p className="text-white font-medium">{selectedDocument.insuranceProvider}</p>
              </div>
            )}

            {/* Product Information (for product datasheets) */}
            {selectedDocument.productId && selectedDocument.productType && (
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Linked Product</h3>
                <div className="bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-white">
                    <span className="text-slate-400">Type:</span>{' '}
                    {selectedDocument.productType.charAt(0).toUpperCase() + selectedDocument.productType.slice(1)}
                  </p>
                  <p className="text-white mt-1">
                    <span className="text-slate-400">Product:</span>{' '}
                    {selectedDocument.productType === 'battery'
                      ? (() => {
                          const battery = batteries.find((b: any) => b.id === selectedDocument.productId);
                          return battery ? `${battery.manufacturer_name} ${battery.model}` : selectedDocument.productId;
                        })()
                      : (() => {
                          const inverter = inverters.find((i: any) => i.id === selectedDocument.productId);
                          return inverter ? `${inverter.manufacturer_name} ${inverter.model}` : selectedDocument.productId;
                        })()}
                  </p>
                </div>
              </div>
            )}

            {/* File Information */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2">File Information</h3>
              <div className="bg-slate-800/50 p-4 rounded-lg space-y-2">
                <p className="text-white">
                  <span className="text-slate-400">Filename:</span> {selectedDocument.fileName}
                </p>
                {selectedDocument.fileSize && (
                  <p className="text-white">
                    <span className="text-slate-400">Size:</span> {(selectedDocument.fileSize / 1024).toFixed(2)} KB
                  </p>
                )}
                {selectedDocument.mimeType && (
                  <p className="text-white">
                    <span className="text-slate-400">Type:</span> {selectedDocument.mimeType}
                  </p>
                )}
              </div>
            </div>

            {/* Upload Information */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2">Upload Information</h3>
              <div className="bg-slate-800/50 p-4 rounded-lg space-y-2">
                <p className="text-white">
                  <span className="text-slate-400">Uploaded:</span>{' '}
                  {new Date(selectedDocument.createdAt).toLocaleString()}
                </p>
                {selectedDocument.updatedAt !== selectedDocument.createdAt && (
                  <p className="text-white">
                    <span className="text-slate-400">Last Updated:</span>{' '}
                    {new Date(selectedDocument.updatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-slate-700">
              <Button
                variant="primary"
                onClick={() => window.open(selectedDocument.fileUrl, '_blank')}
                leftIcon={<FileText className="w-4 h-4" />}
                className="flex-1"
              >
                Open File
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedDocument(null);
                }}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Document"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Document Name *
            </label>
            <Input
              value={uploadForm.name}
              onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
              placeholder="e.g., QANW Consumer Code Leaflet"
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
              onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value as DocumentCategory })}
              className="input"
            >
              <option value="consumer_code_leaflet">Consumer Code Leaflet</option>
              <option value="product_datasheet">Product Datasheet</option>
              <option value="template">Template</option>
            </select>
          </div>

          {uploadForm.category === 'consumer_code_leaflet' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Consumer Code *
                </label>
                <select
                  value={uploadForm.consumerCode}
                  onChange={(e) => setUploadForm({ ...uploadForm, consumerCode: e.target.value })}
                  className="input"
                >
                  <option value="">Select Consumer Code...</option>
                  <option value="RECC">RECC — Renewable Energy Consumer Code</option>
                  <option value="HIES">HIES — Home Insulation & Energy Systems</option>
                  <option value="NAPIT">NAPIT Consumer Code</option>
                  <option value="TrustMark">TrustMark</option>
                  <option value="MCS">MCS — Microgeneration Certification Scheme</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Insurance Provider (optional, legacy)
                </label>
                <select
                  value={uploadForm.insuranceProvider}
                  onChange={(e) => setUploadForm({ ...uploadForm, insuranceProvider: e.target.value as InsuranceProvider })}
                  className="input"
                >
                  <option value="">None</option>
                  <option value="QANW">QANW</option>
                  <option value="HICE">HICE</option>
                  <option value="REC">REC</option>
                </select>
              </div>
            </>
          )}

          {uploadForm.category === 'product_datasheet' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Product Type *
                </label>
                <select
                  value={uploadForm.productType}
                  onChange={(e) => setUploadForm({ ...uploadForm, productType: e.target.value as ProductType, productId: '' })}
                  className="input"
                >
                  <option value="">Select Type...</option>
                  <option value="battery">Battery</option>
                  <option value="inverter">Inverter</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Product ID *
                </label>
                <select
                  value={uploadForm.productId}
                  onChange={(e) => setUploadForm({ ...uploadForm, productId: e.target.value })}
                  className="input"
                >
                  <option value="">Select {uploadForm.productType || 'product'}...</option>
                  {uploadForm.productType === 'battery' && batteries.map((battery: any) => (
                    <option key={battery.id} value={battery.id}>
                      {battery.manufacturer_name} {battery.model} ({battery.capacity_kwh}kWh)
                    </option>
                  ))}
                  {uploadForm.productType === 'inverter' && inverters.map((inverter: any) => (
                    <option key={inverter.id} value={inverter.id}>
                      {inverter.manufacturer_name} {inverter.model} ({inverter.power_kw}kW)
                    </option>
                  ))}
                </select>
                {uploadForm.productType && (
                  <p className="text-xs text-slate-500 mt-1">
                    {uploadForm.productType === 'battery' 
                      ? `${batteries.length} batteries available`
                      : `${inverters.length} inverters available`}
                  </p>
                )}
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              File * (Max 10MB)
            </label>
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
              onClick={() => setShowUploadModal(false)}
              disabled={uploading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              isLoading={uploading}
              disabled={uploading}
              leftIcon={<Upload className="w-4 h-4" />}
              className="flex-1"
            >
              Upload
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
