import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  RefreshCw,
  Building2,
  DollarSign,
  Info
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';

interface StripeConnectOnboardingProps {
  companyId: string;
  companyData: {
    name: string;
    email: string;
    phone: string;
    address: string;
    postcode: string;
  };
}

interface ConnectAccountStatus {
  hasAccount: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  requirementsCurrentlyDue?: string[];
  requirementsPastDue?: string[];
}

export function StripeConnectOnboarding({ companyId, companyData }: StripeConnectOnboardingProps) {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [accountStatus, setAccountStatus] = useState<ConnectAccountStatus | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    businessName: companyData.name,
    email: companyData.email,
    phone: companyData.phone,
    address: companyData.address,
    postcode: companyData.postcode,
    businessType: 'company',
    country: 'GB',
  });

  useEffect(() => {
    checkAccountStatus();
  }, [companyId]);

  const checkAccountStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('check-stripe-connect-status', {
        body: { companyId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setAccountStatus(data);
    } catch (error: any) {
      console.error('Error checking Stripe Connect status:', error);
      toast.error(error.message || 'Failed to check account status');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleCreateAccount = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('create-stripe-connect-account', {
        body: {
          companyId,
          ...formData,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.onboardingUrl) {
        // Redirect to Stripe onboarding
        toast.success('Redirecting to Stripe to complete setup...');
        window.location.href = data.onboardingUrl;
      } else if (data.accountExists) {
        toast.success('Account already exists!');
        await checkAccountStatus();
      }
    } catch (error: any) {
      console.error('Error creating Stripe Connect account:', error);
      toast.error(error.message || 'Failed to create Stripe Connect account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDashboard = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('create-stripe-connect-dashboard-link', {
        body: { companyId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.dashboardUrl) {
        window.open(data.dashboardUrl, '_blank');
      }
    } catch (error: any) {
      console.error('Error opening Stripe dashboard:', error);
      toast.error(error.message || 'Failed to open dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingStatus) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-primary-400 animate-spin" />
          <span className="ml-3 text-slate-400">Checking account status...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-primary-300 font-medium mb-1">
              Why Stripe Connect?
            </p>
            <p className="text-xs text-slate-400">
              With Stripe Connect, you'll receive payments directly from customers to your own Stripe account. 
              This gives you full control over your funds, instant access to payouts, and detailed transaction reporting.
            </p>
          </div>
        </div>
      </div>

      {/* Account Status */}
      {accountStatus?.hasAccount ? (
        <Card>
          <h3 className="section-title mb-6">Your Stripe Account</h3>
          
          {/* Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-primary-400" />
                <span className="text-sm font-medium text-slate-400">Account Status</span>
              </div>
              <div className="flex items-center gap-2">
                {accountStatus.detailsSubmitted ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-white font-medium">Active</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-warning-400" />
                    <span className="text-white font-medium">Setup Incomplete</span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5 text-primary-400" />
                <span className="text-sm font-medium text-slate-400">Accept Payments</span>
              </div>
              <div className="flex items-center gap-2">
                {accountStatus.chargesEnabled ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-white font-medium">Enabled</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-white font-medium">Disabled</span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-primary-400" />
                <span className="text-sm font-medium text-slate-400">Receive Payouts</span>
              </div>
              <div className="flex items-center gap-2">
                {accountStatus.payoutsEnabled ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-white font-medium">Enabled</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-white font-medium">Disabled</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Requirements */}
          {(accountStatus.requirementsCurrentlyDue && accountStatus.requirementsCurrentlyDue.length > 0) && (
            <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-warning-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-warning-400 font-medium mb-2">
                    Action Required
                  </p>
                  <p className="text-xs text-slate-400 mb-3">
                    Please complete the following requirements to activate your account:
                  </p>
                  <ul className="space-y-1">
                    {accountStatus.requirementsCurrentlyDue.map((req: string) => (
                      <li key={req} className="text-xs text-slate-300">
                        • {req.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {accountStatus.chargesEnabled && accountStatus.payoutsEnabled && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-green-400 font-medium mb-1">
                    Account Fully Activated!
                  </p>
                  <p className="text-xs text-slate-400">
                    Your Stripe account is ready to accept payments and receive payouts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              leftIcon={<ExternalLink className="w-4 h-4" />}
              onClick={handleOpenDashboard}
              isLoading={isLoading}
            >
              Open Stripe Dashboard
            </Button>
            <Button
              variant="secondary"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={checkAccountStatus}
            >
              Refresh Status
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <h3 className="section-title mb-2">Connect Your Stripe Account</h3>
          <p className="text-slate-400 text-sm mb-6">
            Set up your Stripe account to receive payments directly from customers.
          </p>

          {!showForm ? (
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-xl p-6">
                <h4 className="text-white font-medium mb-4">What you'll need:</h4>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Business information (name, address, tax details)</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Bank account details for payouts</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Personal identification (for verification)</span>
                  </li>
                </ul>
              </div>

              <Button
                variant="primary"
                size="lg"
                onClick={() => setShowForm(true)}
                className="w-full"
              >
                Get Started
              </Button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="form-grid">
                <Input
                  label="Business Name"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  required
                />
                <Input
                  label="Business Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-grid">
                <Input
                  label="Phone Number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Business Type
                  </label>
                  <select
                    value={formData.businessType}
                    onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="company">Company</option>
                    <option value="individual">Individual</option>
                  </select>
                </div>
              </div>

              <div>
                <Input
                  label="Business Address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>

              <div className="form-grid">
                <Input
                  label="Postcode"
                  value={formData.postcode}
                  onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Country
                  </label>
                  <select
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="GB">United Kingdom</option>
                    <option value="US">United States</option>
                    <option value="IE">Ireland</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-xs text-slate-400">
                  By continuing, you'll be redirected to Stripe to complete your account setup. 
                  Stripe will collect additional information required for verification and compliance.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  onClick={handleCreateAccount}
                  isLoading={isLoading}
                  disabled={!formData.businessName || !formData.email || !formData.phone}
                  className="flex-1"
                >
                  Continue to Stripe
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowForm(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </Card>
      )}
    </div>
  );
}
