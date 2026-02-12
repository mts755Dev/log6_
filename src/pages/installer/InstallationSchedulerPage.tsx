import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Save,
  AlertCircle,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Calendar, CalendarEvent } from '../../components/ui/Calendar';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { format, addHours, startOfMonth, endOfMonth } from 'date-fns';

interface Quote {
  id: string;
  reference: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  status: string;
  customerAvailability?: {
    dates: string[];
    timeSlot: 'morning' | 'afternoon' | 'fullday';
    notes?: string;
    submittedAt: string;
  };
}

interface Engineer {
  id: string;
  name: string;
  email: string;
  existing_appointments: number;
}

interface Appointment {
  id: string;
  quote_id: string;
  engineer_id: string;
  engineer_name: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  status: string;
  customer_confirmed: boolean;
}

export function InstallationSchedulerPage() {
  const [searchParams] = useSearchParams();
  const quoteId = searchParams.get('quoteId');
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [scheduleForm, setScheduleForm] = useState({
    engineerId: '',
    notes: '',
  });

  useEffect(() => {
    if (user?.companyId) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Fetch quote if provided
      if (quoteId) {
        const { data: quoteData, error: quoteError } = await supabase
          .from('quotes')
          .select('id, reference, customer, status, customer_availability')
          .eq('id', quoteId)
          .single();

        if (quoteError) throw quoteError;
        
        // Map customer_availability to camelCase
        const mappedQuote = {
          ...quoteData,
          customerAvailability: quoteData.customer_availability,
        };
        
        setQuote(mappedQuote);
      }

      // Fetch appointments
      const startDate = startOfMonth(new Date());
      const endDate = endOfMonth(addHours(new Date(), 24 * 60)); // 2 months ahead

      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('installation_appointments')
        .select('*')
        .eq('company_id', user?.companyId)
        .gte('scheduled_date', format(startDate, 'yyyy-MM-dd'))
        .lte('scheduled_date', format(endDate, 'yyyy-MM-dd'))
        .in('status', ['scheduled', 'confirmed', 'in_progress']);

      if (appointmentsError) throw appointmentsError;

      setAppointments(appointmentsData || []);

      // Convert to calendar events
      const calendarEvents: CalendarEvent[] = (appointmentsData || []).map((apt) => {
        const startDateTime = new Date(`${apt.scheduled_date}T${apt.start_time}`);
        const endDateTime = new Date(`${apt.scheduled_date}T${apt.end_time}`);

        return {
          id: apt.id,
          title: `${apt.customer_name} - ${apt.engineer_name || 'Unassigned'}`,
          start: startDateTime,
          end: endDateTime,
          resource: apt,
          type: 'appointment',
          status: apt.status,
          customerConfirmed: apt.customer_confirmed,
        };
      });

      setEvents(calendarEvents);

      // Fetch engineers
      const { data: engineersData, error: engineersError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('company_id', user?.companyId)
        .eq('role', 'engineer')
        .eq('is_active', true);

      if (engineersError) throw engineersError;
      
      // Map full_name to name for consistency
      const mappedEngineers = (engineersData || []).map(eng => ({
        id: eng.id,
        name: eng.full_name || eng.email.split('@')[0],
        email: eng.email,
        existing_appointments: 0,
      }));
      
      setEngineers(mappedEngineers);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load scheduler data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    if (!quoteId) {
      toast.error('Please select a quote first');
      return;
    }

    setSelectedSlot(slotInfo);
    setShowScheduleModal(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    const appointment = event.resource as Appointment;
    // Navigate to appointment details or show edit modal
    toast.info(`Appointment: ${appointment.customer_name}`);
  };

  const handleSchedule = async () => {
    if (!selectedSlot || !scheduleForm.engineerId || !quoteId) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsSaving(true);

      const { data, error } = await supabase.rpc('schedule_installation_appointment', {
        p_quote_id: quoteId,
        p_engineer_id: scheduleForm.engineerId,
        p_scheduled_date: format(selectedSlot.start, 'yyyy-MM-dd'),
        p_start_time: format(selectedSlot.start, 'HH:mm:ss'),
        p_end_time: format(selectedSlot.end, 'HH:mm:ss'),
        p_notes: scheduleForm.notes || null,
      });

      if (error) throw error;

      toast.success('Installation scheduled successfully!');
      setShowScheduleModal(false);
      setScheduleForm({ engineerId: '', notes: '' });
      setSelectedSlot(null);

      // Refresh data
      await fetchData();

      // Navigate back to quote detail if we came from there
      if (quoteId) {
        navigate(`/installer/quotes/${quoteId}`);
      }
    } catch (error: any) {
      console.error('Error scheduling:', error);
      toast.error(error.message || 'Failed to schedule installation');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-slate-400">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="page-title">Installation Scheduler</h1>
            <p className="page-subtitle">Schedule and manage installation appointments</p>
          </div>
        </div>

        {quote && (
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <p className="text-sm text-slate-400">Scheduling for:</p>
            <p className="font-semibold text-white">{quote.reference} - {quote.customer.name}</p>
          </div>
        )}
      </div>

      {/* Customer Availability */}
      {quote?.customerAvailability && (
        <Card className="bg-gradient-to-br from-success-500/10 to-success-600/5 border-success-500/20">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-success-400" />
            <h3 className="text-lg font-semibold text-white">Customer Availability</h3>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400 mb-2">Customer is available on these dates:</p>
              <div className="flex flex-wrap gap-2">
                {quote.customerAvailability.dates.map((date, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-success-500/20 border border-success-500/30 rounded-lg px-3 py-2"
                  >
                    <CalendarIcon className="w-4 h-4 text-success-400" />
                    <span className="text-sm text-white font-medium">
                      {format(new Date(date), 'EEEE, dd MMM yyyy')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg">
              <Clock className="w-5 h-5 text-success-400" />
              <div>
                <span className="text-xs text-slate-400">Preferred Time:</span>
                <p className="text-sm text-white font-medium">
                  {quote.customerAvailability.timeSlot === 'morning' && '🌅 Morning (8AM - 12PM)'}
                  {quote.customerAvailability.timeSlot === 'afternoon' && '☀️ Afternoon (12PM - 5PM)'}
                  {quote.customerAvailability.timeSlot === 'fullday' && '📅 Full Day (Flexible)'}
                </p>
              </div>
            </div>

            {quote.customerAvailability.notes && (
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Additional Notes:</p>
                <p className="text-sm text-slate-300">{quote.customerAvailability.notes}</p>
              </div>
            )}

            <div className="pt-2 border-t border-slate-700">
              <p className="text-xs text-slate-500">
                💡 Try to schedule within the customer's preferred dates for better experience
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Instructions */}
      {quoteId && !quote?.status.includes('scheduled') && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-400 font-semibold mb-1">How to Schedule:</p>
              <ol className="text-sm text-blue-300 space-y-1">
                <li>1. Click and drag on the calendar to select a time slot</li>
                <li>2. Choose an available engineer</li>
                <li>3. Add any installation notes</li>
                <li>4. Click "Schedule" to confirm</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-500/10 border-blue-500/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">This Month</p>
              <p className="text-2xl font-bold text-white">
                {appointments.filter((a) => new Date(a.scheduled_date).getMonth() === new Date().getMonth()).length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-green-500/10 border-green-500/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Confirmed</p>
              <p className="text-2xl font-bold text-white">
                {appointments.filter((a) => a.customer_confirmed).length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Pending</p>
              <p className="text-2xl font-bold text-white">
                {appointments.filter((a) => !a.customer_confirmed).length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-purple-500/10 border-purple-500/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <User className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Engineers</p>
              <p className="text-2xl font-bold text-white">{engineers.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white mb-2">Calendar</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary-500" />
              <span className="text-slate-400">Scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500" />
              <span className="text-slate-400">Confirmed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-500" />
              <span className="text-slate-400">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-slate-400">Customer Confirmed</span>
            </div>
          </div>
        </div>

        <Calendar
          events={events}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          selectable={!!quoteId}
        />
      </Card>

      {/* Schedule Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          setSelectedSlot(null);
          setScheduleForm({ engineerId: '', notes: '' });
        }}
        title="Schedule Installation"
      >
        <div className="space-y-4">
          {selectedSlot && (
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-sm text-slate-400 mb-2">Selected Time Slot:</p>
              <p className="text-white font-semibold">
                {format(selectedSlot.start, 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="text-slate-300">
                {format(selectedSlot.start, 'HH:mm')} - {format(selectedSlot.end, 'HH:mm')}
              </p>
            </div>
          )}

          {quote && (
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-sm text-slate-400 mb-2">Customer:</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white">
                  <User className="w-4 h-4 text-slate-400" />
                  {quote.customer.name}
                </div>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {quote.customer.address}
                </div>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {quote.customer.phone}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Assign Engineer *
            </label>
            <select
              value={scheduleForm.engineerId}
              onChange={(e) => setScheduleForm({ ...scheduleForm, engineerId: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
            >
              <option value="">Select an engineer...</option>
              {engineers.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.name} ({eng.email})
                </option>
              ))}
            </select>
            {engineers.length === 0 && (
              <p className="text-xs text-red-400 mt-1">
                No engineers available. Please create engineer accounts first.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Installation Notes (Optional)
            </label>
            <textarea
              value={scheduleForm.notes}
              onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
              rows={3}
              placeholder="Add any special instructions or notes..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowScheduleModal(false);
                setSelectedSlot(null);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSchedule}
              isLoading={isSaving}
              disabled={!scheduleForm.engineerId}
              leftIcon={<Save className="w-4 h-4" />}
              className="flex-1"
            >
              Schedule Installation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
