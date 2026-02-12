// @ts-nocheck
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Wrench,
  Calendar,
  Clock,
  CheckCircle,
  Upload,
  FileText,
  MapPin,
  User,
  ArrowRight,
} from 'lucide-react';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { format } from 'date-fns';

interface EngineerJob {
  quote_id: string;
  reference: string;
  customer_name: string;
  customer_address: string;
  company_name: string;
  installation_date: string | null;
  status: string;
  documents_count: number;
  installation_completed_at: string | null;
}

export function EngineerDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [jobs, setJobs] = useState<EngineerJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchJobs();
    }
  }, [user]);

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.rpc('get_engineer_jobs', {
        p_engineer_id: user?.id,
      });

      if (error) throw error;

      setJobs(data || []);
    } catch (error: any) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const scheduledJobs = jobs.filter((j) => j.status === 'scheduled');
  const inProgressJobs = jobs.filter((j) => j.status === 'in_progress');
  const completedJobs = jobs.filter((j) => j.status === 'completed' || j.status === 'commissioning');
  const submittedJobs = jobs.filter((j) => j.status === 'compliance_review');

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500',
      in_progress: 'bg-orange-500/20 text-orange-400 border-orange-500',
      completed: 'bg-green-500/20 text-green-400 border-green-500',
      commissioning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500',
      compliance_review: 'bg-purple-500/20 text-purple-400 border-purple-500',
    };
    return colors[status] || 'bg-slate-500/20 text-slate-400 border-slate-500';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      completed: 'Upload Docs',
      commissioning: 'Uploading',
      compliance_review: 'Under Review',
    };
    return labels[status] || status;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-slate-400">Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Engineer Dashboard</h1>
        <p className="page-subtitle">Manage your installations and upload commissioning documents</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Scheduled"
          value={scheduledJobs.length}
          change="Upcoming installations"
          changeType="neutral"
          icon={<Calendar className="w-6 h-6 text-blue-400" />}
        />
        <StatCard
          title="In Progress"
          value={inProgressJobs.length}
          change="Active jobs"
          changeType="warning"
          icon={<Wrench className="w-6 h-6 text-orange-400" />}
        />
        <StatCard
          title="Awaiting Docs"
          value={completedJobs.length}
          change="Ready to upload"
          changeType="positive"
          icon={<Upload className="w-6 h-6 text-green-400" />}
        />
        <StatCard
          title="Under Review"
          value={submittedJobs.length}
          change="Compliance checking"
          changeType="neutral"
          icon={<CheckCircle className="w-6 h-6 text-purple-400" />}
        />
      </div>

      {/* Jobs List */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">My Jobs</h2>
          <Button variant="secondary" size="sm" onClick={fetchJobs}>
            Refresh
          </Button>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-12">
            <Wrench className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-lg text-white font-semibold mb-2">No jobs assigned</p>
            <p className="text-slate-400">Check back later for new installations</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <motion.div
                key={job.quote_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-primary-500/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-white">{job.reference}</h3>
                      <Badge className={getStatusColor(job.status)}>
                        {getStatusLabel(job.status)}
                      </Badge>
                      {job.documents_count > 0 && (
                        <Badge className="bg-slate-700 text-slate-300">
                          <FileText className="w-3 h-3 mr-1" />
                          {job.documents_count} docs
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-start gap-2">
                        <User className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-slate-500">Customer</p>
                          <p className="text-white font-medium">{job.customer_name}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-slate-500">Address</p>
                          <p className="text-white">{job.customer_address}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-slate-500">Installation Date</p>
                          <p className="text-white">
                            {job.installation_date
                              ? format(new Date(job.installation_date), 'dd MMM yyyy')
                              : 'Not scheduled'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {job.installation_completed_at && (
                      <div className="mt-2 text-sm text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Completed {format(new Date(job.installation_completed_at), 'dd MMM yyyy, HH:mm')}
                      </div>
                    )}
                  </div>

                  <div className="ml-4">
                    <Link to={`/engineer/job/${job.quote_id}`}>
                      <Button
                        variant={
                          job.status === 'completed' || job.status === 'commissioning'
                            ? 'primary'
                            : 'secondary'
                        }
                        size="sm"
                        leftIcon={
                          job.status === 'completed' || job.status === 'commissioning' ? (
                            <Upload className="w-4 h-4" />
                          ) : (
                            <ArrowRight className="w-4 h-4" />
                          )
                        }
                      >
                        {job.status === 'completed' || job.status === 'commissioning'
                          ? 'Upload Docs'
                          : 'View Details'}
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Tips */}
      <Card>
        <h3 className="text-lg font-bold text-white mb-4">📋 Commissioning Checklist</h3>
        <div className="space-y-2 text-sm text-slate-300">
          <p className="flex items-start gap-2">
            <span className="text-primary-400 font-bold">1.</span>
            <span>Complete installation and test all systems</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-primary-400 font-bold">2.</span>
            <span>Take photos of installation (before, during, after)</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-primary-400 font-bold">3.</span>
            <span>Upload all test certificates and commissioning forms</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-primary-400 font-bold">4.</span>
            <span>Submit for compliance review</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-primary-400 font-bold">5.</span>
            <span>Wait for approval (usually within 48 hours)</span>
          </p>
        </div>
      </Card>
    </div>
  );
}
