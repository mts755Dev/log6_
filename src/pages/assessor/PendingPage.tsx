import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ClipboardCheck, 
  ArrowRight,
  Calendar,
  Battery,
  User,
  Building2,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { CommissionStatusBadge } from '../../components/ui/Badge';
import { useData } from '../../contexts/DataContext';
import { format } from 'date-fns';

export function PendingPage() {
  const { commissions } = useData();
  const pendingSubmissions = commissions.filter(c => c.status === 'pending_review');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Pending Reviews</h1>
        <p className="page-subtitle">{pendingSubmissions.length} submissions awaiting review</p>
      </div>

      {/* Submissions List */}
      {pendingSubmissions.length > 0 ? (
        <div className="space-y-4">
          {pendingSubmissions.map((commission, index) => (
            <motion.div
              key={commission.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card variant="hover">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-warning-500/20 rounded-xl flex items-center justify-center">
                      <ClipboardCheck className="w-6 h-6 text-warning-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-white">{commission.siteDetails.customerName}</h3>
                        <CommissionStatusBadge status={commission.status} />
                      </div>
                      <div className="text-sm text-slate-400 space-y-1">
                        <p className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {commission.installerName}
                        </p>
                        <p className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          {commission.companyName}
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
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Site</p>
                      <p className="text-white">{commission.siteDetails.postcode}</p>
                    </div>
                    <Link
                      to={`/assessor/review/${commission.id}`}
                      className="btn-primary"
                    >
                      Review
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="text-center py-16">
          <ClipboardCheck className="w-16 h-16 mx-auto mb-4 text-success-500" />
          <h3 className="text-xl font-semibold text-white mb-2">All Caught Up!</h3>
          <p className="text-slate-400">No submissions pending review at this time.</p>
        </Card>
      )}
    </div>
  );
}

