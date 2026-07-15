// @ts-nocheck - Templates page with legacy toast API
import { lazy, Suspense, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { TypeConfirmModal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { buildTemplatePreviewHtml, resolveTemplateTechnologies, templateTechnologyLabel, type TemplateBuilderSnapshot } from '../../lib/templateBuilder';
import { useToast } from '../../contexts/ToastContext';
import type { DocumentTemplate, TemplateCategory } from '../../types';

const TemplateBuilder = lazy(
  () => import('../../components/admin/template-builder/TemplateBuilder'),
);

export function TemplatesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewBuilderTemplate, setPreviewBuilderTemplate] = useState<DocumentTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<DocumentTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setIsLoading(true);
      }

      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedTemplates = (data || []).map(mapTemplate);
      setTemplates(mappedTemplates);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
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
    technologies: Array.isArray(data.technologies) ? data.technologies : [],
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    builderState: data.builder_state || undefined,
  });

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    const deletedId = templateToDelete.id;

    try {
      setIsDeleting(true);

      const { data, error } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', deletedId)
        .select('id');

      if (error) throw error;

      if (!data?.length) {
        throw new Error('Template could not be deleted. Check admin permissions.');
      }

      setTemplates((prev) => prev.filter((template) => template.id !== deletedId));
      toast.success('Template deleted');
      await fetchTemplates({ silent: true });
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast.error(error?.message || 'Failed to delete template');
    } finally {
      setIsDeleting(false);
      setTemplateToDelete(null);
    }
  };

  const handlePreview = (template: DocumentTemplate) => {
    if (template.builderState) {
      setPreviewBuilderTemplate(template);
      return;
    }

    setSelectedTemplate(template);
    setShowPreviewModal(true);
  };

  const filteredTemplates = templates.filter((template) => {
    const techText = resolveTemplateTechnologies(template)
      .map((tech) => templateTechnologyLabel(tech))
      .join(' ')
      .toLowerCase();
    const matchesSearch =
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      techText.includes(searchTerm.toLowerCase());
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
          <p className="page-subtitle">
            Build pack documents in the template builder. Active proposal templates join the live
            role workflow; PDF is generated only after every required role finishes.
          </p>
        </div>
        <Button
          onClick={() => navigate('/admin/templates/new')}
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
          <div key={template.id}>
            <Card className="h-full hover:border-primary-500 transition-colors">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {resolveTemplateTechnologies(template).map((tech) => (
                        <Badge
                          key={tech}
                          className="bg-slate-700/80 text-slate-200 text-xs"
                        >
                          {templateTechnologyLabel(tech)}
                        </Badge>
                      ))}
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {template.name}
                    </h3>
                    <p className="text-sm text-slate-400 line-clamp-2">
                      {template.description || 'No description'}
                    </p>
                  </div>
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
                    onClick={() => navigate(`/admin/templates/${template.id}/edit`)}
                    leftIcon={<Edit className="w-4 h-4" />}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setTemplateToDelete(template)}
                    leftIcon={<Trash2 className="w-4 h-4" />}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          </div>
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
                onClick={() => navigate('/admin/templates/new')}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Create Template
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Builder preview — same view as when creating the template */}
      {previewBuilderTemplate && (
        <div className="fixed inset-0 z-50 bg-[#0C0C0E]">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <div className="spinner w-10 h-10" />
              </div>
            }
          >
            <TemplateBuilder
              key={previewBuilderTemplate.id}
              embedMode
              previewOnly
              initialSnapshot={previewBuilderTemplate.builderState as TemplateBuilderSnapshot}
              onBack={() => setPreviewBuilderTemplate(null)}
            />
          </Suspense>
        </div>
      )}

      {/* HTML preview — legacy templates without builder state */}
      {showPreviewModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">
                Preview: {selectedTemplate.name}
              </h2>
              <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-auto bg-[#EEEBE4] p-6 rounded-lg">
              <div
                dangerouslySetInnerHTML={{
                  __html: buildTemplatePreviewHtml(
                    selectedTemplate.htmlContent,
                    selectedTemplate.cssStyles,
                  ),
                }}
              />
            </div>
          </div>
        </div>
      )}

      <TypeConfirmModal
        isOpen={Boolean(templateToDelete)}
        onClose={() => setTemplateToDelete(null)}
        onConfirm={handleDeleteTemplate}
        title="Delete template"
        message={
          templateToDelete
            ? `This will permanently delete "${templateToDelete.name}" (${templateToDelete.code}). This cannot be undone.`
            : ''
        }
        confirmValue={templateToDelete?.name ?? ''}
        confirmLabel={
          templateToDelete
            ? `Type "${templateToDelete.name}" to confirm`
            : undefined
        }
        confirmText="Delete template"
        isLoading={isDeleting}
      />
    </div>
  );
}
