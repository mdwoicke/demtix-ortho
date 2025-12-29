/**
 * CalendarView Component
 * FullCalendar wrapper for appointment visualization
 */

import { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DateSelectArg } from '@fullcalendar/core';
import type { Appointment } from '../../../types';

export interface CalendarViewProps {
  appointments: Appointment[];
  onEventClick?: (appointment: Appointment) => void;
  onDateSelect?: (start: Date, end: Date) => void;
  initialView?: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';
}

export function CalendarView({
  appointments,
  onEventClick,
  onDateSelect,
  initialView = 'dayGridMonth',
}: CalendarViewProps) {
  // Convert appointments to FullCalendar events
  const events = useMemo(() => {
    return appointments.map((appointment) => {
      const statusColor = {
        confirmed: '#10b981', // green-500
        pending: '#f59e0b', // amber-500
        cancelled: '#ef4444', // red-500
      }[appointment.status || 'pending'];

      // Calculate end time from start_time and duration/appointment_minutes
      const startTime = appointment.start_time || appointment.appointment_date_time;
      const durationMinutes = appointment.duration || appointment.appointment_minutes || 30;
      const endTime = startTime ? new Date(new Date(startTime).getTime() + durationMinutes * 60000).toISOString() : undefined;

      return {
        id: appointment.appointment_guid,
        title: `${appointment.patientName || appointment.patient_first_name || 'Patient'} - ${
          appointment.appointment_type_name || appointment.appointment_type_description || 'Appointment'
        }`,
        start: startTime,
        end: endTime,
        backgroundColor: statusColor,
        borderColor: statusColor,
        extendedProps: {
          appointment,
        },
      };
    });
  }, [appointments]);

  const handleEventClick = (info: EventClickArg) => {
    if (onEventClick) {
      const appointment = info.event.extendedProps.appointment as Appointment;
      onEventClick(appointment);
    }
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    if (onDateSelect) {
      onDateSelect(selectInfo.start, selectInfo.end);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={initialView}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        events={events}
        eventClick={handleEventClick}
        select={handleDateSelect}
        selectable={!!onDateSelect}
        selectMirror={true}
        dayMaxEvents={true}
        weekends={true}
        height="auto"
        eventDisplay="block"
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short',
        }}
      />
    </div>
  );
}
