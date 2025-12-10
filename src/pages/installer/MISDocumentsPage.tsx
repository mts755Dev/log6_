import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Plus,
  Search,
  FileText,
  Download,
  Eye,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

export function MISDocumentsPage() {
  const { user } = useAuth();
  const { misDocuments, quotes } = useData();
  const [searchTerm, setSearchTerm] = useState('');

  const myDocuments = misDocuments.filter(d => d.companyId === user?.companyId);

  const filteredDocuments = myDocuments.filter(doc =>
    doc.systemDetails.batteryModel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get quotes that could have MIS documents generated
  const quotesForMIS = quotes.filter(q => 
    q.companyId === user?.companyId && 
    q.status === 'accepted'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">MIS-3002 Documents</h1>
          <p className="page-subtitle">Generate and manage compliance paperwork</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />}>
          New Document
        </Button>
      </div>

      {/* Info Card */}
      <Card className="border-primary-500/30 bg-primary-500/5">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary-500/20 rounded-xl">
            <Shield className="w-6 h-6 text-primary-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">MIS-3002 Compliance</h3>
            <p className="text-sm text-slate-400">
              The MIS-3002 (now MCS 012) is the installation standard for battery storage systems. 
              Generate compliant documentation automatically from your accepted quotes.
            </p>
          </div>
        </div>
      </Card>

      {/* Search */}
      <Card padding="sm">
        <div className="max-w-md">
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
      </Card>

      {/* Accepted Quotes Ready for MIS */}
      {quotesForMIS.length > 0 && (
        <div>
          <h3 className="section-title">Ready for MIS Documentation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quotesForMIS.map((quote, index) => (
              <motion.div
                key={quote.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card variant="hover" className="h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-primary-400 font-mono">{quote.reference}</p>
                      <h4 className="font-medium text-white">{quote.customer.name}</h4>
                    </div>
                    <Badge variant="success">Accepted</Badge>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">
                    {quote.customer.postcode}
                  </p>
                  <Button variant="secondary" size="sm" className="w-full">
                    Generate MIS-3002
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Documents */}
      <div>
        <h3 className="section-title">Generated Documents</h3>
        {filteredDocuments.length > 0 ? (
          <div className="space-y-4">
            {filteredDocuments.map((doc, index) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card variant="hover">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-success-500/20 rounded-xl flex items-center justify-center">
                        <FileText className="w-6 h-6 text-success-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{doc.systemDetails.batteryModel}</h4>
                        <p className="text-sm text-slate-500">
                          {doc.systemDetails.batteryCapacity}kWh • Created {format(new Date(doc.createdAt), 'dd MMM yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={doc.status === 'completed' ? 'success' : doc.status === 'approved' ? 'success' : 'warning'}>
                        {doc.status === 'completed' ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Complete
                          </span>
                        ) : doc.status === 'approved' ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Draft
                          </span>
                        )}
                      </Badge>
                      <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <Shield className="w-12 h-12 mx-auto mb-4 text-slate-700" />
            <p className="text-slate-400 mb-2">No MIS-3002 documents generated yet</p>
            <p className="text-sm text-slate-500">Accept a quote to generate compliance documentation</p>
          </Card>
        )}
      </div>
    </div>
  );
}

