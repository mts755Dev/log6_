import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ClipboardCheck, 
  Plus,
  Search,
  Calendar,
  Battery,
  Home,
  ArrowRight,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { CommissionStatusBadge } from '../../components/ui/Badge';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

export function CommissionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { commissions } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const myCommissions = commissions.filter(c => c.companyId === user?.companyId);

  const filteredCommissions = myCommissions.filter(comm => {
    const matchesSearch = 
      comm.siteDetails.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comm.siteDetails.postcode.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && comm.status === activeTab;
  });

  const tabs = [
    { id: 'all', label: 'All', badge: myCommissions.length },
    { id: 'pending_review', label: 'Pending', badge: myCommissions.filter(c => c.status === 'pending_review').length },
    { id: 'approved', label: 'Approved', badge: myCommissions.filter(c => c.status === 'approved').length },
    { id: 'requires_changes', label: 'Changes Required', badge: myCommissions.filter(c => c.status === 'requires_changes').length },
    { id: 'rejected', label: 'Rejected', badge: myCommissions.filter(c => c.status === 'rejected').length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Commissioning Submissions</h1>
          <p className="page-subtitle">Track your umbrella scheme submissions</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />}>
          New Submission
        </Button>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] max-w-md">
            <Input
              placeholder="Search by customer or postcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="pills" />
        </div>
      </Card>

      {/* Submissions List */}
      {filteredCommissions.length > 0 ? (
        <div className="space-y-4">
          {filteredCommissions.map((commission, index) => (
            <motion.div
              key={commission.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card variant="hover">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center">
                      <ClipboardCheck className="w-6 h-6 text-primary-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-white">{commission.siteDetails.customerName}</h3>
                        <CommissionStatusBadge status={commission.status} />
                      </div>
                      <div className="text-sm text-slate-400 space-y-1">
                        <p className="flex items-center gap-2">
                          <Home className="w-4 h-4" />
                          {commission.siteDetails.address}, {commission.siteDetails.postcode}
                        </p>
                        <p className="flex items-center gap-2">
                          <Battery className="w-4 h-4" />
                          {commission.systemDetails.batteryModel} ({commission.systemDetails.capacityKwh}kWh)
                        </p>
                        <p className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Submitted {format(new Date(commission.submittedAt), 'dd MMM yyyy')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {commission.rejectionReason && (
                      <div className="max-w-xs p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-xs text-red-400">{commission.rejectionReason}</p>
                      </div>
                    )}
                    {commission.certificateId && (
                      <Button variant="secondary" size="sm">
                        View Certificate
                      </Button>
                    )}
                    <button className="p-2 text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors">
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="text-center py-16">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-4 text-slate-700" />
          <p className="text-slate-400 mb-4">
            {searchTerm ? 'No submissions match your search' : 'No commissioning submissions yet'}
          </p>
          {!searchTerm && (
            <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>
              Create First Submission
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}

