import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Search,
  Plus,
  Edit,
  Users,
  FileText,
  MoreVertical,
  Trash2,
  XCircle,
  Coins,
  CreditCard,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SubscriptionBadge, Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { format } from 'date-fns';
import type { Company } from '../../types';

function formatSubscriptionTierLabel(tier?: string | null): string {
  const value = tier || 'starter';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function CompaniesPage() {
  const toast = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddCreditsModalOpen, setIsAddCreditsModalOpen] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState<Company | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [companyForCredits, setCompanyForCredits] = useState<Company | null>(null);
  const [creditsToAdd, setCreditsToAdd] = useState(1);
  const [companyStats, setCompanyStats] = useState<Record<string, { userCount: number; quoteCount: number; totalValue: number }>>({});
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    postcode: '',
    mcsNumber: '',
    isUmbrellaScheme: false,
    insurance_provider: null as 'QANW' | 'HICE' | 'REC' | null,
    paymentModel: 'subscription' as 'pay-as-you-go' | 'subscription',
    creditBalance: 0,
    creditPrice: 3.00,
    subscriptionTier: 'starter' as 'starter' | 'professional' | 'enterprise',
    subscriptionStatus: 'trial' as 'active' | 'trial' | 'expired' | 'cancelled',
    subscriptionEndDate: '',
    monthlyProposalLimit: 100,
  });

  // Fetch companies from Supabase
  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map database columns to TypeScript interface
      const mappedCompanies: Company[] = (data || []).map((company: any) => ({
        id: company.id,
        name: company.name,
        email: company.email,
        phone: company.phone,
        address: company.address,
        postcode: company.postcode,
        mcsNumber: company.mcs_number,
        isUmbrellaScheme: company.is_umbrella_scheme,
        insurance_provider: company.insurance_provider,
        paymentModel: company.payment_model || 'subscription',
        creditBalance: company.credit_balance || 0,
        creditPrice: parseFloat(company.credit_price) || 3.00,
        subscriptionTier: company.subscription_tier || 'starter',
        subscriptionStatus: company.subscription_status,
        subscriptionEndDate: company.subscription_end_date,
        monthlyProposalLimit: company.monthly_proposal_limit,
        proposalsUsedThisMonth: company.proposals_used_this_month || 0,
        proposalResetDate: company.proposal_reset_date,
        logo: company.logo,
        brandColor: company.brand_color,
        createdAt: company.created_at,
      }));

      setCompanies(mappedCompanies);
      
      // Fetch stats for each company (optional - graceful failure)
      await fetchCompanyStats(mappedCompanies.map(c => c.id));
    } catch (error: any) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to load companies. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch company stats from profiles table (instead of users)
  const fetchCompanyStats = async (companyIds: string[]) => {
    try {
      // For now, just set default stats. We can enhance this later.
      const stats: Record<string, { userCount: number; quoteCount: number; totalValue: number }> = {};
      companyIds.forEach(id => {
        stats[id] = { userCount: 0, quoteCount: 0, totalValue: 0 };
      });
      setCompanyStats(stats);
    } catch (error) {
      console.warn('Could not fetch company stats:', error);
      // Fail silently, just show 0 for stats
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCompanyStats = (companyId: string) => {
    return companyStats[companyId] || { userCount: 0, quoteCount: 0, totalValue: 0 };
  };

  // Create company
  const handleCreateCompany = async () => {
    try {
      setIsLoading(true);

      const { data, error} = await supabaseAdmin
        .from('companies')
        .insert([{
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          postcode: formData.postcode,
          mcs_number: formData.mcsNumber || null,
          is_umbrella_scheme: formData.isUmbrellaScheme,
          insurance_provider: formData.insurance_provider || null,
          payment_model: formData.paymentModel,
          credit_balance: formData.paymentModel === 'pay-as-you-go' ? formData.creditBalance : 0,
          credit_price: formData.creditPrice,
          subscription_tier: formData.subscriptionTier,
          subscription_status: formData.subscriptionStatus,
          subscription_end_date: formData.subscriptionEndDate,
          monthly_proposal_limit: formData.paymentModel === 'subscription' ? formData.monthlyProposalLimit : null,
          proposals_used_this_month: 0,
          proposal_reset_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
        }])
        .select();

      if (error) throw error;

      await fetchCompanies();
      setIsAddModalOpen(false);
      resetForm();
      toast.success('Company created successfully!');
    } catch (error: any) {
      console.error('Error creating company:', error);
      toast.error(error.message || 'Failed to create company. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Update company
  const handleUpdateCompany = async () => {
    if (!companyToEdit) return;

    try {
      setIsLoading(true);

      const { error } = await supabaseAdmin
        .from('companies')
        .update({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          postcode: formData.postcode,
          mcs_number: formData.mcsNumber || null,
          is_umbrella_scheme: formData.isUmbrellaScheme,
          insurance_provider: formData.insurance_provider || null,
          payment_model: formData.paymentModel,
          credit_balance: formData.creditBalance,
          credit_price: formData.creditPrice,
          subscription_tier: formData.subscriptionTier,
          subscription_status: formData.subscriptionStatus,
          subscription_end_date: formData.subscriptionEndDate,
          monthly_proposal_limit: formData.paymentModel === 'subscription' ? formData.monthlyProposalLimit : null,
        })
        .eq('id', companyToEdit.id);

      if (error) throw error;

      await fetchCompanies();
      setIsEditModalOpen(false);
      setCompanyToEdit(null);
      resetForm();
      toast.success('Company updated successfully!');
    } catch (error: any) {
      console.error('Error updating company:', error);
      toast.error(error.message || 'Failed to update company. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete company
  const confirmDeleteCompany = async () => {
    if (!companyToDelete) return;

    try {
      setIsLoading(true);

      const { error } = await supabaseAdmin
        .from('companies')
        .delete()
        .eq('id', companyToDelete.id);

      if (error) throw error;

      await fetchCompanies();
      setIsDeleteModalOpen(false);
      setCompanyToDelete(null);
      toast.success('Company deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting company:', error);
      toast.error(error.message || 'Failed to delete company. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (company: Company) => {
    setCompanyToEdit(company);
    setFormData({
      name: company.name,
      email: company.email,
      phone: company.phone,
      address: company.address,
      postcode: company.postcode,
      mcsNumber: company.mcsNumber || '',
      isUmbrellaScheme: company.isUmbrellaScheme,
      insurance_provider: company.insurance_provider || null,
      paymentModel: company.paymentModel || 'pay-as-you-go',
      creditBalance: company.creditBalance,
      creditPrice: company.creditPrice,
      subscriptionTier: company.subscriptionTier,
      subscriptionStatus: company.subscriptionStatus,
      subscriptionEndDate: company.subscriptionEndDate.split('T')[0], // Format for date input
      monthlyProposalLimit: company.monthlyProposalLimit || 100,
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (company: Company) => {
    setCompanyToDelete(company);
    setIsDeleteModalOpen(true);
  };

  const handleAddCreditsClick = (company: Company) => {
    setCompanyForCredits(company);
    setCreditsToAdd(1);
    setIsAddCreditsModalOpen(true);
  };

  const handleAddCredits = async () => {
    if (!companyForCredits) return;

    try {
      setIsLoading(true);

      const newBalance = companyForCredits.creditBalance + creditsToAdd;

      const { error } = await supabaseAdmin
        .from('companies')
        .update({
          credit_balance: newBalance,
        })
        .eq('id', companyForCredits.id);

      if (error) throw error;

      await fetchCompanies();
      setIsAddCreditsModalOpen(false);
      setCompanyForCredits(null);
      setCreditsToAdd(1);
      toast.success(`Added ${creditsToAdd} credits successfully!`);
    } catch (error: any) {
      console.error('Error adding credits:', error);
      toast.error(error.message || 'Failed to add credits. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      postcode: '',
      mcsNumber: '',
      isUmbrellaScheme: false,
      insurance_provider: null,
      paymentModel: 'subscription',
      creditBalance: 0,
      creditPrice: 3.00,
      subscriptionTier: 'starter',
      subscriptionStatus: 'trial',
      subscriptionEndDate: '',
      monthlyProposalLimit: 100,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Companies</h1>
          <p className="page-subtitle">Manage installer companies and subscriptions</p>
        </div>
        <Button 
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsAddModalOpen(true)}
        >
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
                  <div className="flex gap-1">
                    {company.paymentModel === 'pay-as-you-go' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddCreditsClick(company);
                        }}
                        className="p-2 text-slate-400 hover:text-warning-400 hover:bg-warning-500/10 rounded-lg transition-colors"
                        title="Add credits"
                      >
                        <Coins className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClick(company);
                      }}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      title="Edit company"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(company);
                      }}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete company"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <Badge variant={company.paymentModel === 'pay-as-you-go' ? 'warning' : 'primary'}>
                    {company.paymentModel === 'pay-as-you-go' ? 'Pay as you go' : 'Subscription'}
                  </Badge>
                  <SubscriptionBadge status={company.subscriptionStatus} />
                  <Badge variant="slate">{formatSubscriptionTierLabel(company.subscriptionTier)}</Badge>
                  {company.isUmbrellaScheme && (
                    <Badge variant="primary">Umbrella</Badge>
                  )}
                </div>
                
                {/* Payment Model Stats */}
                <div className="p-3 bg-primary-500/10 border border-primary-500/20 rounded-lg mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Credit Balance</span>
                    <span className="text-lg font-bold text-primary-400">{company.creditBalance} credits</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">£{company.creditPrice.toFixed(2)} per credit</p>
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

      {/* Add Company Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          resetForm();
        }}
        title="Add New Company"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Company Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Solar Solutions UK"
              required
            />
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="info@company.com"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+44 20 1234 5678"
              required
            />
            <Input
              label="MCS Number (Optional)"
              value={formData.mcsNumber}
              onChange={(e) => setFormData({ ...formData, mcsNumber: e.target.value })}
              placeholder="MCS-12345"
            />
          </div>

          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="123 Main Street"
            required
          />

          <Input
            label="Postcode"
            value={formData.postcode}
            onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
            placeholder="SW1A 1AA"
            required
          />

          {/* Insurance Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Insurance Provider <span className="text-xs text-slate-500">(for consumer code leaflets)</span>
            </label>
            <select
              value={formData.insurance_provider || ''}
              onChange={(e) => setFormData({ ...formData, insurance_provider: e.target.value as 'QANW' | 'HICE' | 'REC' | null })}
              className="input"
            >
              <option value="">Select Insurance Provider...</option>
              <option value="QANW">QANW</option>
              <option value="HICE">HICE</option>
              <option value="REC">REC</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              This determines which consumer code leaflet is attached to quotes
            </p>
          </div>

          {/* Payment Model Selection */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <label className="block text-sm font-medium text-white mb-3">Payment Model</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentModel: 'subscription' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.paymentModel === 'subscription'
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                }`}
              >
                <div className="text-center">
                  <p className="font-semibold text-white mb-1">Subscription</p>
                  <p className="text-xs text-slate-400">Monthly billing with proposal limits</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentModel: 'pay-as-you-go' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.paymentModel === 'pay-as-you-go'
                    ? 'border-warning-500 bg-warning-500/10'
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                }`}
              >
                <div className="text-center">
                  <p className="font-semibold text-white mb-1">Pay as you go</p>
                  <p className="text-xs text-slate-400">Credit-based, no expiry</p>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Fields Based on Payment Model */}
          {formData.paymentModel === 'pay-as-you-go' ? (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Initial Credit Balance"
                type="number"
                value={formData.creditBalance}
                onChange={(e) => setFormData({ ...formData, creditBalance: Number(e.target.value) })}
                placeholder="0"
                hint="Starting credits (1 credit = 1 proposal)"
              />
              <Input
                label="Credit Price (£)"
                type="number"
                step="0.01"
                value={formData.creditPrice}
                onChange={(e) => setFormData({ ...formData, creditPrice: Number(e.target.value) })}
                placeholder="3.00"
                hint="Price per credit in GBP"
              />
            </div>
          ) : (
            <>
              <Input
                label="Monthly Proposal Limit"
                type="number"
                value={formData.monthlyProposalLimit}
                onChange={(e) => setFormData({ ...formData, monthlyProposalLimit: Number(e.target.value) })}
                placeholder="100"
                hint="Max proposals per month (empty = unlimited)"
              />
              <Input
                label="Subscription End Date"
                type="date"
                value={formData.subscriptionEndDate}
                onChange={(e) => setFormData({ ...formData, subscriptionEndDate: e.target.value })}
                required
              />
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Subscription Tier"
              value={formData.subscriptionTier}
              onChange={(e) => setFormData({ ...formData, subscriptionTier: e.target.value as any })}
              options={[
                { value: 'starter', label: 'Starter' },
                { value: 'professional', label: 'Professional' },
                { value: 'enterprise', label: 'Enterprise' },
              ]}
            />
            <Select
              label="Subscription Status"
              value={formData.subscriptionStatus}
              onChange={(e) => setFormData({ ...formData, subscriptionStatus: e.target.value as any })}
              options={[
                { value: 'trial', label: 'Trial' },
                { value: 'active', label: 'Active' },
                { value: 'expired', label: 'Expired' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-medium text-white">Umbrella Scheme</p>
                <p className="text-sm text-slate-400">
                  Enable if this company operates as an umbrella scheme
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isUmbrellaScheme: !formData.isUmbrellaScheme })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.isUmbrellaScheme ? 'bg-primary-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.isUmbrellaScheme ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              variant="secondary"
              onClick={() => {
                setIsAddModalOpen(false);
                resetForm();
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCompany}
              className="flex-1"
              isLoading={isLoading}
              disabled={!formData.name || !formData.email || !formData.phone || !formData.address || !formData.postcode || !formData.subscriptionEndDate}
            >
              Create Company
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Company Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setCompanyToEdit(null);
          resetForm();
        }}
        title="Edit Company"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Company Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Solar Solutions UK"
              required
            />
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="info@company.com"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+44 20 1234 5678"
              required
            />
            <Input
              label="MCS Number (Optional)"
              value={formData.mcsNumber}
              onChange={(e) => setFormData({ ...formData, mcsNumber: e.target.value })}
              placeholder="MCS-12345"
            />
          </div>

          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="123 Main Street"
            required
          />

          <Input
            label="Postcode"
            value={formData.postcode}
            onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
            placeholder="SW1A 1AA"
            required
          />

          {/* Insurance Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Insurance Provider <span className="text-xs text-slate-500">(for consumer code leaflets)</span>
            </label>
            <select
              value={formData.insurance_provider || ''}
              onChange={(e) => setFormData({ ...formData, insurance_provider: e.target.value as 'QANW' | 'HICE' | 'REC' | null })}
              className="input"
            >
              <option value="">Select Insurance Provider...</option>
              <option value="QANW">QANW</option>
              <option value="HICE">HICE</option>
              <option value="REC">REC</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              This determines which consumer code leaflet is attached to quotes
            </p>
          </div>

          {/* Payment Model Selection */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <label className="block text-sm font-medium text-white mb-3">Payment Model</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentModel: 'subscription' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.paymentModel === 'subscription'
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                }`}
              >
                <div className="text-center">
                  <p className="font-semibold text-white mb-1">Subscription</p>
                  <p className="text-xs text-slate-400">Monthly billing with proposal limits</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentModel: 'pay-as-you-go' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.paymentModel === 'pay-as-you-go'
                    ? 'border-warning-500 bg-warning-500/10'
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                }`}
              >
                <div className="text-center">
                  <p className="font-semibold text-white mb-1">Pay as you go</p>
                  <p className="text-xs text-slate-400">Credit-based, no expiry</p>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Fields Based on Payment Model */}
          {formData.paymentModel === 'pay-as-you-go' ? (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Credit Balance"
                type="number"
                value={formData.creditBalance}
                onChange={(e) => setFormData({ ...formData, creditBalance: Number(e.target.value) })}
                placeholder="0"
                hint="Current credit balance (1 credit = 1 proposal)"
              />
              <Input
                label="Credit Price (£)"
                type="number"
                step="0.01"
                value={formData.creditPrice}
                onChange={(e) => setFormData({ ...formData, creditPrice: Number(e.target.value) })}
                placeholder="3.00"
                hint="Price per credit in GBP"
              />
            </div>
          ) : (
            <>
              <Input
                label="Monthly Proposal Limit"
                type="number"
                value={formData.monthlyProposalLimit}
                onChange={(e) => setFormData({ ...formData, monthlyProposalLimit: Number(e.target.value) })}
                placeholder="100"
                hint="Max proposals per month (empty = unlimited)"
              />
              <Input
                label="Subscription End Date"
                type="date"
                value={formData.subscriptionEndDate}
                onChange={(e) => setFormData({ ...formData, subscriptionEndDate: e.target.value })}
                required
              />
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Subscription Tier"
              value={formData.subscriptionTier}
              onChange={(e) => setFormData({ ...formData, subscriptionTier: e.target.value as any })}
              options={[
                { value: 'starter', label: 'Starter' },
                { value: 'professional', label: 'Professional' },
                { value: 'enterprise', label: 'Enterprise' },
              ]}
            />
            <Select
              label="Subscription Status"
              value={formData.subscriptionStatus}
              onChange={(e) => setFormData({ ...formData, subscriptionStatus: e.target.value as any })}
              options={[
                { value: 'trial', label: 'Trial' },
                { value: 'active', label: 'Active' },
                { value: 'expired', label: 'Expired' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-medium text-white">Umbrella Scheme</p>
                <p className="text-sm text-slate-400">
                  Enable if this company operates as an umbrella scheme
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isUmbrellaScheme: !formData.isUmbrellaScheme })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.isUmbrellaScheme ? 'bg-primary-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.isUmbrellaScheme ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              variant="secondary"
              onClick={() => {
                setIsEditModalOpen(false);
                setCompanyToEdit(null);
                resetForm();
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateCompany}
              className="flex-1"
              isLoading={isLoading}
              disabled={!formData.name || !formData.email || !formData.phone || !formData.address || !formData.postcode}
            >
              Update Company
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCompanyToDelete(null);
        }}
        title="Delete Company"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white mb-1">
                Are you sure you want to delete this company?
              </p>
              <p className="text-sm text-slate-400">
                This action cannot be undone. Company: <span className="font-medium text-white">{companyToDelete?.name}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setCompanyToDelete(null);
              }}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteCompany}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              isLoading={isLoading}
            >
              Delete Company
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Credits Modal */}
      <Modal
        isOpen={isAddCreditsModalOpen}
        onClose={() => {
          setIsAddCreditsModalOpen(false);
          setCompanyForCredits(null);
          setCreditsToAdd(1);
        }}
        title="Add Credits"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-4 bg-warning-500/10 border border-warning-500/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Company</span>
              <span className="font-semibold text-white">{companyForCredits?.name}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Current Balance</span>
              <span className="font-semibold text-warning-400">{companyForCredits?.creditBalance} credits</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Credit Price</span>
              <span className="font-semibold text-white">£{companyForCredits?.creditPrice.toFixed(2)} each</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Credits to Add
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCreditsToAdd(Math.max(1, creditsToAdd - 1))}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                disabled={creditsToAdd <= 1}
              >
                <span className="text-xl font-bold text-white">−</span>
              </button>
              <Input
                type="number"
                value={creditsToAdd}
                onChange={(e) => setCreditsToAdd(Math.max(1, Number(e.target.value)))}
                className="text-center text-2xl font-bold"
                min="1"
              />
              <button
                onClick={() => setCreditsToAdd(creditsToAdd + 1)}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <span className="text-xl font-bold text-white">+</span>
              </button>
            </div>
            <div className="flex items-center justify-center gap-4 mt-3">
              {[1, 5, 10, 20, 50].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setCreditsToAdd(amount)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    creditsToAdd === amount
                      ? 'bg-warning-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {amount}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-slate-400">Total Cost</span>
              <span className="text-xl font-bold text-white">
                £{((companyForCredits?.creditPrice || 3) * creditsToAdd).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">New Balance</span>
              <span className="text-lg font-semibold text-success-400">
                {(companyForCredits?.creditBalance || 0) + creditsToAdd} credits
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsAddCreditsModalOpen(false);
                setCompanyForCredits(null);
                setCreditsToAdd(1);
              }}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCredits}
              className="flex-1 bg-warning-600 hover:bg-warning-700 text-white"
              leftIcon={<Coins className="w-4 h-4" />}
              isLoading={isLoading}
            >
              Add {creditsToAdd} Credit{creditsToAdd > 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}