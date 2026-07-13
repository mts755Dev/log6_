import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentFormProps {
  clientSecret: string;
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
  amount: string;
}

function PaymentForm({ clientSecret, onSuccess, onCancel, amount }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const toast = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { error: submitError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (submitError) {
        setError(submitError.message || 'Payment failed');
        setIsProcessing(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment succeeded! Now update database directly (no webhook needed)
        toast.success('Payment successful! Updating your account...');
        onSuccess(paymentIntent.id);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          isLoading={isProcessing}
          className="flex-1"
        >
          Pay {amount}
        </Button>
      </div>
    </form>
  );
}

interface StripePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  credits: number;
  companyId: string;
  onSuccess: () => void;
}

export function StripePaymentModal({ 
  isOpen, 
  onClose, 
  credits, 
  companyId,
  onSuccess 
}: StripePaymentModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [creditPrice, setCreditPrice] = useState(3);
  const toast = useToast();

  // Handle payment success and update database
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    try {
      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Fetch current company credit balance
      const { data: company, error: fetchError } = await supabase
        .from('companies')
        .select('credit_balance, payment_model, subscription_status')
        .eq('id', companyId)
        .single();

      if (fetchError) throw fetchError;

      const newBalance = (company?.credit_balance || 0) + credits;

      // Update company credits and payment status
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          credit_balance: newBalance,
          payment_model: 'pay-as-you-go',
          subscription_status: 'active',
        })
        .eq('id', companyId);

      if (updateError) throw updateError;

      // Update payment transaction status
      const { error: txError } = await supabase
        .from('payment_transactions')
        .update({ status: 'succeeded' })
        .eq('stripe_payment_intent_id', paymentIntentId);

      if (txError) throw txError;

      toast.success(`Successfully added ${credits} credits! New balance: ${newBalance} credits`);
      onSuccess();
    } catch (error: any) {
      console.error('Error updating payment:', error);
      toast.error(error.message || 'Payment succeeded but failed to update account. Please contact support.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPaymentIntent();
    }
  }, [isOpen, credits, companyId]);

  const fetchPaymentIntent = async () => {
    setIsLoading(true);
    try {
      // Get credit price from company
      const { data: company } = await supabase
        .from('companies')
        .select('credit_price')
        .eq('id', companyId)
        .single();

      const price = company?.credit_price || 3;
      setCreditPrice(price);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call edge function to create payment intent
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: { credits, companyId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setClientSecret(data.clientSecret);
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      toast.error(error.message || 'Failed to initialize payment');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const amount = `£${(credits * creditPrice).toFixed(2)}`;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 relative my-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Purchase Credits</h2>
          <p className="text-slate-400 text-sm">
            You're purchasing <span className="text-primary-400 font-semibold">{credits} credits</span> for {amount}
          </p>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400">
            <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p>Preparing payment...</p>
          </div>
        ) : clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm
              clientSecret={clientSecret}
              onSuccess={handlePaymentSuccess}
              onCancel={onClose}
              amount={amount}
            />
          </Elements>
        ) : (
          <div className="text-center text-red-400 py-6">
            Failed to initialize payment. Please try again.
          </div>
        )}
      </div>
    </div>
  );
}
