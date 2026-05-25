import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Search, 
  FileText,
  Eye,
  Send,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { QuoteStatusBadge } from '../../components/ui/Badge';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { generateAllProposalPdfs } from '../../services/proposalPdfGenerator';

export function QuotesListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { quotes, deleteQuote, updateQuote, canCreateQuote, deductQuoteCredit, refreshData } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch fresh data when component mounts
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await refreshData();
      } catch (error) {
        console.error('Error loading quotes:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [refreshData]);

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
    { id: 'deposit_paid', label: 'Deposits Paid', badge: myQuotes.filter(q => q.status === 'deposit_paid').length },
    { id: 'rejected', label: 'Rejected', badge: myQuotes.filter(q => q.status === 'rejected').length },
  ];

  const handleSendQuote = async (quoteId: string) => {
    if (!user || !user.companyId) return;

    try {
      // Check eligibility
      const eligibility = await canCreateQuote(user.companyId);
      if (!eligibility.canCreate) {
        toast.error(eligibility.reason || 'Unable to send quote');
        return;
      }

      // Find the quote object
      const quote = quotes.find(q => q.id === quoteId);
      if (!quote) {
        toast.error('Quote not found');
        return;
      }

      toast.info('Generating proposal pack...', 3000);

      // 🎯 STEP 1: Generate all proposal PDFs
      const pdfResult = await generateAllProposalPdfs(quote, user.companyId);
      
      if (!pdfResult.success) {
        console.error('PDF generation errors:', pdfResult.errors);
        toast.error('Some PDFs failed to generate, but continuing...');
      }

      // 🎯 STEP 2: Create document records for generated PDFs
      for (const pdf of pdfResult.generatedPdfs) {
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .insert({
            name: pdf.fileName,
            description: `Auto-generated ${pdf.code} for quote ${quote.id.slice(0, 8)}`,
            category: 'template',
            file_url: pdf.fileUrl,
            file_name: pdf.fileName,
            version: 1,
          })
          .select()
          .single();

        if (!docError && docData) {
          await supabase
            .from('quote_documents')
            .insert({
              quote_id: quoteId,
              document_id: docData.id,
            });
        }
      }

      // 🎯 STEP 3: Auto-attach Document Bank documents
      const { error: attachError } = await supabase.rpc('attach_documents_to_quote', {
        p_quote_id: quoteId
      });

      if (attachError) {
        console.error('Error attaching Document Bank files:', attachError);
      }

      // 🎯 STEP 4: Generate share token if needed
      let shareToken = quote.share_token;
      if (!shareToken) {
        const { data: tokenData, error: tokenError } = await supabase
          .rpc('generate_quote_share_token');

        if (tokenError) throw tokenError;
        shareToken = tokenData as string;
      }

      // 🎯 STEP 5: Update quote status
      await updateQuote(quoteId, { 
        status: 'sent', 
        sentAt: new Date().toISOString(),
        share_token: shareToken
      });

      // 🎯 STEP 6: Deduct credit (draft → sent only)
      if (quote.status === 'draft') {
        await deductQuoteCredit(user.companyId);
      }

      await refreshData();

      const totalDocs = pdfResult.generatedPdfs.length + (attachError ? 0 : 2);
      toast.success(`🎉 Quote sent with ${totalDocs} documents in proposal pack!`);
      
    } catch (error) {
      console.error('Error sending quote:', error);
      toast.error('Failed to send quote. Please try again.');
    }
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
      {isLoading ? (
        // Skeleton Loading
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <div className="animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-slate-700 rounded-xl" />
                    <div className="flex-1">
                      <div className="h-4 bg-slate-700 rounded w-32 mb-2" />
                      <div className="h-5 bg-slate-700 rounded w-48 mb-2" />
                      <div className="h-3 bg-slate-700 rounded w-64" />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="h-6 bg-slate-700 rounded w-24 mb-2" />
                    <div className="h-4 bg-slate-700 rounded w-32" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredQuotes.length > 0 ? (
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
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>{quote.customer.postcode}</span>
                        <span>•</span>
                        <span>Created {format(new Date(quote.createdAt), 'dd MMM yyyy')}</span>
                        {quote.viewedAt && quote.status === 'viewed' && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-primary-400">
                              <Eye className="w-3 h-3" />
                              Viewed {format(new Date(quote.viewedAt), 'dd MMM')}
                            </span>
                          </>
                        )}
                        {quote.depositPaidAt && quote.status === 'deposit_paid' && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-success-400">
                              <CheckCircle2 className="w-3 h-3" />
                              Deposit Paid {format(new Date(quote.depositPaidAt), 'dd MMM')}
                            </span>
                          </>
                        )}
                      </div>
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
                          onClick={async () => {
                            try {
                              await deleteQuote(quote.id);
                            } catch (error) {
                              console.error('Error deleting quote:', error);
                            }
                          }}
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
                      <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                        <span>{quote.customer.postcode}</span>
                        <span>•</span>
                        <span>{format(new Date(quote.createdAt), 'dd MMM')}</span>
                        {quote.viewedAt && quote.status === 'viewed' && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-primary-400">
                              <Eye className="w-3 h-3" />
                              Viewed
                            </span>
                          </>
                        )}
                        {quote.depositPaidAt && quote.status === 'deposit_paid' && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-success-400">
                              <CheckCircle2 className="w-3 h-3" />
                              Deposit Paid
                            </span>
                          </>
                        )}
                      </div>
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
                          onClick={async () => {
                            try {
                              await deleteQuote(quote.id);
                            } catch (error) {
                              console.error('Error deleting quote:', error);
                            }
                          }}
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
