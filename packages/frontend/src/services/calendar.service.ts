import { api } from './api';

export interface CalendarEvent {
  id: string;
  tenant_id: string;
  created_by: string;
  deal_id: string | null;
  contact_id: string | null;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  creator_name: string;
  contact_name: string | null;
  deal_title: string | null;
  attendees: { event_id: string; user_id: string; user_name: string; status: string }[];
  /** Convidados do lado do cliente (sem conta): nome e cargo */
  external_attendees: ExternalAttendee[];
}

export interface ExternalAttendee {
  name: string;
  title?: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  dealId?: string;
  contactId?: string;
  attendeeIds?: string[];
  externalAttendees?: ExternalAttendee[];
}

export const calendarService = {
  async list(from?: string, to?: string): Promise<CalendarEvent[]> {
    const { data } = await api.get<{ data: CalendarEvent[] }>('/calendar/events', {
      params: { from, to },
    });
    return data.data;
  },

  async create(input: CreateEventInput): Promise<CalendarEvent> {
    const { data } = await api.post<{ data: CalendarEvent }>('/calendar/events', input);
    return data.data;
  },

  async update(id: string, input: Partial<CreateEventInput>): Promise<CalendarEvent> {
    const { data } = await api.patch<{ data: CalendarEvent }>(`/calendar/events/${id}`, input);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/calendar/events/${id}`);
  },
};
