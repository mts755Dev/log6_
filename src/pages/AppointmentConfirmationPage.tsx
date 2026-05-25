import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  AlertCircle,
  Loader,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

interface Appointment {
  id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  engineer_name: string;
  installation_notes: string | null;
  customer_confirmed: boolean;
  customer_confirmed_at: string | null;
  status: string;
}

export function AppointmentConfirmationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (token) {
      fetchAppointment();
    }
  }, [token]);

  const fetchAppointment = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('installation_appointments')
        .select('*')
        .eq('confirmation_token', token)
        .single();

      if (fetchError) throw fetchError;

      if (!data) {
        setError('Appointment not found');
        return;
      }

      setAppointment(data);

      // If already confirmed, show success
      if (data.customer_confirmed) {
        setConfirmed(true);
      }
    } catch (error: any) {
      console.error('Error fetching appointment:', error);
      setError('Failed to load appointment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!token) return;

    try {
      setIsConfirming(true);

      const { data, error: confirmError } = await supabase.rpc('confirm_appointment', {
        p_confirmation_token: token,
      });

      if (confirmError) throw confirmError;

      if (!data) {
        throw new Error('Failed to confirm appointment');
      }

      setConfirmed(true);
      await fetchAppointment(); // Refresh to get updated data
    } catch (error: any) {
      console.error('Error confirming appointment:', error);
      toast.error('Failed to confirm appointment. Please try again or contact us.');
    } finally {
      setIsConfirming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader className="w-12 h-12 text-primary-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading appointment details...</p>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Appointment Not Found</h2>
            <p className="text-slate-400 mb-6">
              {error || 'The appointment link is invalid or has expired.'}
            </p>
            <Button variant="primary" onClick={() => navigate('/')}>
              Go to Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Logo />
        </div>

        {/* Success Message */}
        {confirmed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-6"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-400 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-green-400">Appointment Confirmed!</h3>
                <p className="text-green-300 text-sm">
                  Thank you for confirming. We'll see you on{' '}
                  {format(new Date(appointment.scheduled_date), 'MMMM d, yyyy')}.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Appointment Details */}
        <Card>
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">
              {confirmed ? 'Appointment Confirmed' : 'Confirm Your Installation'}
            </h1>
            <p className="text-slate-400">
              {confirmed
                ? 'Your appointment has been confirmed.'
                : 'Please review your appointment details and confirm.'}
            </p>
          </div>

          <div className="space-y-6">
            {/* Date & Time */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                <CalendarIcon className="w-5 h-5 text-primary-400" />
                <h3 className="font-semibold text-white">Date & Time</h3>
              </div>
              <div className="space-y-2">
                <p className="text-lg text-white font-semibold">
                  {format(new Date(appointment.scheduled_date), 'EEEE, MMMM d, yyyy')}
                </p>
                <div className="flex items-center gap-2 text-slate-300">
                  <Clock className="w-4 h-4" />
                  <span>
                    {appointment.start_time} - {appointment.end_time}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Details */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                <User className="w-5 h-5 text-primary-400" />
                <h3 className="font-semibold text-white">Customer Details</h3>
              </div>
              <div className="space-y-2">
                <p className="text-white">{appointment.customer_name}</p>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <MapPin className="w-4 h-4" />
                  <span>{appointment.customer_address}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <Phone className="w-4 h-4" />
                  <span>{appointment.customer_phone}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <Mail className="w-4 h-4" />
                  <span>{appointment.customer_email}</span>
                </div>
              </div>
            </div>

            {/* Engineer */}
            {appointment.engineer_name && (
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-primary-400" />
                  <div>
                    <h3 className="font-semibold text-white">Your Engineer</h3>
                    <p className="text-slate-300">{appointment.engineer_name}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Installation Notes */}
            {appointment.installation_notes && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-400 mb-1">
                      Installation Notes:
                    </p>
                    <p className="text-sm text-blue-300">{appointment.installation_notes}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Confirmation Status */}
            <div className="pt-4 border-t border-slate-700">
              {confirmed || appointment.customer_confirmed ? (
                <div className="flex items-center justify-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">
                    Confirmed on{' '}
                    {appointment.customer_confirmed_at
                      ? format(new Date(appointment.customer_confirmed_at), 'MMM dd, yyyy HH:mm')
                      : 'just now'}
                  </span>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleConfirm}
                  isLoading={isConfirming}
                  leftIcon={<CheckCircle className="w-5 h-5" />}
                  className="w-full"
                >
                  Confirm Appointment
                </Button>
              )}
            </div>

            {/* Footer Note */}
            <div className="text-center text-sm text-slate-400 pt-4 border-t border-slate-700">
              <p>
                If you need to reschedule or have questions, please contact us.
              </p>
            </div>
          </div>
        </Card>

        {/* Back Button */}
        <div className="text-center mt-6">
          <Button variant="secondary" onClick={() => navigate('/')}>
            Go to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
