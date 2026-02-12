// @ts-nocheck
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Eye, Search, CheckCircle, Clock, AlertCircle, XCircle, Calendar, DollarSign } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { format } from 'date-fns';
import type { Invoice, InvoiceStatus } from '../../types';

export function InstallerInvoicesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');

  useEffect(() => {
    if (user?.companyId) {
      fetchInvoices();
    }
  }, [user]);

  const fetchInvoices = async () => {
    if (!user?.companyId) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', user.companyId)
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
    subtotal: parseFloat(data.subtotal),
    vatRate: parseFloat(data.vat_rate),
    vatAmount: parseFloat(data.vat_amount),
    total: parseFloat(data.total),
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
      cancelled: <XCircle className="w-4 h-4" />,
    };
    return icons[status];
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    totalPending: invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.total, 0),
    totalPaid: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0),
    pendingCount: invoices.filter(i => i.status === 'pending').length,
    paidCount: invoices.filter(i => i.status === 'paid').length,
  };

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
        <h1 className="page-title">Invoices</h1>
        <p className="page-subtitle">Track deposit and final payment invoices</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Pending Payments</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">
                £{stats.totalPending.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">{stats.pendingCount} invoices</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Received Payments</p>
              <p className="text-2xl font-bold text-green-400 mt-1">
                £{stats.totalPaid.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">{stats.paidCount} invoices</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-400" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Invoices</p>
              <p className="text-2xl font-bold text-white mt-1">{invoices.length}</p>
            </div>
            <FileText className="w-8 h-8 text-primary-400" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">This Month</p>
              <p className="text-2xl font-bold text-white mt-1">
                {invoices.filter(i => {
                  const date = new Date(i.createdAt);
                  const now = new Date();
                  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                }).length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-primary-400" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by invoice ID or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all')}
            className="input"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </Card>

      {/* Invoices List */}
      <div className="space-y-4">
        {filteredInvoices.map((invoice) => (
          <motion.div
            key={invoice.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="hover:border-primary-500 transition-colors">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{invoice.id}</h3>
                    <Badge className={getStatusColor(invoice.status)}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(invoice.status)}
                        {invoice.status}
                      </span>
                    </Badge>
                    <Badge className={invoice.type === 'deposit' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}>
                      {invoice.type}
                    </Badge>
                  </div>
                  <p className="text-slate-400 mb-2">{invoice.customerName} • {invoice.customerEmail}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Issued: {format(new Date(invoice.issueDate), 'dd MMM yyyy')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Due: {format(new Date(invoice.dueDate), 'dd MMM yyyy')}
                    </span>
                    {invoice.paidAt && (
                      <span className="flex items-center gap-1 text-green-400">
                        <CheckCircle className="w-4 h-4" />
                        Paid: {format(new Date(invoice.paidAt), 'dd MMM yyyy')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">
                      £{invoice.total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-slate-400">
                      Inc. VAT £{invoice.vatAmount.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Eye className="w-4 h-4" />}
                    >
                      View
                    </Button>
                    {invoice.pdfUrl && (
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Download className="w-4 h-4" />}
                      >
                        PDF
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}

        {filteredInvoices.length === 0 && (
          <Card>
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No invoices found</h3>
              <p className="text-slate-400">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Invoices will be generated automatically when customers accept quotes'}
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
