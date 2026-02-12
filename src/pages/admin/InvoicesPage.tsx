import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Receipt,
  Eye,
  Download,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Calendar,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { format } from 'date-fns';
import type { Invoice, InvoiceStatus, InvoiceType } from '../../types';

export function InvoicesPage() {
  const toast = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<InvoiceType | 'all'>('all');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedInvoices = (data || []).map(mapInvoice);
      setInvoices(mappedInvoices);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  };

  const mapInvoice = (data: any): Invoice => ({
    id: data.id,
    quoteId: data.quote_id,
    companyId: data.company_id,
    type: data.type,
    customerName: data.customer_name,
    customerEmail: data.customer_email,
    customerPhone: data.customer_phone,
    customerAddress: data.customer_address,
    subtotal: data.subtotal,
    vatRate: data.vat_rate,
    vatAmount: data.vat_amount,
    total: data.total,
    lineItems: data.line_items || [],
    status: data.status,
    paymentMethod: data.payment_method,
    paidAt: data.paid_at,
    stripePaymentIntentId: data.stripe_payment_intent_id,
    issueDate: data.issue_date,
    dueDate: data.due_date,
    pdfUrl: data.pdf_url,
    sentAt: data.sent_at,
    viewedAt: data.viewed_at,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });

  const getStatusColor = (status: InvoiceStatus) => {
    const colors = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      paid: 'bg-green-500/20 text-green-400',
      overdue: 'bg-red-500/20 text-red-400',
      cancelled: 'bg-slate-500/20 text-slate-400',
    };
    return colors[status];
  };

  const getStatusIcon = (status: InvoiceStatus) => {
    const icons = {
      pending: <Clock className="w-4 h-4" />,
      paid: <CheckCircle className="w-4 h-4" />,
      overdue: <AlertCircle className="w-4 h-4" />,
      cancelled: <AlertCircle className="w-4 h-4" />,
    };
    return icons[status];
  };

  const getTypeColor = (type: InvoiceType) => {
    const colors = {
      deposit: 'bg-blue-500/20 text-blue-400',
      final: 'bg-purple-500/20 text-purple-400',
    };
    return colors[type];
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    const matchesType = typeFilter === 'all' || invoice.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalRevenue = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + i.total, 0);
  const pendingRevenue = invoices
    .filter((i) => i.status === 'pending')
    .reduce((sum, i) => sum + i.total, 0);
  const overdueRevenue = invoices
    .filter((i) => i.status === 'overdue')
    .reduce((sum, i) => sum + i.total, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-slate-400">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Invoice Management</h1>
        <p className="page-subtitle">View and manage all system invoices</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">Total Revenue (Paid)</p>
              <p className="text-2xl font-bold text-green-400">£{totalRevenue.toFixed(2)}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">Pending Invoices</p>
              <p className="text-2xl font-bold text-yellow-400">£{pendingRevenue.toFixed(2)}</p>
            </div>
            <Clock className="w-10 h-10 text-yellow-400" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">Overdue Invoices</p>
              <p className="text-2xl font-bold text-red-400">£{overdueRevenue.toFixed(2)}</p>
            </div>
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Input
              leftIcon={<Search className="w-5 h-5" />}
              placeholder="Search by customer or invoice ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all')}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as InvoiceType | 'all')}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
          >
            <option value="all">All Types</option>
            <option value="deposit">Deposit</option>
            <option value="final">Final</option>
          </select>
        </div>
      </Card>

      {/* Invoices List */}
      <div className="space-y-4">
        {filteredInvoices.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No invoices found</p>
            </div>
          </Card>
        ) : (
          filteredInvoices.map((invoice) => (
            <motion.div key={invoice.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Receipt className="w-5 h-5 text-primary-400" />
                      <h3 className="text-lg font-semibold text-white">{invoice.customerName}</h3>
                      <Badge className={getTypeColor(invoice.type)}>
                        {invoice.type} Invoice
                      </Badge>
                      <Badge className={getStatusColor(invoice.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(invoice.status)}
                          {invoice.status}
                        </span>
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-slate-400">
                      <div>
                        <p className="text-slate-500">Invoice ID</p>
                        <p className="text-white font-mono">{invoice.id.slice(0, 8)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Amount</p>
                        <p className="text-white font-semibold">£{invoice.total.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Issue Date</p>
                        <p className="text-white">{format(new Date(invoice.issueDate), 'dd MMM yyyy')}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Due Date</p>
                        <p className="text-white">{format(new Date(invoice.dueDate), 'dd MMM yyyy')}</p>
                      </div>
                    </div>

                    {invoice.paidAt && (
                      <div className="mt-2 text-sm text-green-400">
                        ✓ Paid on {format(new Date(invoice.paidAt), 'dd MMM yyyy HH:mm')}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Eye className="w-4 h-4" />}
                      onClick={() => window.open(`/invoice/${invoice.id}`, '_blank')}
                    >
                      View
                    </Button>
                    {invoice.pdfUrl && (
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Download className="w-4 h-4" />}
                        onClick={() => window.open(invoice.pdfUrl!, '_blank')}
                      >
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
