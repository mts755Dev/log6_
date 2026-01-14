import { useState, useEffect } from 'react';
import { FileText, Eye, Download, Search, Filter, Calendar, Building2, User } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface Quote {
  id: string;
  reference: string;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected';
  installation_type: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  total: number;
  created_at: string;
  sent_at?: string;
  company_id: string;
  installer_id: string;
  installer_name: string;
  company?: {
    name: string;
  };
}

export function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          company:companies(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setQuotes(data || []);
    } catch (error: any) {
      console.error('Error fetching quotes:', error);
      toast.error('Failed to load quotes');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch =
      quote.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.installer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.company?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'slate' | 'primary' | 'success' | 'warning' | 'danger'> = {
      draft: 'slate',
      sent: 'primary',
      viewed: 'warning',
      accepted: 'success',
      rejected: 'danger',
    };
    return <Badge variant={variants[status] || 'slate'}>{status}</Badge>;
  };

  const stats = {
    total: quotes.length,
    draft: quotes.filter((q) => q.status === 'draft').length,
    sent: quotes.filter((q) => q.status === 'sent').length,
    accepted: quotes.filter((q) => q.status === 'accepted').length,
    rejected: quotes.filter((q) => q.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">All Quotes</h1>
          <p className="page-subtitle">View and manage all quotes from all installers</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-sm text-slate-400">Total Quotes</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-400">Drafts</p>
          <p className="text-2xl font-bold text-slate-300 mt-1">{stats.draft}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-400">Sent</p>
          <p className="text-2xl font-bold text-primary-400 mt-1">{stats.sent}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-400">Accepted</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{stats.accepted}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-400">Rejected</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{stats.rejected}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by reference, customer, installer, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === 'all' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              All
            </Button>
            <Button
              variant={statusFilter === 'draft' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter('draft')}
            >
              Drafts
            </Button>
            <Button
              variant={statusFilter === 'sent' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter('sent')}
            >
              Sent
            </Button>
            <Button
              variant={statusFilter === 'accepted' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter('accepted')}
            >
              Accepted
            </Button>
          </div>
        </div>
      </Card>

      {/* Quotes List */}
      <Card>
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-slate-400">Loading quotes...</p>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-300 font-medium mb-2">
              {searchTerm || statusFilter !== 'all' ? 'No quotes found' : 'No quotes yet'}
            </p>
            <p className="text-slate-500 text-sm">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Quotes created by installers will appear here'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Quote
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Installer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredQuotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/admin/quotes/${quote.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary-400" />
                        <span className="text-sm font-medium text-white">{quote.reference}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-white">{quote.customer.name}</div>
                      <div className="text-xs text-slate-400">{quote.customer.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-300">{quote.company?.name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-300">{quote.installer_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-300 capitalize">
                        {quote.installation_type?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-white">
                        £{quote.total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(quote.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Calendar className="w-3 h-3" />
                        {new Date(quote.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Eye className="w-4 h-4" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/quotes/${quote.id}`);
                        }}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
