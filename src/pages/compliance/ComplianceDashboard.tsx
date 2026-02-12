// @ts-nocheck
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Eye,
  Calendar,
} from 'lucide-react';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { format } from 'date-fns';

interface PendingReview {
  quote_id: string;
  reference: string;
  company_name: string;
  customer_name: string;
  installation_completed_at: string | null;
  commissioning_uploaded_at: string | null;
  documents_count: number;
  pending_documents: number;
}

export function ComplianceDashboard() {
  const toast = useToast();
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPendingReviews();
  }, []);

  const fetchPendingReviews = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.rpc('get_pending_compliance_reviews');

      if (error) throw error;

      setPendingReviews(data || []);
    } catch (error: any) {
      console.error('Error fetching pending reviews:', error);
      toast.error('Failed to load pending reviews');
    } finally {
      setIsLoading(false);
    }
  };

  const urgentReviews = pendingReviews.filter(
    (r) =>
      r.commissioning_uploaded_at &&
      Date.now() - new Date(r.commissioning_uploaded_at).getTime() > 48 * 60 * 60 * 1000
  );

  const todayReviews = pendingReviews.filter(
    (r) =>
      r.commissioning_uploaded_at &&
      new Date(r.commissioning_uploaded_at).toDateString() === new Date().toDateString()
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-slate-400">Loading reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Compliance Dashboard</h1>
        <p className="page-subtitle">Review and approve installation commissioning</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Pending Reviews"
          value={pendingReviews.length}
          change={`${todayReviews.length} uploaded today`}
          changeType="neutral"
          icon={<Clock className="w-6 h-6 text-yellow-400" />}
        />
        <StatCard
          title="Urgent (>48h)"
          value={urgentReviews.length}
          change="Requires immediate attention"
          changeType="warning"
          icon={<AlertCircle className="w-6 h-6 text-red-400" />}
        />
        <StatCard
          title="Total Documents"
          value={pendingReviews.reduce((sum, r) => sum + r.documents_count, 0)}
          change="Awaiting review"
          changeType="neutral"
          icon={<ClipboardCheck className="w-6 h-6 text-blue-400" />}
        />
        <StatCard
          title="Avg Response Time"
          value="24h"
          change="Target: <48h"
          changeType="positive"
          icon={<TrendingUp className="w-6 h-6 text-green-400" />}
        />
      </div>

      {/* Pending Reviews List */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Pending Reviews</h2>
          <Button variant="secondary" size="sm" onClick={fetchPendingReviews}>
            Refresh
          </Button>
        </div>

        {pendingReviews.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-lg text-white font-semibold mb-2">All caught up!</p>
            <p className="text-slate-400">No installations awaiting compliance review</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingReviews.map((review) => {
              const isUrgent =
                review.commissioning_uploaded_at &&
                Date.now() - new Date(review.commissioning_uploaded_at).getTime() >
                  48 * 60 * 60 * 1000;

              const daysAgo = review.commissioning_uploaded_at
                ? Math.floor(
                    (Date.now() - new Date(review.commissioning_uploaded_at).getTime()) /
                      (24 * 60 * 60 * 1000)
                  )
                : null;

              return (
                <motion.div
                  key={review.quote_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-slate-800/50 rounded-lg p-4 border ${
                    isUrgent ? 'border-red-500/30' : 'border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">
                          {review.reference}
                        </h3>
                        {isUrgent && (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Urgent
                          </Badge>
                        )}
                        {review.pending_documents > 0 && (
                          <Badge className="bg-yellow-500/20 text-yellow-400">
                            {review.pending_documents} pending
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Company</p>
                          <p className="text-white">{review.company_name}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Customer</p>
                          <p className="text-white">{review.customer_name}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Installation Date</p>
                          <p className="text-white">
                            {review.installation_completed_at
                              ? format(
                                  new Date(review.installation_completed_at),
                                  'dd MMM yyyy'
                                )
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Uploaded</p>
                          <p className="text-white">
                            {daysAgo !== null
                              ? daysAgo === 0
                                ? 'Today'
                                : `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`
                              : 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                        <ClipboardCheck className="w-4 h-4" />
                        <span>
                          {review.documents_count} document
                          {review.documents_count !== 1 ? 's' : ''} submitted
                        </span>
                      </div>
                    </div>

                    <Link to={`/compliance/review/${review.quote_id}`}>
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Eye className="w-4 h-4" />}
                      >
                        Review
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Today's Reviews</p>
              <p className="text-2xl font-bold text-white">{todayReviews.length}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Approved This Week</p>
              <p className="text-2xl font-bold text-white">12</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Rejected This Week</p>
              <p className="text-2xl font-bold text-white">2</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
