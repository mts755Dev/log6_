import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Building2, 
  Bell, 
  CreditCard,
  Shield,
  Palette,
  Save,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs, TabPanels, TabPanel } from '../../components/ui/Tabs';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';

export function SettingsPage() {
  const { user } = useAuth();
  const { getCompany } = useData();
  const [activeTab, setActiveTab] = useState('profile');

  const company = user?.companyId ? getCompany(user.companyId) : null;

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'company', label: 'Company', icon: <Building2 className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'subscription', label: 'Subscription', icon: <CreditCard className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account and preferences</p>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      <TabPanels activeTab={activeTab}>
        {/* Profile Tab */}
        <TabPanel id="profile">
          <Card>
            <h3 className="section-title">Personal Information</h3>
            <div className="max-w-xl space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 bg-primary-500/20 rounded-full flex items-center justify-center text-primary-400 text-2xl font-bold">
                  {user?.name.charAt(0)}
                </div>
                <div>
                  <Button variant="secondary" size="sm">
                    Change Photo
                  </Button>
                  <p className="text-xs text-slate-500 mt-1">JPG, PNG. Max 2MB</p>
                </div>
              </div>

              <div className="form-grid">
                <Input
                  label="Full Name"
                  defaultValue={user?.name}
                />
                <Input
                  label="Email Address"
                  type="email"
                  defaultValue={user?.email}
                />
                <Input
                  label="Phone Number"
                  placeholder="+44 7700 900000"
                />
                <Input
                  label="Job Title"
                  placeholder="e.g., Lead Installer"
                />
              </div>

              <div className="pt-6 border-t border-slate-700">
                <h4 className="text-sm font-medium text-white mb-4">Change Password</h4>
                <div className="space-y-4">
                  <Input
                    label="Current Password"
                    type="password"
                    placeholder="••••••••"
                  />
                  <div className="form-grid">
                    <Input
                      label="New Password"
                      type="password"
                      placeholder="••••••••"
                    />
                    <Input
                      label="Confirm New Password"
                      type="password"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button leftIcon={<Save className="w-4 h-4" />}>
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>
        </TabPanel>

        {/* Company Tab */}
        <TabPanel id="company">
          <Card>
            <h3 className="section-title">Company Details</h3>
            <div className="max-w-xl space-y-6">
              <div className="form-grid">
                <Input
                  label="Company Name"
                  defaultValue={company?.name}
                />
                <Input
                  label="Company Email"
                  type="email"
                  defaultValue={company?.email}
                />
                <Input
                  label="Phone Number"
                  defaultValue={company?.phone}
                />
                <Input
                  label="MCS Number"
                  defaultValue={company?.mcsNumber}
                  placeholder="MCS/12345"
                />
              </div>

              <div>
                <Input
                  label="Address"
                  defaultValue={company?.address}
                />
              </div>

              <div className="form-grid">
                <Input
                  label="Postcode"
                  defaultValue={company?.postcode}
                />
              </div>

              <div className="pt-6 border-t border-slate-700">
                <h4 className="text-sm font-medium text-white mb-4">Branding</h4>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-sm text-slate-400 mb-2">Company Logo</p>
                    <div className="w-32 h-32 bg-slate-800 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-700">
                      <span className="text-slate-500 text-sm">Upload Logo</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-2">Brand Color</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-600 border-2 border-white/20" />
                      <Input
                        defaultValue="#0c8cf1"
                        className="w-32"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button leftIcon={<Save className="w-4 h-4" />}>
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>
        </TabPanel>

        {/* Notifications Tab */}
        <TabPanel id="notifications">
          <Card>
            <h3 className="section-title">Notification Preferences</h3>
            <div className="max-w-xl space-y-6">
              <div className="space-y-4">
                {[
                  { label: 'Quote accepted by customer', description: 'Get notified when a customer accepts your quote' },
                  { label: 'Quote viewed', description: 'Get notified when a customer views your quote' },
                  { label: 'Commission approved', description: 'Get notified when your commissioning is approved' },
                  { label: 'Commission requires changes', description: 'Get notified when changes are requested' },
                  { label: 'New product announcements', description: 'Updates about new products in the catalogue' },
                  { label: 'Platform updates', description: 'News and feature announcements' },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
                    <div>
                      <p className="font-medium text-white">{item.label}</p>
                      <p className="text-sm text-slate-500">{item.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button leftIcon={<Save className="w-4 h-4" />}>
                  Save Preferences
                </Button>
              </div>
            </div>
          </Card>
        </TabPanel>

        {/* Subscription Tab */}
        <TabPanel id="subscription">
          <div className="space-y-6">
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="section-title mb-0">Current Plan</h3>
                  <p className="text-slate-500 text-sm">Your subscription details</p>
                </div>
                <Badge variant="success" size="md">Active</Badge>
              </div>

              <div className="mt-6 p-6 bg-slate-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-2xl font-bold text-white capitalize">{company?.subscriptionTier}</p>
                    <p className="text-slate-400">Monthly billing</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-primary-400">
                      £{company?.subscriptionTier === 'starter' ? '29' : company?.subscriptionTier === 'professional' ? '79' : '199'}
                    </p>
                    <p className="text-slate-500">/month</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                  <div>
                    <p className="text-sm text-slate-500">Renewal Date</p>
                    <p className="text-white">{company?.subscriptionEndDate ? new Date(company.subscriptionEndDate).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Payment Method</p>
                    <p className="text-white">•••• 4242</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="secondary">
                  Update Payment Method
                </Button>
                <Button variant="secondary">
                  View Invoices
                </Button>
              </div>
            </Card>

            {/* Upgrade Options */}
            <Card>
              <h3 className="section-title">Available Plans</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: 'Starter', price: 29, features: ['5 quotes/month', '1 user', 'Email support'] },
                  { name: 'Professional', price: 79, features: ['50 quotes/month', '5 users', 'Priority support', 'Custom branding'] },
                  { name: 'Enterprise', price: 199, features: ['Unlimited quotes', 'Unlimited users', 'Dedicated support', 'API access'] },
                ].map((plan) => (
                  <div
                    key={plan.name}
                    className={`p-6 rounded-xl border ${
                      plan.name.toLowerCase() === company?.subscriptionTier
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-slate-700 bg-slate-800/30'
                    }`}
                  >
                    <h4 className="text-lg font-semibold text-white mb-2">{plan.name}</h4>
                    <p className="text-3xl font-bold text-white mb-4">
                      £{plan.price}<span className="text-sm text-slate-500">/mo</span>
                    </p>
                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="text-sm text-slate-400 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {plan.name.toLowerCase() === company?.subscriptionTier ? (
                      <Button variant="secondary" className="w-full mt-4" disabled>
                        Current Plan
                      </Button>
                    ) : (
                      <Button variant="secondary" className="w-full mt-4">
                        {parseInt(String(plan.price)) > (company?.subscriptionTier === 'starter' ? 29 : 79) ? 'Upgrade' : 'Downgrade'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabPanel>
      </TabPanels>
    </div>
  );
}

