import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { livingDocumentStatusLabel, mapLivingDocumentRow } from '../../lib/livingDocuments';
import type { LivingDocumentRole, QuoteLivingDocument } from '../../types';

function awaitingRoleForUser(role?: string): LivingDocumentRole | null {
  if (role === 'engineer') return 'engineer';
  if (role === 'compliance_officer') return 'compliance';
  if (role === 'installer') return 'installer';
  return null;
}

type InboxRow = QuoteLivingDocument & {
  customerName?: string;
  quoteReference?: string;
};

function mapInboxRows(data: Record<string, unknown>[]): InboxRow[] {
  return data.map((row) => {
    const mapped = mapLivingDocumentRow(row);
    const quote = row.quotes as
      | { reference?: string; customer?: { name?: string } }
      | null
      | undefined;
    return {
      ...mapped,
      customerName: quote?.customer?.name,
      quoteReference: quote?.reference,
    };
  });
}

export function LivingDocumentsInboxPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const role = awaitingRoleForUser(user?.role);

  useEffect(() => {
    const load = async () => {
      if (!role) {
        setLoading(false);
        return;
      }
      setLoading(true);

      try {
        if (role === 'installer') {
          const { data, error } = await supabase
            .from('quote_living_documents')
            .select('*, quotes(id, reference, customer)')
            .in('status', [
              'open',
              'awaiting_customer',
              'awaiting_engineer',
              'awaiting_compliance',
              'ready_for_pdf',
            ])
            .order('updated_at', { ascending: false });

          if (error) throw error;
          setRows(mapInboxRows((data || []) as Record<string, unknown>[]));
        } else if (role === 'engineer' && user?.id) {
          // Docs waiting for the engineer role, plus full packs for jobs assigned via scheduler
          const [{ data: assignedQuotes }, { data: pendingDocs, error: pendingError }] =
            await Promise.all([
              supabase
                .from('quotes')
                .select('id')
                .eq('assigned_engineer_id', user.id)
                .in('status', [
                  'scheduled',
                  'in_progress',
                  'commissioning',
                  'completed',
                  'compliance_review',
                ]),
              supabase
                .from('quote_living_documents')
                .select('*, quotes(id, reference, customer)')
                .eq('pending_role', 'engineer')
                .order('updated_at', { ascending: false }),
            ]);

          if (pendingError) throw pendingError;

          const assignedIds = (assignedQuotes || []).map((q) => q.id as string);
          let assignedDocs: Record<string, unknown>[] = [];
          if (assignedIds.length) {
            const { data, error } = await supabase
              .from('quote_living_documents')
              .select('*, quotes(id, reference, customer)')
              .in('quote_id', assignedIds)
              .order('updated_at', { ascending: false });
            if (error) throw error;
            assignedDocs = (data || []) as Record<string, unknown>[];
          }

          const byId = new Map<string, InboxRow>();
          for (const row of mapInboxRows([
            ...((pendingDocs || []) as Record<string, unknown>[]),
            ...assignedDocs,
          ])) {
            byId.set(row.id, row);
          }
          setRows(Array.from(byId.values()));
        } else {
          const { data, error } = await supabase
            .from('quote_living_documents')
            .select('*, quotes(id, reference, customer)')
            .eq('pending_role', role)
            .order('updated_at', { ascending: false });

          if (error) throw error;
          setRows(mapInboxRows((data || []) as Record<string, unknown>[]));
        }
      } catch (error) {
        console.error(error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [role, user?.id]);

  const base =
    user?.role === 'engineer'
      ? '/engineer'
      : user?.role === 'compliance_officer'
        ? '/compliance'
        : '/installer';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-400" />
          Documents to complete
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {role === 'engineer'
            ? 'Proposal packs for your assigned jobs, plus forms waiting for your section.'
            : 'Live proposal documents waiting for your part. PDFs generate only after all roles finish.'}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="spinner w-8 h-8" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-slate-400">No documents waiting for you right now.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((doc) => (
            <Card key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge className="bg-slate-700 text-slate-200 text-xs">{doc.templateCode}</Badge>
                  <Badge className="bg-primary-500/20 text-primary-300 text-xs">
                    {livingDocumentStatusLabel(doc.status)}
                  </Badge>
                </div>
                <p className="text-white font-medium">{doc.name}</p>
                <p className="text-sm text-slate-400">
                  {doc.customerName || 'Customer'} · {doc.quoteReference || doc.quoteId.slice(0, 8)}
                </p>
              </div>
              <Link to={`${base}/documents/${doc.quoteId}`}>
                <Button size="sm">Open</Button>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
