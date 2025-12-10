import { motion } from 'framer-motion';
import { 
  Building2, 
  Users, 
  FileText, 
  TrendingUp,
  ClipboardCheck,
  Award,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, StatCard } from '../../components/ui/Card';
import { useData } from '../../contexts/DataContext';
import { QuoteStatusBadge, SubscriptionBadge } from '../../components/ui/Badge';
import { format } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const monthlyData = [
  { month: 'Jul', quotes: 45, revenue: 125000 },
  { month: 'Aug', quotes: 52, revenue: 145000 },
  { month: 'Sep', quotes: 61, revenue: 168000 },
  { month: 'Oct', quotes: 58, revenue: 162000 },
  { month: 'Nov', quotes: 72, revenue: 198000 },
  { month: 'Dec', quotes: 68, revenue: 185000 },
];

const quoteStatusData = [
  { name: 'Accepted', value: 45, color: '#22c55e' },
  { name: 'Pending', value: 28, color: '#0c8cf1' },
  { name: 'Draft', value: 15, color: '#64748b' },
  { name: 'Rejected', value: 12, color: '#ef4444' },
];

export function AdminDashboard() {
  const { companies, users, quotes, commissions } = useData();

  const activeCompanies = companies.filter(c => c.subscriptionStatus === 'active' || c.subscriptionStatus === 'trial').length;
  const totalQuoteValue = quotes.reduce((sum, q) => sum + q.total, 0);
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted').length;
  const pendingReviews = commissions.filter(c => c.status === 'pending_review').length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">Platform overview and management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Companies"
          value={activeCompanies}
          change="+12% from last month"
          changeType="positive"
          icon={<Building2 className="w-6 h-6" />}
        />
        <StatCard
          title="Total Users"
          value={users.length}
          change="+8 new this week"
          changeType="positive"
          icon={<Users className="w-6 h-6" />}
        />
        <StatCard
          title="Total Quotes"
          value={quotes.length}
          change={`${acceptedQuotes} accepted`}
          changeType="neutral"
          icon={<FileText className="w-6 h-6" />}
        />
        <StatCard
          title="Quote Value"
          value={`£${(totalQuoteValue / 1000).toFixed(0)}k`}
          change="+15% growth"
          changeType="positive"
          icon={<TrendingUp className="w-6 h-6" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="section-title mb-0">Quote Activity</h3>
              <p className="text-sm text-slate-500">Monthly quote volume and value</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 bg-primary-500 rounded-full" />
                Quotes
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 bg-success-500 rounded-full" />
                Revenue
              </span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorQuotes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0c8cf1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0c8cf1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="quotes"
                  stroke="#0c8cf1"
                  strokeWidth={2}
                  fill="url(#colorQuotes)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Quote Status Pie Chart */}
        <Card>
          <h3 className="section-title">Quote Status</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={quoteStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {quoteStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {quoteStatusData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-400">{item.name}</span>
                <span className="text-white font-medium ml-auto">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Companies */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="section-title mb-0">Recent Companies</h3>
            <button className="text-sm text-primary-400 hover:text-primary-300">View all</button>
          </div>
          <div className="space-y-4">
            {companies.slice(0, 5).map((company) => (
              <div key={company.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-primary-400 font-medium">
                    {company.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{company.name}</p>
                    <p className="text-xs text-slate-500">{company.email}</p>
                  </div>
                </div>
                <SubscriptionBadge status={company.subscriptionStatus} />
              </div>
            ))}
          </div>
        </Card>

        {/* Pending Reviews */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="section-title mb-0">Pending Reviews</h3>
            <span className="badge badge-warning">{pendingReviews} pending</span>
          </div>
          {commissions.filter(c => c.status === 'pending_review').length > 0 ? (
            <div className="space-y-4">
              {commissions
                .filter(c => c.status === 'pending_review')
                .slice(0, 5)
                .map((commission) => (
                  <div key={commission.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-white">{commission.siteDetails.customerName}</p>
                      <p className="text-xs text-slate-500">{commission.companyName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-300">{commission.systemDetails.batteryModel}</p>
                      <p className="text-xs text-slate-500">
                        {format(new Date(commission.submittedAt), 'dd MMM yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No pending reviews</p>
            </div>
          )}
        </Card>
      </div>

      {/* Recent Quotes */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="section-title mb-0">Recent Quotes</h3>
          <button className="text-sm text-primary-400 hover:text-primary-300">View all quotes</button>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Company</th>
                <th>Value</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {quotes.slice(0, 5).map((quote) => (
                <tr key={quote.id}>
                  <td className="font-mono text-primary-400">{quote.reference}</td>
                  <td>{quote.customer.name}</td>
                  <td className="text-slate-400">
                    {companies.find(c => c.id === quote.companyId)?.name || 'Unknown'}
                  </td>
                  <td className="font-medium">£{quote.total.toLocaleString()}</td>
                  <td><QuoteStatusBadge status={quote.status} /></td>
                  <td className="text-slate-500">
                    {format(new Date(quote.createdAt), 'dd MMM yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {quotes.slice(0, 5).map((quote) => (
            <div key={quote.id} className="p-4 bg-slate-800/30 rounded-xl">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-white">{quote.customer.name}</p>
                  <p className="text-xs text-slate-500">
                    {companies.find(c => c.id === quote.companyId)?.name || 'Unknown'}
                  </p>
                </div>
                <QuoteStatusBadge status={quote.status} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono text-primary-400">{quote.reference}</span>
                <span className="font-medium text-white">£{quote.total.toLocaleString()}</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {format(new Date(quote.createdAt), 'dd MMM yyyy')}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

