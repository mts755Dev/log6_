import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  XCircle, 
  Clock,
  AlertTriangle,
  ArrowRight,
  Eye,
  Award,
} from 'lucide-react';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { CommissionStatusBadge } from '../../components/ui/Badge';
import { format } from 'date-fns';

export function AssessorDashboard() {
  const { user } = useAuth();
  const { commissions, certificates } = useData();

  const pendingReviews = commissions.filter(c => c.status === 'pending_review');
  const approved = commissions.filter(c => c.status === 'approved');
  const rejected = commissions.filter(c => c.status === 'rejected');
  const requiresChanges = commissions.filter(c => c.status === 'requires_changes');

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header mb-0">
          <h1 className="page-title">Assessor Dashboard</h1>
          <p className="page-subtitle">Umbrella scheme review and approval</p>
        </div>
        {pendingReviews.length > 0 && (
          <Link to="/assessor/pending" className="w-full sm:w-auto">
            <Button leftIcon={<Eye className="w-4 h-4" />} className="w-full sm:w-auto justify-center">
              Review Pending ({pendingReviews.length})
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Pending Review"
          value={pendingReviews.length}
          change="Requires attention"
          changeType={pendingReviews.length > 0 ? 'negative' : 'neutral'}
          icon={<Clock className="w-6 h-6" />}
        />
        <StatCard
          title="Approved"
          value={approved.length}
          change="This month"
          changeType="positive"
          icon={<CheckCircle2 className="w-6 h-6" />}
        />
        <StatCard
          title="Rejected"
          value={rejected.length}
          change="Total rejected"
          changeType="negative"
          icon={<XCircle className="w-6 h-6" />}
        />
        <StatCard
          title="Certificates Issued"
          value={certificates.length}
          change="All time"
          changeType="neutral"
          icon={<Award className="w-6 h-6" />}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Reviews List */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="section-title mb-0">Pending Reviews</h3>
              <p className="text-sm text-slate-500">Submissions awaiting your review</p>
            </div>
            <Link to="/assessor/pending" className="text-sm text-primary-400 hover:text-primary-300">
              View all
            </Link>
          </div>

          {pendingReviews.length > 0 ? (
            <div className="space-y-4">
              {pendingReviews.map((commission) => (
                <motion.div
                  key={commission.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-slate-800/30 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium text-white">{commission.siteDetails.customerName}</h4>
                        <CommissionStatusBadge status={commission.status} />
                      </div>
                      <p className="text-sm text-slate-400 mb-1">
                        {commission.siteDetails.address}, {commission.siteDetails.postcode}
                      </p>
                      <p className="text-sm text-slate-500">
                        {commission.systemDetails.batteryModel} • {commission.systemDetails.capacityKwh}kWh
                      </p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 text-xs text-slate-500">
                        <span>Installer: {commission.installerName}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>Company: {commission.companyName}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>Submitted: {format(new Date(commission.submittedAt), 'dd MMM')}</span>
                      </div>
                    </div>
                    <Link
                      to={`/assessor/review/${commission.id}`}
                      className="btn-primary text-sm"
                    >
                      Review
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-success-500" />
              <p className="text-slate-400 mb-2">All caught up!</p>
              <p className="text-sm text-slate-500">No submissions pending review</p>
            </div>
          )}
        </Card>

        {/* Quick Stats & Actions */}
        <div className="space-y-6">
          {/* Requires Changes */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-warning-500/20 rounded-lg text-warning-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-white">Requires Changes</h3>
                <p className="text-sm text-slate-500">{requiresChanges.length} submissions</p>
              </div>
            </div>
            {requiresChanges.length > 0 ? (
              <div className="space-y-2">
                {requiresChanges.slice(0, 3).map((commission) => (
                  <div key={commission.id} className="p-3 bg-slate-800/30 rounded-lg">
                    <p className="text-sm text-white">{commission.siteDetails.customerName}</p>
                    <p className="text-xs text-slate-500">{commission.companyName}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No pending changes</p>
            )}
          </Card>

          {/* Recent Activity */}
          <Card>
            <h3 className="section-title">Recent Activity</h3>
            <div className="space-y-4">
              {approved.slice(0, 4).map((commission) => (
                <div key={commission.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-success-500/20 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-success-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{commission.siteDetails.customerName}</p>
                    <p className="text-xs text-slate-500">
                      {commission.reviewedAt 
                        ? format(new Date(commission.reviewedAt), 'dd MMM yyyy')
                        : 'Recently approved'}
                    </p>
                  </div>
                </div>
              ))}
              {approved.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No recent approvals</p>
              )}
            </div>
          </Card>

          {/* Quick Links */}
          <Card>
            <h3 className="section-title">Quick Links</h3>
            <div className="space-y-2">
              <Link
                to="/assessor/approved"
                className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors"
              >
                <span className="text-sm text-slate-300">View Approved</span>
                <ArrowRight className="w-4 h-4 text-slate-600" />
              </Link>
              <Link
                to="/assessor/rejected"
                className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors"
              >
                <span className="text-sm text-slate-300">View Rejected</span>
                <ArrowRight className="w-4 h-4 text-slate-600" />
              </Link>
              <Link
                to="/assessor/certificates"
                className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors"
              >
                <span className="text-sm text-slate-300">All Certificates</span>
                <ArrowRight className="w-4 h-4 text-slate-600" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

