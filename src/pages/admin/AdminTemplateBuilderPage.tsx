import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import {
  extractMergeFields,
  homesToCategory,
  normalizeTemplateTechnologies,
  type TemplateBuilderSnapshot,
} from '../../lib/templateBuilder';
import type { DocumentTemplate, TemplateCategory } from '../../types';

const TemplateBuilder = lazy(
  () => import('../../components/admin/template-builder/TemplateBuilder'),
);

interface PublishPayload {
  snapshot: TemplateBuilderSnapshot;
  htmlContent: string;
}

interface MetaForm {
  code: string;
  name: string;
  description: string;
  category: TemplateCategory;
  isActive: boolean;
}

/** Unique template code derived from the name chosen at create-time. */
function suggestCodeFromName(name: string, takenCodes: Set<string>): string {
  const base =
    name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 28) || 'TEMPLATE';

  if (!takenCodes.has(base)) return base;
  let n = 2;
  while (takenCodes.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function categoryLabel(category: TemplateCategory): string {
  switch (category) {
    case 'contract':
      return 'Contract';
    case 'handover':
      return 'Handover';
    case 'invoice':
      return 'Invoice';
    default:
      return 'Proposal';
  }
}

/** Pack templates join the living-document workflow (PDF only at the end). */
function shouldAutoIncludeInQuotePack(category: TemplateCategory): boolean {
  return category === 'proposal' || category === 'contract' || category === 'handover';
}

function mapTemplate(data: Record<string, unknown>): DocumentTemplate {
  return {
    id: data.id as string,
    code: data.code as string,
    name: data.name as string,
    description: (data.description as string) || undefined,
    category: data.category as TemplateCategory,
    htmlContent: data.html_content as string,
    cssStyles: (data.css_styles as string) || undefined,
    mergeFields: Array.isArray(data.merge_fields) ? (data.merge_fields as string[]) : [],
    isActive: Boolean(data.is_active),
    autoGenerate: Boolean(data.auto_generate),
    version: Number(data.version) || 1,
    createdBy: (data.created_by as string) || undefined,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    builderState: (data.builder_state as Record<string, unknown>) || undefined,
    technologies: Array.isArray(data.technologies) ? (data.technologies as string[]) : [],
  };
}

export function AdminTemplateBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);

  const [isLoading, setIsLoading] = useState(isEdit);
  const [existingTemplate, setExistingTemplate] = useState<DocumentTemplate | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<TemplateBuilderSnapshot | null>(null);
  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const [pendingPublish, setPendingPublish] = useState<PublishPayload | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [takenCodes, setTakenCodes] = useState<Set<string>>(new Set());
  const [metaForm, setMetaForm] = useState<MetaForm>({
    code: '',
    name: '',
    description: '',
    category: 'proposal',
    isActive: true,
  });

  useEffect(() => {
    const loadTakenCodes = async () => {
      const { data, error } = await supabase.from('document_templates').select('code, id');
      if (error) {
        console.error('Error loading template codes:', error);
        return;
      }

      const codes = new Set(
        (data || [])
          .filter((row) => !existingTemplate || row.id !== existingTemplate.id)
          .map((row) => String(row.code).toUpperCase()),
      );
      setTakenCodes(codes);
    };

    void loadTakenCodes();
  }, [existingTemplate]);

  useEffect(() => {
    if (!id) return;

    const loadTemplate = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('document_templates')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        const template = mapTemplate(data as Record<string, unknown>);
        setExistingTemplate(template);

        if (template.builderState) {
          setInitialSnapshot(template.builderState as unknown as TemplateBuilderSnapshot);
        } else {
          setInitialSnapshot({
            name: template.name,
            techs: ['solar'],
            homes: [template.category === 'proposal' ? 'Proposal Pack' : 'Handover Pack'],
            font: 'sans',
            version: String(template.version || '1.0'),
            docId: template.code,
            sections: [],
          });
        }

        setMetaForm({
          code: template.code,
          name: template.name,
          description: template.description || '',
          category: template.category,
          isActive: template.isActive,
        });
      } catch (error) {
        console.error('Error loading template:', error);
        toast.error('Failed to load template');
        navigate('/admin/templates');
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplate();
  }, [id, navigate, toast]);

  const persistTemplate = useCallback(
    async (payload: PublishPayload, meta: MetaForm) => {
      setIsSaving(true);
      try {
        const mergeFields = extractMergeFields(payload.htmlContent, payload.snapshot);
        const technologies = normalizeTemplateTechnologies(payload.snapshot.techs);
        const category = homesToCategory(payload.snapshot.homes);
        const name = (payload.snapshot.name || meta.name).trim();
        const templateData = {
          code: meta.code.trim().toUpperCase(),
          name,
          description: meta.description.trim() || null,
          category,
          html_content: payload.htmlContent,
          css_styles: null,
          merge_fields: mergeFields,
          is_active: meta.isActive,
          // Included in living-doc packs; PDF is generated only after all roles finish.
          auto_generate: shouldAutoIncludeInQuotePack(category),
          builder_state: payload.snapshot,
          technologies,
        };

        if (existingTemplate) {
          const { error } = await supabase
            .from('document_templates')
            .update(templateData)
            .eq('id', existingTemplate.id);

          if (error) throw error;
          toast.success('Template updated');
        } else {
          const { error } = await supabase.from('document_templates').insert([templateData]);
          if (error) throw error;
          toast.success('Template created');
        }

        navigate('/admin/templates');
      } catch (error: unknown) {
        console.error('Error saving template:', error);
        const message = error instanceof Error ? error.message : 'Failed to save template';
        toast.error(message);
      } finally {
        setIsSaving(false);
        setMetaModalOpen(false);
        setPendingPublish(null);
      }
    },
    [existingTemplate, navigate, toast],
  );

  const handlePublish = useCallback(
    (payload: PublishPayload) => {
      const category = homesToCategory(payload.snapshot.homes);
      const name =
        payload.snapshot.name && payload.snapshot.name !== 'Untitled document'
          ? payload.snapshot.name
          : metaForm.name || 'Untitled document';

      if (existingTemplate) {
        void persistTemplate(payload, {
          ...metaForm,
          name,
          category,
        });
        return;
      }

      setPendingPublish(payload);
      setMetaForm((prev) => ({
        ...prev,
        code: suggestCodeFromName(name, takenCodes),
        name,
        description: prev.description || '',
        category,
      }));
      setMetaModalOpen(true);
    },
    [existingTemplate, metaForm, persistTemplate, takenCodes],
  );

  const handleConfirmMeta = () => {
    if (!pendingPublish) return;
    const name = (pendingPublish.snapshot.name || metaForm.name).trim();
    if (!metaForm.code.trim() || !name) {
      toast.error('Template code is required');
      return;
    }

    const normalizedCode = metaForm.code.trim().toUpperCase();
    if (takenCodes.has(normalizedCode)) {
      toast.error(`Template code ${normalizedCode} already exists. Choose another code or edit the existing template.`);
      return;
    }

    void persistTemplate(pendingPublish, {
      ...metaForm,
      code: normalizedCode,
      name,
      category: homesToCategory(pendingPublish.snapshot.homes),
    });
  };
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950">
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-[#0C0C0E]">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <div className="spinner w-10 h-10" />
            </div>
          }
        >
          <TemplateBuilder
            embedMode
            initialSnapshot={isEdit ? initialSnapshot : null}
            onPublish={handlePublish}
            onBack={() => navigate('/admin/templates')}
          />
        </Suspense>
      </div>

      <Modal
        isOpen={metaModalOpen}
        onClose={() => {
          if (isSaving) return;
          setMetaModalOpen(false);
          setPendingPublish(null);
        }}
        title="Save template"
        description="Confirm the code before publishing to heliOS."
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-3 space-y-1.5">
            <p className="text-sm text-slate-200">
              <span className="text-slate-500">Name · </span>
              {metaForm.name || pendingPublish?.snapshot.name || 'Untitled document'}
            </p>
            <p className="text-sm text-slate-200">
              <span className="text-slate-500">Category · </span>
              {categoryLabel(metaForm.category)}
              <span className="text-slate-500"> (from your pack selection)</span>
            </p>
          </div>

          <div>
            <label className="label">Template code</label>
            <input
              value={metaForm.code}
              onChange={(e) =>
                setMetaForm({ ...metaForm, code: e.target.value.toUpperCase() })
              }
              placeholder="CODE-FROM-NAME"
              className="input w-full"
              autoFocus
              required
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Prefilled from the template name. Change only if you need a different unique code.
            </p>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={metaForm.description}
              onChange={(e) => setMetaForm({ ...metaForm, description: e.target.value })}
              rows={2}
              className="input w-full"
              placeholder="Brief description (optional)"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={metaForm.isActive}
              onChange={(e) => setMetaForm({ ...metaForm, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-primary-500"
            />
            <span className="text-sm text-slate-300">Active</span>
          </label>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleConfirmMeta} isLoading={isSaving} className="flex-1">
              Save template
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setMetaModalOpen(false);
                setPendingPublish(null);
              }}
              disabled={isSaving}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
