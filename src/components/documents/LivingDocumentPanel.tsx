import { useEffect, useMemo, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { mergeTemplate } from '../../utils/pdfGenerator';
import { applyLiveMergeAttributes } from '../../lib/templateBuilder';
import {
  collectEditableFieldsForRole,
  livingDocumentStatusLabel,
  saveLivingDocumentCustomer,
  saveLivingDocumentResponses,
  submitLivingDocumentCustomer,
  submitLivingDocumentRole,
} from '../../lib/livingDocuments';
import type { LivingDocumentRole, QuoteLivingDocument } from '../../types';

/** Show merged signature images that were hidden (display:none) in the builder export. */
function revealSignatureImagesInPreview(
  html: string,
  data: Record<string, unknown>,
): string {
  if (typeof DOMParser === 'undefined') return html;
  const parser = new DOMParser();
  const wrapped = parser.parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = wrapped.getElementById('root');
  if (!root) return html;

  const installerSig = String(data.installer_signature || '');
  const customerSig = String(data.customer_signature || '');

  root.querySelectorAll('img').forEach((img) => {
    const src = (img.getAttribute('src') || '').trim();
    const alt = (img.getAttribute('alt') || '').toLowerCase();
    const mergeHint = (img.getAttribute('data-tms-merge') || '').toLowerCase();
    const isPlaceholderGif =
      src.includes('R0lGODlhAQABAI') || src === '' || src.includes('{{installer_signature}}');
    const looksInstaller =
      mergeHint.includes('installer_signature') ||
      alt.includes('installer signature') ||
      src.includes('installer_signature') ||
      (isPlaceholderGif && !!installerSig);

    if (looksInstaller && installerSig) {
      img.setAttribute('src', installerSig);
      img.setAttribute(
        'style',
        'max-height:48px;max-width:220px;object-fit:contain;display:block;',
      );
      const pad = img.parentElement;
      if (pad) {
        pad.querySelectorAll('span').forEach((span) => {
          const t = (span.textContent || '').toLowerCase();
          if (t.includes('signs') || t.includes('on file') || t.includes('e-signature')) {
            span.remove();
          }
        });
      }
    }
  });

  // Customer pads are text-only in the builder — inject image when signed
  if (customerSig.startsWith('data:image')) {
    root.querySelectorAll('[data-tms-assignee="customer"]').forEach((block) => {
      const pad = block.querySelector('div[style*="height"]') || block;
      const hasImg = pad.querySelector('img[src^="data:image"]');
      if (hasImg) return;
      const text = (pad.textContent || '').toLowerCase();
      if (!text.includes('customer') && !text.includes('e-signature') && !text.includes('sign')) {
        return;
      }
      pad.querySelectorAll('span').forEach((span) => {
        const t = (span.textContent || '').toLowerCase();
        if (t.includes('sign') || t.includes('e-signature')) span.remove();
      });
      const img = wrapped.createElement('img');
      img.setAttribute('src', customerSig);
      img.setAttribute('alt', 'Customer signature');
      img.setAttribute(
        'style',
        'max-height:48px;max-width:220px;object-fit:contain;display:block;',
      );
      pad.insertBefore(img, pad.firstChild);
    });
  }

  return root.innerHTML;
}

interface LivingDocumentPanelProps {
  document: QuoteLivingDocument;
  mergeData: Record<string, unknown>;
  role: LivingDocumentRole;
  /** Customer public access via share token */
  share?: { quoteId: string; token: string };
  onUpdated?: (doc: QuoteLivingDocument) => void;
  onReadyForPdf?: (doc: QuoteLivingDocument) => void;
  readOnly?: boolean;
}

export function LivingDocumentPanel({
  document: initialDoc,
  mergeData,
  role,
  share,
  onUpdated,
  onReadyForPdf,
  readOnly = false,
}: LivingDocumentPanelProps) {
  const [doc, setDoc] = useState(initialDoc);
  const [draft, setDraft] = useState<Record<string, string | boolean | null>>({
    ...initialDoc.responses,
  });
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const sigRefs = useRef<Record<string, SignatureCanvas | null>>({});

  useEffect(() => {
    setDoc(initialDoc);
    setDraft({ ...initialDoc.responses });
  }, [initialDoc]);

  const canEdit = !readOnly && doc.pendingRole === role && doc.status !== 'completed';
  const fields = useMemo(
    () => collectEditableFieldsForRole(doc.builderState, role),
    [doc.builderState, role],
  );

  const previewHtml = useMemo(() => {
    const data = { ...mergeData, ...draft };
    let html = mergeTemplate(doc.htmlSnapshot || '', data);
    html = applyLiveMergeAttributes(html, data);
    html = mergeTemplate(html, data);
    html = revealSignatureImagesInPreview(html, data);
    return html;
  }, [doc.htmlSnapshot, mergeData, draft]);

  const setField = (key: string, value: string | boolean | null) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  // One canvas ref per signature field
  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      let updated: QuoteLivingDocument | null = null;
      if (share) {
        updated = await saveLivingDocumentCustomer(
          doc.id,
          share.quoteId,
          share.token,
          draft,
        );
      } else {
        updated = await saveLivingDocumentResponses(doc.id, draft);
      }
      if (!updated) throw new Error('Could not save document');
      setDoc(updated);
      onUpdated?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const nextDraft = { ...draft };
      fields.forEach((field) => {
        if (field.kind !== 'signature' || nextDraft[field.key]) return;
        const pad = sigRefs.current[field.key];
        if (pad && !pad.isEmpty()) {
          nextDraft[field.key] = pad.toDataURL('image/png');
        }
      });

      for (const field of fields) {
        if (!field.required) continue;
        const val = nextDraft[field.key];
        if (val == null || val === '' || val === false) {
          throw new Error(`Please complete: ${field.label}`);
        }
      }

      let updated: QuoteLivingDocument | null = null;
      if (share) {
        updated = await submitLivingDocumentCustomer(
          doc.id,
          share.quoteId,
          share.token,
          nextDraft,
        );
      } else {
        updated = await submitLivingDocumentRole(doc.id, role, nextDraft);
      }
      if (!updated) throw new Error('Could not submit document');
      setDoc(updated);
      setDraft({ ...updated.responses });
      onUpdated?.(updated);
      if (updated.status === 'ready_for_pdf' || updated.pendingRole === 'done') {
        onReadyForPdf?.(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 border border-slate-700 rounded-xl p-4 bg-slate-900/50">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-white font-semibold">{doc.name}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{doc.templateCode}</p>
        </div>
        <Badge className="bg-slate-700 text-slate-200 text-xs">
          {livingDocumentStatusLabel(doc.status)}
        </Badge>
      </div>

      <div
        className="bg-white text-slate-900 rounded-lg p-4 max-h-[420px] overflow-auto text-sm prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: previewHtml }}
      />

      {canEdit && fields.length > 0 && (
        <div className="space-y-3 border-t border-slate-700 pt-4">
          <p className="text-sm text-slate-300 font-medium">Your fields to complete</p>
          {fields.map((field) => {
            if (field.kind === 'checkbox') {
              return (
                <label key={field.key} className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={Boolean(draft[field.key])}
                    onChange={(e) => setField(field.key, e.target.checked)}
                  />
                  {field.label}
                  {field.required ? <span className="text-red-400">*</span> : null}
                </label>
              );
            }
            if (field.kind === 'signature') {
              const existing = typeof draft[field.key] === 'string' ? String(draft[field.key]) : '';
              return (
                <div key={field.key} className="space-y-2">
                  <label className="block text-sm text-slate-300">
                    {field.label}
                    {field.required ? <span className="text-red-400 ml-1">*</span> : null}
                  </label>
                  {existing ? (
                    <div className="relative bg-white rounded-lg overflow-hidden">
                      <img src={existing} alt={field.label} className="h-32 object-contain w-full" />
                      <button
                        type="button"
                        className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-slate-900/80 text-white"
                        onClick={() => setField(field.key, '')}
                      >
                        Redraw
                      </button>
                    </div>
                  ) : (
                    <div className="border border-slate-600 rounded-lg bg-white overflow-hidden">
                      <SignatureCanvas
                        ref={(el) => {
                          sigRefs.current[field.key] = el;
                        }}
                        canvasProps={{ className: 'w-full h-32' }}
                        onEnd={() => {
                          const pad = sigRefs.current[field.key];
                          if (pad && !pad.isEmpty()) {
                            setField(field.key, pad.toDataURL('image/png'));
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            }
            return (
              <Input
                key={field.key}
                label={field.label}
                value={String(draft[field.key] ?? '')}
                onChange={(e) => setField(field.key, e.target.value)}
                required={field.required}
              />
            );
          })}
        </div>
      )}

      {canEdit && fields.length === 0 && (
        <p className="text-sm text-slate-400">
          No fields are assigned to you on this document. You can submit to advance the workflow.
        </p>
      )}

      {!canEdit && (
        <p className="text-sm text-slate-500">
          {doc.pendingRole === 'done' || doc.status === 'ready_for_pdf' || doc.status === 'completed'
            ? 'This document is complete for role editing.'
            : `Waiting for ${doc.pendingRole} to complete their part.`}
        </p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {canEdit && (
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={() => void handleSave()} disabled={saving || submitting}>
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
          <Button size="sm" onClick={() => void handleSubmit()} disabled={saving || submitting}>
            {submitting ? 'Submitting…' : 'Submit my part'}
          </Button>
        </div>
      )}
    </div>
  );
}
