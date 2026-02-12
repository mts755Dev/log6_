import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Eye,
  Code,
  Download,
  Search,
  Filter,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import type { DocumentTemplate, TemplateCategory } from '../../types';

export function TemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category: 'proposal' as TemplateCategory,
    htmlContent: '',
    cssStyles: '',
    mergeFields: '',
    isActive: true,
    autoGenerate: false,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map snake_case to camelCase
      const mappedTemplates = (data || []).map(mapTemplate);
      setTemplates(mappedTemplates);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const mapTemplate = (data: any): DocumentTemplate => ({
    id: data.id,
    code: data.code,
    name: data.name,
    description: data.description,
    category: data.category,
    htmlContent: data.html_content,
    cssStyles: data.css_styles,
    mergeFields: Array.isArray(data.merge_fields) ? data.merge_fields : [],
    isActive: data.is_active,
    autoGenerate: data.auto_generate,
    version: data.version,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });

  const handleSaveTemplate = async () => {
    try {
      const mergeFieldsArray = formData.mergeFields
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);

      const templateData = {
        code: formData.code.toUpperCase(),
        name: formData.name,
        description: formData.description || null,
        category: formData.category,
        html_content: formData.htmlContent,
        css_styles: formData.cssStyles || null,
        merge_fields: mergeFieldsArray,
        is_active: formData.isActive,
        auto_generate: formData.autoGenerate,
      };

      if (selectedTemplate) {
        // Update existing
        const { error } = await supabase
          .from('document_templates')
          .update(templateData)
          .eq('id', selectedTemplate.id);

        if (error) throw error;
        toast.success('Template updated successfully');
      } else {
        // Create new
        const { error } = await supabase
          .from('document_templates')
          .insert([templateData]);

        if (error) throw error;
        toast.success('Template created successfully');
      }

      setShowModal(false);
      resetForm();
      fetchTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error(error.message || 'Failed to save template');
    }
  };

  const handleEditTemplate = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      code: template.code,
      name: template.name,
      description: template.description || '',
      category: template.category,
      htmlContent: template.htmlContent,
      cssStyles: template.cssStyles || '',
      mergeFields: template.mergeFields.join(', '),
      isActive: template.isActive,
      autoGenerate: template.autoGenerate,
    });
    setShowModal(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Template deleted');
      fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handlePreview = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setShowPreviewModal(true);
  };

  const resetForm = () => {
    setSelectedTemplate(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      category: 'proposal',
      htmlContent: '',
      cssStyles: '',
      mergeFields: '',
      isActive: true,
      autoGenerate: false,
    });
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (category: TemplateCategory) => {
    const colors = {
      proposal: 'bg-blue-500/20 text-blue-400',
      contract: 'bg-purple-500/20 text-purple-400',
      handover: 'bg-green-500/20 text-green-400',
      invoice: 'bg-orange-500/20 text-orange-400',
    };
    return colors[category] || 'bg-slate-500/20 text-slate-400';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-slate-400">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Document Templates</h1>
          <p className="page-subtitle">Manage PDF templates for proposals, contracts, and invoices</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New Template
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedCategory('proposal')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedCategory === 'proposal'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Proposal
            </button>
            <button
              onClick={() => setSelectedCategory('contract')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedCategory === 'contract'
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Contract
            </button>
            <button
              onClick={() => setSelectedCategory('handover')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedCategory === 'handover'
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Handover
            </button>
            <button
              onClick={() => setSelectedCategory('invoice')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedCategory === 'invoice'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Invoice
            </button>
          </div>
        </div>
      </Card>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="h-full hover:border-primary-500 transition-colors">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getCategoryColor(template.category)}>
                        {template.code}
                      </Badge>
                      {template.isActive ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-500" />
                      )}
                      {template.autoGenerate && (
                        <Badge className="bg-primary-500/20 text-primary-400 text-xs">
                          Auto
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {template.name}
                    </h3>
                    <p className="text-sm text-slate-400 line-clamp-2">
                      {template.description || 'No description'}
                    </p>
                  </div>
                </div>

                {/* Merge Fields */}
                <div className="flex flex-wrap gap-1">
                  {template.mergeFields.slice(0, 3).map((field) => (
                    <span
                      key={field}
                      className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded"
                    >
                      {`{{${field}}}`}
                    </span>
                  ))}
                  {template.mergeFields.length > 3 && (
                    <span className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded">
                      +{template.mergeFields.length - 3} more
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-slate-800">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePreview(template)}
                    leftIcon={<Eye className="w-4 h-4" />}
                  >
                    Preview
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleEditTemplate(template)}
                    leftIcon={<Edit className="w-4 h-4" />}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteTemplate(template.id)}
                    leftIcon={<Trash2 className="w-4 h-4" />}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <Card>
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No templates found</h3>
            <p className="text-slate-400 mb-6">
              {searchTerm || selectedCategory !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first template to get started'}
            </p>
            {!searchTerm && selectedCategory === 'all' && (
              <Button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Create Template
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold text-white mb-6">
              {selectedTemplate ? 'Edit Template' : 'Create New Template'}
            </h2>

            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Template Code *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., FO7A"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as TemplateCategory })
                    }
                    className="input w-full"
                  >
                    <option value="proposal">Proposal</option>
                    <option value="contract">Contract</option>
                    <option value="handover">Handover</option>
                    <option value="invoice">Invoice</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Covering Letter"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this template"
                  rows={2}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  HTML Content *
                </label>
                <textarea
                  value={formData.htmlContent}
                  onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
                  placeholder="<html>...</html>"
                  rows={10}
                  className="input w-full font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  CSS Styles (optional)
                </label>
                <textarea
                  value={formData.cssStyles}
                  onChange={(e) => setFormData({ ...formData, cssStyles: e.target.value })}
                  placeholder="body { font-family: Arial; }"
                  rows={4}
                  className="input w-full font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Merge Fields (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.mergeFields}
                  onChange={(e) => setFormData({ ...formData, mergeFields: e.target.value })}
                  placeholder="customer_name, quote_total, battery_capacity"
                  className="input w-full"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Use these fields in HTML as: {`{{customer_name}}`}
                </p>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-primary-500"
                  />
                  <span className="text-sm text-slate-300">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoGenerate}
                    onChange={(e) =>
                      setFormData({ ...formData, autoGenerate: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-primary-500"
                  />
                  <span className="text-sm text-slate-300">Auto-generate when quote sent</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={handleSaveTemplate} className="flex-1">
                {selectedTemplate ? 'Update Template' : 'Create Template'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">
                Preview: {selectedTemplate.name}
              </h2>
              <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-auto bg-white p-6 rounded-lg">
              <div
                dangerouslySetInnerHTML={{ __html: selectedTemplate.htmlContent }}
                className="prose max-w-none"
              />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
