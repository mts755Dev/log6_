import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Calendar, CalendarEvent } from '../../components/ui/Calendar';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';

interface AvailabilitySlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  notes: string | null;
}

interface Appointment {
  id: string;
  quote_id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  status: string;
  customer_confirmed: boolean;
}

export function EngineerAvailabilityPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [availabilityForm, setAvailabilityForm] = useState({
    notes: '',
    isAvailable: true,
  });

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      const startDate = startOfMonth(new Date());
      const endDate = endOfMonth(addMonths(new Date(), 2));

      // Fetch availability
      const { data: availData, error: availError } = await supabase
        .from('engineer_availability')
        .select('*')
        .eq('engineer_id', user?.id)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      if (availError) throw availError;
      setAvailability(availData || []);

      // Fetch appointments
      const { data: aptData, error: aptError } = await supabase
        .from('installation_appointments')
        .select('*')
        .eq('engineer_id', user?.id)
        .gte('scheduled_date', format(startDate, 'yyyy-MM-dd'))
        .lte('scheduled_date', format(endDate, 'yyyy-MM-dd'))
        .in('status', ['scheduled', 'confirmed', 'in_progress']);

      if (aptError) throw aptError;
      setAppointments(aptData || []);

      // Convert to calendar events
      const calendarEvents: CalendarEvent[] = [];

      // Add availability slots
      (availData || []).forEach((slot) => {
        const startDateTime = new Date(`${slot.date}T${slot.start_time}`);
        const endDateTime = new Date(`${slot.date}T${slot.end_time}`);

        calendarEvents.push({
          id: `avail-${slot.id}`,
          title: slot.is_available ? 'Available' : 'Unavailable',
          start: startDateTime,
          end: endDateTime,
          resource: slot,
          type: slot.is_available ? 'availability' : 'blocked',
        });
      });

      // Add appointments
      (aptData || []).forEach((apt) => {
        const startDateTime = new Date(`${apt.scheduled_date}T${apt.start_time}`);
        const endDateTime = new Date(`${apt.scheduled_date}T${apt.end_time}`);

        calendarEvents.push({
          id: `apt-${apt.id}`,
          title: `Installation: ${apt.customer_name}`,
          start: startDateTime,
          end: endDateTime,
          resource: apt,
          type: 'appointment',
          status: apt.status,
          customerConfirmed: apt.customer_confirmed,
        });
      });

      setEvents(calendarEvents);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load availability');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    setSelectedSlot(slotInfo);
    setShowAddModal(true);
  };

  const handleSaveAvailability = async () => {
    if (!selectedSlot || !user?.id) return;

    try {
      setIsSaving(true);

      const { error } = await supabase.from('engineer_availability').insert({
        engineer_id: user.id,
        date: format(selectedSlot.start, 'yyyy-MM-dd'),
        start_time: format(selectedSlot.start, 'HH:mm:ss'),
        end_time: format(selectedSlot.end, 'HH:mm:ss'),
        is_available: availabilityForm.isAvailable,
        notes: availabilityForm.notes || null,
      });

      if (error) throw error;

      toast.success(
        availabilityForm.isAvailable
          ? 'Availability added successfully!'
          : 'Time marked as unavailable'
      );
      setShowAddModal(false);
      setSelectedSlot(null);
      setAvailabilityForm({ notes: '', isAvailable: true });
      fetchData();
    } catch (error: any) {
      console.error('Error saving availability:', error);
      toast.error('Failed to save availability');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAvailability = async (id: string) => {
    if (!confirm('Are you sure you want to delete this availability slot?')) return;

    try {
      const { error } = await supabase
        .from('engineer_availability')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Availability deleted');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting availability:', error);
      toast.error('Failed to delete availability');
    }
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.type === 'availability' || event.type === 'blocked') {
      const slot = event.resource as AvailabilitySlot;
      if (confirm('Delete this availability slot?')) {
        handleDeleteAvailability(slot.id);
      }
    } else if (event.type === 'appointment') {
      const apt = event.resource as Appointment;
      toast.info(`Appointment: ${apt.customer_name} (${apt.status})`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-slate-400">Loading availability...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">My Availability</h1>
        <p className="page-subtitle">Manage your working hours and availability</p>
      </div>

      {/* Instructions */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-400 font-semibold mb-1">How to Manage Availability:</p>
            <ol className="text-sm text-blue-300 space-y-1">
              <li>1. Click and drag on the calendar to select a time slot</li>
              <li>2. Choose "Available" or "Unavailable"</li>
              <li>3. Add optional notes</li>
              <li>4. Click existing slots to delete them</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-green-500/10 border-green-500/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Available Slots</p>
              <p className="text-2xl font-bold text-white">
                {availability.filter((a) => a.is_available).length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-orange-500/10 border-orange-500/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Scheduled Jobs</p>
              <p className="text-2xl font-bold text-white">{appointments.length}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-red-500/10 border-red-500/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Blocked Time</p>
              <p className="text-2xl font-bold text-white">
                {availability.filter((a) => !a.is_available).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white mb-2">Availability Calendar</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-dashed border-green-500 bg-green-500/20" />
              <span className="text-slate-400">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500" />
              <span className="text-slate-400">Blocked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary-500" />
              <span className="text-slate-400">Scheduled Job</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500" />
              <span className="text-slate-400">Confirmed Job</span>
            </div>
          </div>
        </div>

        <Calendar
          events={events}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          selectable={true}
        />
      </Card>

      {/* Upcoming Appointments */}
      <Card>
        <h2 className="text-xl font-bold text-white mb-4">Upcoming Appointments</h2>

        {appointments.length === 0 ? (
          <div className="text-center py-8">
            <CalendarIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No upcoming appointments</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.slice(0, 5).map((apt) => (
              <div
                key={apt.id}
                className="bg-slate-800/50 rounded-lg p-4 border border-slate-700"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-white mb-1">{apt.customer_name}</p>
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4" />
                        {format(new Date(apt.scheduled_date), 'MMM dd, yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {apt.start_time} - {apt.end_time}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {apt.customer_confirmed && (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Confirmed
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        apt.status === 'confirmed'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-primary-500/20 text-primary-400'
                      }`}
                    >
                      {apt.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Availability Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSelectedSlot(null);
          setAvailabilityForm({ notes: '', isAvailable: true });
        }}
        title="Set Availability"
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

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Status *</label>
            <div className="flex gap-4">
              <button
                onClick={() => setAvailabilityForm({ ...availabilityForm, isAvailable: true })}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                  availabilityForm.isAvailable
                    ? 'border-green-500 bg-green-500/20 text-green-400'
                    : 'border-slate-700 bg-slate-800 text-slate-400'
                }`}
              >
                <CheckCircle className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm font-medium">Available</span>
              </button>
              <button
                onClick={() => setAvailabilityForm({ ...availabilityForm, isAvailable: false })}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                  !availabilityForm.isAvailable
                    ? 'border-red-500 bg-red-500/20 text-red-400'
                    : 'border-slate-700 bg-slate-800 text-slate-400'
                }`}
              >
                <XCircle className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm font-medium">Unavailable</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={availabilityForm.notes}
              onChange={(e) => setAvailabilityForm({ ...availabilityForm, notes: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
              rows={3}
              placeholder="Add any notes about this time slot..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddModal(false);
                setSelectedSlot(null);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveAvailability}
              isLoading={isSaving}
              leftIcon={<Save className="w-4 h-4" />}
              className="flex-1"
            >
              Save Availability
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
