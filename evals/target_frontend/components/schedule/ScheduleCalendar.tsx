"use client";

/**
 * ScheduleCalendar Component
 *
 * Full calendar view using react-big-calendar.
 * Supports month, week, and day views with event styling.
 */

import React, { useMemo, useState, useCallback } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type SlotInfo,
  type Event as CalendarEvent,
  type View,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/styles/schedule-calendar.css";
import { Box } from "@chakra-ui/react";
import type { ScheduledEvent } from "@/types/schedule";

// Configure date-fns localizer
const locales = {
  "en-US": require("date-fns/locale/en-US"),
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 0 }),
  getDay,
  locales,
});

interface ScheduleCalendarProps {
  events: ScheduledEvent[];
  onEventClick?: (event: ScheduledEvent) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
}

/**
 * Transform ScheduledEvent to react-big-calendar event format
 */
const transformEvent = (event: ScheduledEvent): CalendarEvent => {
  const bgColor =
    event.environment?.displayColor || event.color || "#3B82F6";

  return {
    title: event.title,
    start: new Date(event.startDate),
    end: event.endDate ? new Date(event.endDate) : new Date(event.startDate),
    resource: event,
    allDay: event.allDay,
  };
};

/**
 * ScheduleCalendar component
 * Renders full calendar with month/week/day views
 */
export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({
  events,
  onEventClick,
  onSelectSlot,
}) => {
  // View state management
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState(new Date());

  // Handle view change
  const handleViewChange = useCallback((newView: View) => {
    setView(newView);
  }, []);

  // Handle date navigation
  const handleNavigate = useCallback((newDate: Date) => {
    setDate(newDate);
  }, []);

  // Transform events to calendar format
  const calendarEvents = useMemo(
    () => events.map(transformEvent),
    [events]
  );

  // Event style getter - applies custom colors and styling based on status
  const eventStyleGetter = (event: CalendarEvent) => {
    const scheduledEvent = event.resource as ScheduledEvent;
    const bgColor =
      scheduledEvent.environment?.displayColor ||
      scheduledEvent.color ||
      "#3B82F6";

    const style: React.CSSProperties = {
      backgroundColor: bgColor,
      borderRadius: "4px",
      opacity: scheduledEvent.status === "completed" ? 0.6 : 1,
      color: "white",
      border: "none",
      display: "block",
    };

    // Add strikethrough for completed events
    if (scheduledEvent.status === "completed") {
      style.textDecoration = "line-through";
    }

    return {
      style,
    };
  };

  // Handle event selection
  const handleSelectEvent = (event: CalendarEvent) => {
    if (onEventClick) {
      onEventClick(event.resource as ScheduledEvent);
    }
  };

  // Handle slot selection (clicking empty calendar space)
  const handleSelectSlot = (slotInfo: SlotInfo) => {
    if (onSelectSlot) {
      onSelectSlot({
        start: slotInfo.start,
        end: slotInfo.end,
      });
    }
  };

  return (
    <Box
      height="600px"
      data-testid="schedule-calendar"
    >
      <Calendar
        localizer={localizer}
        events={calendarEvents}
        startAccessor="start"
        endAccessor="end"
        style={{ height: "100%" }}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        view={view}
        date={date}
        onView={handleViewChange}
        onNavigate={handleNavigate}
        selectable
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        eventPropGetter={eventStyleGetter}
        popup
      />
    </Box>
  );
};
