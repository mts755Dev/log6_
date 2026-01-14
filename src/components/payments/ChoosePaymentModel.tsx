import { useState } from 'react';
import { CreditCard, Zap, Check, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { StripePaymentModal } from './StripePaymentModal';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface ChoosePaymentModelProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  title?: string;
  message?: string;
}

export function ChoosePaymentModel({ 
  isOpen, 
  onClose, 
  companyId,
  title = 'Choose Your Payment Model',
  message = 'Select the payment option that best fits your needs.'
}: ChoosePaymentModelProps) {
  const { user } = useAuth();
  const { refreshData } = useData();
  const toast = useToast();
  const [selectedModel, setSelectedModel] = useState<'credits' | 'subscription' | null>(null);
  const [selectedCredits, setSelectedCredits] = useState(1);
  const [selectedTier, setSelectedTier] = useState<'starter' | 'professional' | 'enterprise'>('starter');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handlePaymentSuccess = async () => {
    setShowPaymentModal(false);
    await refreshData();
    toast.success('Payment successful! You can now create quotes.');
    onClose();
  };

  const handleSubscriptionPurchase = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: { tier: selectedTier, companyId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      // Open Stripe Checkout or Payment Element with the clientSecret
      // For now, we'll use a payment modal similar to credits
      setShowPaymentModal(true);
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      toast.error(error.message || 'Failed to create subscription');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full p-8 my-8 max-h-[calc(100vh-4rem)] overflow-y-auto relative">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500/10 rounded-full mb-4">
              <CreditCard className="w-8 h-8 text-primary-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">{title}</h2>
            <p className="text-slate-400">
              {message}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Pay as You Go */}
            <Card
              className={`cursor-pointer transition-all ${
                selectedModel === 'credits'
                  ? 'border-warning-500 bg-warning-500/10'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
              onClick={() => setSelectedModel('credits')}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Pay as You Go</h3>
                  <p className="text-slate-400 text-sm">Perfect for occasional use</p>
                </div>
                {selectedModel === 'credits' && (
                  <Badge variant="warning">Selected</Badge>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-green-400" />
                  <span>£3 per credit (1 credit = 1 proposal)</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-green-400" />
                  <span>Credits never expire</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-green-400" />
                  <span>No monthly commitment</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-green-400" />
                  <span>Top up anytime</span>
                </div>
              </div>

              {selectedModel === 'credits' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-white mb-1.5">
                      How many credits do you want?
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="10000"
                      value={selectedCredits}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        setSelectedCredits(Math.max(1, Math.min(10000, value)));
                      }}
                      placeholder="Enter number of credits"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      £3.00 per credit • Minimum: 1 credit • Maximum: 10,000 credits
                    </p>
                  </div>
                  
                  {selectedCredits > 0 && (
                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex justify-between items-center mb-1 text-sm">
                        <span className="text-slate-400">Credits:</span>
                        <span className="text-white font-semibold">{selectedCredits}</span>
                      </div>
                      <div className="flex justify-between items-center mb-2 text-sm">
                        <span className="text-slate-400">Price per credit:</span>
                        <span className="text-white">£3.00</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                        <span className="text-white font-semibold">Total:</span>
                        <span className="text-xl font-bold text-warning-400">£{(selectedCredits * 3).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  
                  <Button
                    onClick={() => setShowPaymentModal(true)}
                    className="w-full"
                    leftIcon={<CreditCard className="w-4 h-4" />}
                    disabled={selectedCredits < 1}
                  >
                    Purchase {selectedCredits} Credits - £{(selectedCredits * 3).toFixed(2)}
                  </Button>
                </div>
              )}
            </Card>

            {/* Monthly Subscription */}
            <Card
              className={`cursor-pointer transition-all ${
                selectedModel === 'subscription'
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
              onClick={() => setSelectedModel('subscription')}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Monthly Subscription</h3>
                  <p className="text-slate-400 text-sm">Best value for regular use</p>
                </div>
                {selectedModel === 'subscription' && (
                  <Badge variant="primary">Selected</Badge>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-green-400" />
                  <span>Fixed monthly cost</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-green-400" />
                  <span>Higher proposal limits</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-green-400" />
                  <span>Predictable billing</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-green-400" />
                  <span>Cancel anytime</span>
                </div>
              </div>

              {selectedModel === 'subscription' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-white">Select plan:</p>
                  <div className="space-y-1.5">
                    {[
                      { tier: 'starter', name: 'Starter', price: 29, proposals: 10 },
                      { tier: 'professional', name: 'Professional', price: 79, proposals: 50 },
                      { tier: 'enterprise', name: 'Enterprise', price: 199, proposals: '∞' },
                    ].map((plan) => (
                      <button
                        key={plan.tier}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTier(plan.tier as any);
                        }}
                        className={`w-full p-2 rounded-lg border transition-colors text-left ${
                          selectedTier === plan.tier
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-white">{plan.name}</div>
                            <div className="text-xs text-slate-400">{plan.proposals} credits/month</div>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-bold text-white">£{plan.price}</div>
                            <div className="text-xs text-slate-400">/month</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <Button
                    onClick={handleSubscriptionPurchase}
                    isLoading={isLoading}
                    className="w-full"
                    leftIcon={<CreditCard className="w-4 h-4" />}
                  >
                    Subscribe to {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}
                  </Button>
                </div>
              )}
            </Card>
          </div>

          <div className="text-center">
            <p className="text-xs text-slate-500">
              All payments are processed securely through Stripe. You can change or cancel your plan anytime.
            </p>
          </div>
        </div>
      </div>

      {/* Stripe Payment Modal */}
      {selectedModel === 'credits' && (
        <StripePaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          credits={selectedCredits}
          companyId={companyId}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
}
