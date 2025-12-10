import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Search, 
  FileText,
  Eye,
  Send,
  Trash2,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { QuoteStatusBadge } from '../../components/ui/Badge';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

export function QuotesListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { quotes, deleteQuote, updateQuote } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const myQuotes = quotes.filter(q => q.companyId === user?.companyId);

  const filteredQuotes = myQuotes.filter(quote => {
    const matchesSearch = 
      quote.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.customer.postcode.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && quote.status === activeTab;
  });

  const tabs = [
    { id: 'all', label: 'All', badge: myQuotes.length },
    { id: 'draft', label: 'Drafts', badge: myQuotes.filter(q => q.status === 'draft').length },
    { id: 'sent', label: 'Sent', badge: myQuotes.filter(q => q.status === 'sent').length },
    { id: 'accepted', label: 'Accepted', badge: myQuotes.filter(q => q.status === 'accepted').length },
    { id: 'rejected', label: 'Rejected', badge: myQuotes.filter(q => q.status === 'rejected').length },
  ];

  const handleSendQuote = (quoteId: string) => {
    updateQuote(quoteId, { 
      status: 'sent', 
      sentAt: new Date().toISOString() 
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header mb-0">
          <h1 className="page-title">My Quotes</h1>
          <p className="page-subtitle">Manage and track your quotes</p>
        </div>
        <Link to="/installer/quotes/new" className="w-full sm:w-auto">
          <Button leftIcon={<Plus className="w-4 h-4" />} className="w-full sm:w-auto justify-center">
            New Quote
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1 lg:max-w-md">
            <Input
              placeholder="Search by customer, reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="pills" />
          </div>
        </div>
      </Card>

      {/* Quotes List */}
      {filteredQuotes.length > 0 ? (
        <div className="space-y-4">
          {filteredQuotes.map((quote, index) => (
            <motion.div
              key={quote.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card variant="hover" onClick={() => navigate(`/installer/quotes/${quote.id}`)}>
                {/* Desktop Layout */}
                <div className="hidden sm:flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-500/10 rounded-xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-primary-400 text-sm">{quote.reference}</span>
                        <QuoteStatusBadge status={quote.status} />
                      </div>
                      <p className="font-medium text-white">{quote.customer.name}</p>
                      <p className="text-sm text-slate-500">
                        {quote.customer.postcode} • Created {format(new Date(quote.createdAt), 'dd MMM yyyy')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">£{quote.total.toLocaleString()}</p>
                      <p className="text-sm text-slate-500">
                        {quote.paybackYears} year payback
                      </p>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/installer/quotes/${quote.id}`)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {quote.status === 'draft' && (
                        <button
                          onClick={() => handleSendQuote(quote.id)}
                          className="p-2 text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors"
                          title="Send to customer"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      {quote.status === 'draft' && (
                        <button
                          onClick={() => deleteQuote(quote.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mobile Layout */}
                <div className="sm:hidden">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{quote.customer.name}</p>
                        <span className="font-mono text-primary-400 text-xs">{quote.reference}</span>
                      </div>
                    </div>
                    <QuoteStatusBadge status={quote.status} />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold text-white">£{quote.total.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">
                        {quote.customer.postcode} • {format(new Date(quote.createdAt), 'dd MMM')}
                      </p>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/installer/quotes/${quote.id}`)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {quote.status === 'draft' && (
                        <button
                          onClick={() => handleSendQuote(quote.id)}
                          className="p-2 text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors"
                          title="Send"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      {quote.status === 'draft' && (
                        <button
                          onClick={() => deleteQuote(quote.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="text-center py-16">
          <FileText className="w-12 h-12 mx-auto mb-4 text-slate-700" />
          <p className="text-slate-400 mb-2">
            {searchTerm ? 'No quotes match your search' : 'No quotes yet'}
          </p>
          {!searchTerm && (
            <Link to="/installer/quotes/new">
              <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                Create Your First Quote
              </Button>
            </Link>
          )}
        </Card>
      )}
    </div>
  );
}
