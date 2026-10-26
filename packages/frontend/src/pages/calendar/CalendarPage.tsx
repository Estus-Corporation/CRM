import { useCalendarEvents, useCreateEvent, useUpdateEvent, useDeleteEvent } from '@/hooks/useCalendar';
import { EventManagerCalendar } from '@/components/calendar/EventManagerCalendar';
import { Spinner } from '@/components/ui/Spinner';
import type { CreateEventInput } from '@/services/calendar.service';

export function CalendarPage() {
  const { data: events = [], isLoading } = useCalendarEvents();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const isSubmitting =
    createEvent.isPending || updateEvent.isPending || deleteEvent.isPending;

  async function handleCreate(input: CreateEventInput) {
    await createEvent.mutateAsync(input);
  }

  async function handleUpdate(id: string, input: Partial<CreateEventInput>) {
    await updateEvent.mutateAsync({ id, input });
  }

  async function handleDelete(id: string) {
    await deleteEvent.mutateAsync(id);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="text-2xl font-semibold text-text-primary">Calendário</h1>
      </div>

      <div className="flex-1 min-h-0">
        <EventManagerCalendar
          events={events}
          onEventCreate={handleCreate}
          onEventUpdate={handleUpdate}
          onEventDelete={handleDelete}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
