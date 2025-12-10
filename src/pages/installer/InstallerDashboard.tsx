import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FileText, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  Plus,
  ArrowRight,
  Calculator,
  Send,
  Eye,
} from 'lucide-react';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { QuoteStatusBadge } from '../../components/ui/Badge';
import { format } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function InstallerDashboard() {
  const { user } = useAuth();
  const { quotes } = useData();

  // Filter quotes for current user's company
  const myQuotes = quotes.filter(q => q.companyId === user?.companyId);
  
  const totalQuotes = myQuotes.length;
  const acceptedQuotes = myQuotes.filter(q => q.status === 'accepted');
  const pendingQuotes = myQuotes.filter(q => q.status === 'sent' || q.status === 'viewed');
  const draftQuotes = myQuotes.filter(q => q.status === 'draft');
  
  const totalValue = acceptedQuotes.reduce((sum, q) => sum + q.total, 0);
  const totalMargin = acceptedQuotes.reduce((sum, q) => sum + q.margin, 0);
  const conversionRate = totalQuotes > 0 ? ((acceptedQuotes.length / totalQuotes) * 100).toFixed(1) : '0';

  // Monthly data for chart
  const monthlyData = [
    { month: 'Jul', quotes: 3, value: 28000 },
    { month: 'Aug', quotes: 5, value: 42000 },
    { month: 'Sep', quotes: 4, value: 35000 },
    { month: 'Oct', quotes: 6, value: 52000 },
    { month: 'Nov', quotes: 8, value: 68000 },
    { month: 'Dec', quotes: 5, value: 45000 },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Welcome back, {user?.name.split(' ')[0]}</h1>
          <p className="page-subtitle">{user?.companyName}</p>
        </div>
        <Link to="/installer/quotes/new">
          <Button leftIcon={<Plus className="w-4 h-4" />}>
            New Quote
          </Button>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Quotes"
          value={totalQuotes}
          change={`${draftQuotes.length} drafts`}
          changeType="neutral"
          icon={<FileText className="w-6 h-6" />}
        />
        <StatCard
          title="Accepted"
          value={acceptedQuotes.length}
          change={`${conversionRate}% conversion`}
          changeType="positive"
          icon={<CheckCircle2 className="w-6 h-6" />}
        />
        <StatCard
          title="Pending Response"
          value={pendingQuotes.length}
          change="Awaiting customer"
          changeType="neutral"
          icon={<Clock className="w-6 h-6" />}
        />
        <StatCard
          title="Revenue (Accepted)"
          value={`£${(totalValue / 1000).toFixed(1)}k`}
          change={`£${(totalMargin / 1000).toFixed(1)}k margin`}
          changeType="positive"
          icon={<TrendingUp className="w-6 h-6" />}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="section-title mb-0">Quote Performance</h3>
              <p className="text-sm text-slate-500">Monthly quote activity</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => [
                    name === 'value' ? `£${value.toLocaleString()}` : value,
                    name === 'value' ? 'Value' : 'Quotes'
                  ]}
                />
                <Bar dataKey="quotes" fill="#0c8cf1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card>
          <h3 className="section-title">Quick Actions</h3>
          <div className="space-y-3">
            <Link
              to="/installer/quotes/new"
              className="flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors group"
            >
              <div className="p-3 bg-primary-500/20 rounded-xl text-primary-400">
                <Calculator className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">Create New Quote</p>
                <p className="text-sm text-slate-500">Generate instant pricing</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-primary-400 transition-colors" />
            </Link>

            <Link
              to="/installer/quotes"
              className="flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors group"
            >
              <div className="p-3 bg-success-500/20 rounded-xl text-success-400">
                <Send className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">View Quotes</p>
                <p className="text-sm text-slate-500">Manage existing quotes</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-success-400 transition-colors" />
            </Link>

            <Link
              to="/installer/products"
              className="flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors group"
            >
              <div className="p-3 bg-warning-500/20 rounded-xl text-warning-400">
                <Eye className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">Product Catalogue</p>
                <p className="text-sm text-slate-500">Browse batteries & inverters</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-warning-400 transition-colors" />
            </Link>
          </div>
        </Card>
      </div>

      {/* Recent Quotes */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="section-title mb-0">Recent Quotes</h3>
          <Link to="/installer/quotes" className="text-sm text-primary-400 hover:text-primary-300">
            View all
          </Link>
        </div>
        
        {myQuotes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>System</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {myQuotes.slice(0, 5).map((quote) => {
                  const battery = quote.lineItems.find(li => li.type === 'battery');
                  return (
                    <tr key={quote.id}>
                      <td className="font-mono text-primary-400">{quote.reference}</td>
                      <td>
                        <div>
                          <p className="font-medium text-white">{quote.customer.name}</p>
                          <p className="text-xs text-slate-500">{quote.customer.postcode}</p>
                        </div>
                      </td>
                      <td className="text-slate-400">
                        {battery?.description.split(' ').slice(0, 3).join(' ') || 'N/A'}
                      </td>
                      <td className="font-medium">£{quote.total.toLocaleString()}</td>
                      <td><QuoteStatusBadge status={quote.status} /></td>
                      <td className="text-slate-500">
                        {format(new Date(quote.createdAt), 'dd MMM')}
                      </td>
                      <td>
                        <Link
                          to={`/installer/quotes/${quote.id}`}
                          className="text-sm text-primary-400 hover:text-primary-300"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-700" />
            <p className="text-slate-400 mb-4">No quotes yet</p>
            <Link to="/installer/quotes/new">
              <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                Create Your First Quote
              </Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

