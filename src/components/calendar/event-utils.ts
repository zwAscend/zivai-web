// src/components/calendar/event-utils.ts
// import { EventInput } from '@fullcalendar/react';
// import EventInput from "@fullcalendar/react";
import { EventInput } from '@fullcalendar/common';

let eventGuid = 0;
const TODAY_STR = new Date().toISOString().replace(/T.*$/, ''); // YYYY-MM-DD of today

export function createEventId() {
  return String(eventGuid++);
}

export const INITIAL_EVENTS: EventInput[] = [
  {
    id: createEventId(),
    title: 'All-day event',
    start: TODAY_STR,
  },
  {
    id: createEventId(),
    title: 'Timed event',
    start: TODAY_STR + 'T12:00:00',
  },
  {
    id: createEventId(),
    title: 'Team Meeting',
    start: new Date().toISOString().split('T')[0] + 'T10:30:00',
    end: new Date().toISOString().split('T')[0] + 'T12:30:00'
  },
  {
    id: createEventId(),
    title: 'Lunch',
    start: new Date().toISOString().split('T')[0] + 'T12:00:00'
  }
];