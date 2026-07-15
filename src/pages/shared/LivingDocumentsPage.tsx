import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LivingDocumentPanel } from '../../components/documents/LivingDocumentPanel';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import {
  listLivingDocumentsForQuote,
  livingDocumentStatusLabel,
} from '../../lib/livingDocuments';
import { buildQuoteMergeData, finalizeLivingDocumentPdf } from '../../services/proposalPdfGenerator';
import { supabase } from '../../lib/supabase';
import type { LivingDocumentRole, QuoteLivingDocument } from '../../types';

function roleForUser(userRole?: string): LivingDocumentRole | null {
  if (userRole === 'installer') return 'installer';
  if (userRole === 'engineer') return 'engineer';
  if (userRole === 'compliance_officer') return 'compliance';
  return null;
}

export function LivingDocumentsPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { getQuote, getCompany } = useData();
  const [docs, setDocs] = useState<QuoteLivingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [companyRow, setCompanyRow] = useState<Record<string, unknown> | null>(null);

  const quote = quoteId ? getQuote(quoteId) : undefined;
  const role = roleForUser(user?.role);

  const load = useCallback(async () => {
    if (!quoteId) return;
    setLoading(true);
    const rows = await listLivingDocumentsForQuote(quoteId);
    setDocs(rows);
    setLoading(false);
  }, [quoteId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const loadCompany = async () => {
      if (!user?.companyId) return;
      const fromCtx = getCompany?.(user.companyId);
      if (fromCtx) {
        setCompanyRow(fromCtx as unknown as Record<string, unknown>);
        return;
      }
      const { data } = await supabase.from('companies').select('*').eq('id', user.companyId).single();
      if (data) setCompanyRow(data as Record<string, unknown>);
    };
    void loadCompany();
  }, [user?.companyId, getCompany]);

  const mergeData = useMemo(() => {
    if (!quote || !companyRow) return {};
    return buildQuoteMergeData(quote, companyRow);
  }, [quote, companyRow]);

  const relevantDocs = useMemo(() => {
    if (!role) return docs;
    // Installers and engineers see the full proposal pack for the job.
    // Compliance only sees docs that include their stage (or are finished).
    if (role === 'installer' || role === 'engineer') return docs;
    return docs.filter(
      (d) =>
        d.pendingRole === role ||
        d.requiredRoles.includes(role) ||
        d.status === 'ready_for_pdf' ||
        d.status === 'completed',
    );
  }, [docs, role]);

  const handleFinalize = async (doc: QuoteLivingDocument) => {
    if (!quote || !user?.companyId) return;
    setFinalizingId(doc.id);
    try {
      const result = await finalizeLivingDocumentPdf(doc, quote, user.companyId);
      if (!result.success) {
        toast.error(result.error || 'Failed to generate PDF');
      } else {
        toast.success(`PDF ready: ${result.fileName}`);
        await load();
      }
    } finally {
      setFinalizingId(null);
    }
  };

  if (!role) {
    return (
      <Card>
        <p className="text-slate-300">Your role cannot edit living documents.</p>
      </Card>
    );
  }

  const backPath =
    user?.role === 'engineer'
      ? '/engineer'
      : user?.role === 'compliance_officer'
        ? '/compliance'
        : `/installer/quotes/${quoteId}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate(backPath)} leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Back
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-400" />
            Proposal documents
          </h1>
          <p className="text-sm text-slate-400">
            {quote?.customer?.name || 'Quote'} · complete only your assigned fields
          </p>
        </div>
      </div>

      {!quote && (
        <Card>
          <p className="text-slate-400">Quote not found in local cache. Refresh and try again.</p>
          <Button className="mt-3" variant="secondary" onClick={() => void load()}>
            Reload documents
          </Button>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="spinner w-8 h-8" />
        </div>
      ) : relevantDocs.length === 0 ? (
        <Card>
          <p className="text-slate-400">No living documents for this quote yet.</p>
          {user?.role === 'installer' && quoteId && (
            <Link to={`/installer/quotes/${quoteId}`} className="text-primary-400 text-sm mt-2 inline-block">
              Open quote detail
            </Link>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {relevantDocs.map((doc) => (
            <div key={doc.id} className="space-y-2">
              <LivingDocumentPanel
                document={doc}
                mergeData={mergeData}
                role={role}
                onUpdated={(updated) => {
                  setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
                }}
                onReadyForPdf={(updated) => {
                  setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
                  if (user?.role === 'installer' || user?.role === 'compliance_officer') {
                    void handleFinalize(updated);
                  }
                }}
              />
              {(doc.status === 'ready_for_pdf' || doc.pendingRole === 'done') &&
                doc.status !== 'completed' &&
                (user?.role === 'installer' || user?.role === 'compliance_officer' || user?.role === 'admin') && (
                  <Button
                    size="sm"
                    disabled={finalizingId === doc.id}
                    onClick={() => void handleFinalize(doc)}
                  >
                    {finalizingId === doc.id
                      ? 'Generating PDF…'
                      : `Generate PDF · ${livingDocumentStatusLabel(doc.status)}`}
                  </Button>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
