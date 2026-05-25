import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { motion } from 'framer-motion';
import {
  Receipt,
  Download,
  CreditCard,
  CheckCircle,
  Clock,
  Building2,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import type { Invoice } from '../types';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

function PaymentForm({ invoice, onSuccess }: { invoice: Invoice; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/invoice/${invoice.id}`,
        },
      });

      if (error) {
        setErrorMessage(error.message || 'Payment failed');
      } else {
        onSuccess();
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="min-h-[200px]">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400 text-sm">{errorMessage}</p>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!stripe || isProcessing}
        isLoading={isProcessing}
        leftIcon={<CreditCard className="w-5 h-5" />}
      >
        {isProcessing ? 'Processing...' : `Pay £${invoice.total.toFixed(2)}`}
      </Button>
    </form>
  );
}

export function CustomerInvoiceViewPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const toast = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice();
    }
  }, [invoiceId]);

  const fetchInvoice = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('get-public-invoice', {
        body: { invoiceId },
      });

      if (error) throw error;
      if (!data?.invoice) throw new Error('Invoice not found');

      const mappedInvoice = mapInvoice(data.invoice);
      setInvoice(mappedInvoice);
    } catch (error: any) {
      console.error('Error fetching invoice:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const mapInvoice = (data: any): Invoice => ({
    id: data.id,
    quoteId: data.quote_id,
    companyId: data.company_id,
    type: data.type,
    customerName: data.customer_name,
    customerEmail: data.customer_email,
    customerPhone: data.customer_phone,
    customerAddress: data.customer_address,
    subtotal: data.subtotal,
    vatRate: data.vat_rate,
    vatAmount: data.vat_amount,
    total: data.total,
    lineItems: data.line_items || [],
    status: data.status,
    paymentMethod: data.payment_method,
    paidAt: data.paid_at,
    stripePaymentIntentId: data.stripe_payment_intent_id,
    issueDate: data.issue_date,
    dueDate: data.due_date,
    pdfUrl: data.pdf_url,
    sentAt: data.sent_at,
    viewedAt: data.viewed_at,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });

  const handleProceedToPayment = async () => {
    try {
      // Create payment intent for this invoice
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          invoiceId: invoice!.id,
          amount: invoice!.total,
        },
      });

      if (error) throw error;

      setClientSecret(data.clientSecret);
      setShowPaymentForm(true);
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      toast.error('Failed to initialize payment. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4" />
          <p className="text-slate-400">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card>
          <div className="text-center py-12">
            <Receipt className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Invoice Not Found</h2>
            <p className="text-slate-400">The invoice you're looking for doesn't exist.</p>
          </div>
        </Card>
      </div>
    );
  }

  const isPaid = invoice.status === 'paid';
  const isPending = invoice.status === 'pending';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <Receipt className="w-16 h-16 text-primary-400 mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-white mb-2">Invoice</h1>
            <p className="text-slate-400">
              {invoice.type === 'deposit' ? 'Deposit Payment' : 'Final Payment'}
            </p>
          </div>
        </motion.div>

        {/* Status Badge */}
        {isPaid && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-500/20 border-2 border-green-500 rounded-lg p-6 text-center"
          >
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-green-400 mb-2">Payment Received</h2>
            <p className="text-slate-300">
              Paid on {format(new Date(invoice.paidAt!), 'dd MMMM yyyy, HH:mm')}
            </p>
          </motion.div>
        )}

        {/* Invoice Details */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="flex justify-between items-start border-b border-slate-700 pb-6">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Invoice Number</p>
                  <p className="text-lg font-mono text-white">{invoice.id}</p>
                </div>
                <Badge className={isPaid ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                  {isPaid ? <CheckCircle className="w-4 h-4 mr-1" /> : <Clock className="w-4 h-4 mr-1" />}
                  {invoice.status.toUpperCase()}
                </Badge>
              </div>

              {/* Customer & Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 mb-3">Bill To:</h3>
                  <div className="space-y-2">
                    <p className="text-white font-semibold">{invoice.customerName}</p>
                    {invoice.customerAddress && (
                      <p className="text-slate-400 text-sm flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{invoice.customerAddress}</span>
                      </p>
                    )}
                    {invoice.customerEmail && (
                      <p className="text-slate-400 text-sm flex items-center gap-2">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        {invoice.customerEmail}
                      </p>
                    )}
                    {invoice.customerPhone && (
                      <p className="text-slate-400 text-sm flex items-center gap-2">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        {invoice.customerPhone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Issue Date</p>
                    <p className="text-white">{format(new Date(invoice.issueDate), 'dd MMMM yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Due Date</p>
                    <p className="text-white">{format(new Date(invoice.dueDate), 'dd MMMM yyyy')}</p>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-3">Items:</h3>
                <div className="space-y-2">
                  {invoice.lineItems.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-white">{item.description || item.name}</p>
                        {item.quantity && item.unitPrice && (
                          <p className="text-sm text-slate-400">
                            {item.quantity} × £{item.unitPrice.toFixed(2)}
                          </p>
                        )}
                      </div>
                      <p className="text-white font-semibold">£{item.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t border-slate-700 pt-4 space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span>£{invoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>VAT ({invoice.vatRate}%):</span>
                  <span>£{invoice.vatAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold text-white pt-2 border-t border-slate-700">
                  <span>Total:</span>
                  <span>£{invoice.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Notes */}
              {invoice.notes && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-sm text-slate-400 mb-1">Notes:</p>
                  <p className="text-white">{invoice.notes}</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Actions */}
        {!showPaymentForm && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex flex-col sm:flex-row gap-4">
              {invoice.pdfUrl && (
                <Button
                  variant="secondary"
                  size="lg"
                  leftIcon={<Download className="w-5 h-5" />}
                  onClick={() => window.open(invoice.pdfUrl!, '_blank')}
                  className="flex-1"
                >
                  Download PDF
                </Button>
              )}

              {isPending && (
                <Button
                  variant="primary"
                  size="lg"
                  leftIcon={<CreditCard className="w-5 h-5" />}
                  onClick={handleProceedToPayment}
                  className="flex-1"
                >
                  Pay Now - £{invoice.total.toFixed(2)}
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* Payment Form */}
        {showPaymentForm && clientSecret && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <h2 className="text-2xl font-bold text-white mb-6">Complete Payment</h2>
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PaymentForm invoice={invoice} onSuccess={fetchInvoice} />
              </Elements>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
