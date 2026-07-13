import { useMemo } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer, Event, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Calendar.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export interface CalendarEvent extends Event {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource?: any;
  type?: 'appointment' | 'availability' | 'blocked';
  status?: string;
  customerConfirmed?: boolean;
}

interface CalendarProps {
  events: CalendarEvent[];
  onSelectEvent?: (event: CalendarEvent) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date; action: string }) => void;
  defaultView?: View;
  defaultDate?: Date;
  selectable?: boolean;
  className?: string;
}

export function Calendar({
  events,
  onSelectEvent,
  onSelectSlot,
  defaultView = 'week',
  defaultDate = new Date(),
  selectable = true,
  className = '',
}: CalendarProps) {
  const { components, eventStyleGetter } = useMemo(() => {
    return {
      components: {
        event: ({ event }: { event: CalendarEvent }) => {
          const isConfirmed = event.customerConfirmed;
          const statusColor =
            event.status === 'confirmed'
              ? 'bg-green-500'
              : event.status === 'in_progress'
              ? 'bg-orange-500'
              : event.status === 'completed'
              ? 'bg-blue-500'
              : 'bg-primary-500';

          return (
            <div className="flex items-center gap-1 px-1">
              {isConfirmed && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
              )}
              <span className="truncate text-xs">{event.title}</span>
            </div>
          );
        },
      },
      eventStyleGetter: (event: CalendarEvent) => {
        let backgroundColor = '#3b82f6'; // primary-500
        let border = 'none';

        if (event.type === 'availability') {
          backgroundColor = '#10b981'; // green-500
          border = '2px dashed #059669';
        } else if (event.type === 'blocked') {
          backgroundColor = '#ef4444'; // red-500
        } else if (event.status === 'confirmed') {
          backgroundColor = '#10b981'; // green-500
        } else if (event.status === 'in_progress') {
          backgroundColor = '#f59e0b'; // orange-500
        } else if (event.status === 'completed') {
          backgroundColor = '#3b82f6'; // blue-500
        } else if (event.status === 'cancelled') {
          backgroundColor = '#6b7280'; // gray-500
        }

        return {
          style: {
            backgroundColor,
            border,
            borderRadius: '4px',
            color: 'white',
            fontSize: '12px',
            padding: '2px 4px',
          },
        };
      },
    };
  }, []);

  return (
    <div className={`calendar-wrapper ${className}`}>
      <BigCalendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        onSelectEvent={onSelectEvent}
        onSelectSlot={onSelectSlot}
        selectable={selectable}
        defaultView={defaultView}
        defaultDate={defaultDate}
        views={['month', 'week', 'day']}
        step={30}
        showMultiDayTimes
        components={components}
        eventPropGetter={eventStyleGetter}
        style={{ height: 600 }}
      />
    </div>
  );
}
