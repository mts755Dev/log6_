import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Search,
  Plus,
  Edit,
  Users,
  FileText,
  MoreVertical,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SubscriptionBadge, Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useData } from '../../contexts/DataContext';
import { format } from 'date-fns';

export function CompaniesPage() {
  const { companies, users, quotes } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCompanyStats = (companyId: string) => {
    const companyUsers = users.filter(u => u.companyId === companyId);
    const companyQuotes = quotes.filter(q => q.companyId === companyId);
    const totalValue = companyQuotes.reduce((sum, q) => sum + q.total, 0);
    return { userCount: companyUsers.length, quoteCount: companyQuotes.length, totalValue };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Companies</h1>
          <p className="page-subtitle">Manage installer companies and subscriptions</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />}>
          Add Company
        </Button>
      </div>

      {/* Search */}
      <Card padding="sm">
        <div className="max-w-md">
          <Input
            placeholder="Search companies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
      </Card>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCompanies.map((company, index) => {
          const stats = getCompanyStats(company.id);
          return (
            <motion.div
              key={company.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card 
                variant="hover" 
                className="h-full"
                onClick={() => setSelectedCompany(company.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center text-primary-400 font-bold text-lg">
                      {company.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{company.name}</h3>
                      <p className="text-sm text-slate-500">{company.email}</p>
                    </div>
                  </div>
                  <button className="p-1 text-slate-400 hover:text-white">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <SubscriptionBadge status={company.subscriptionStatus} />
                  <Badge variant="slate">{company.subscriptionTier}</Badge>
                  {company.isUmbrellaScheme && (
                    <Badge variant="primary">Umbrella</Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="p-2 bg-slate-800/50 rounded-lg text-center">
                    <p className="text-lg font-bold text-white">{stats.userCount}</p>
                    <p className="text-xs text-slate-500">Users</p>
                  </div>
                  <div className="p-2 bg-slate-800/50 rounded-lg text-center">
                    <p className="text-lg font-bold text-white">{stats.quoteCount}</p>
                    <p className="text-xs text-slate-500">Quotes</p>
                  </div>
                  <div className="p-2 bg-slate-800/50 rounded-lg text-center">
                    <p className="text-lg font-bold text-white">£{(stats.totalValue / 1000).toFixed(0)}k</p>
                    <p className="text-xs text-slate-500">Value</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-500">MCS Number</span>
                    <span className="text-slate-300">{company.mcsNumber || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subscription Ends</span>
                    <span className="text-slate-300">
                      {format(new Date(company.subscriptionEndDate), 'dd MMM yyyy')}
                    </span>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {filteredCompanies.length === 0 && (
        <Card className="text-center py-12">
          <Building2 className="w-12 h-12 mx-auto mb-4 text-slate-700" />
          <p className="text-slate-400">No companies found</p>
        </Card>
      )}
    </div>
  );
}

