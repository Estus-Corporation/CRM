import { useCalendarEvents, useCreateEvent, useUpdateEvent, useDeleteEvent } from '@/hooks/useCalendar';
import { EventManagerCalendar } from '@/components/calendar/EventManagerCalendar';
import { Spinner } from '@/components/ui/Spinner';
import type { CreateEventInput } from '@/services/calendar.service';
import { usePageSubtitle } from '@/store/pageStore';

export function CalendarPage() {
  usePageSubtitle('Reuniões, compromissos e eventos da equipe');
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
      <div className="mb-5 flex flex-shrink-0 items-center justify-between">
        <h1 className="page-title">Calendário</h1>
      </div>

      {/* Coluna flexível até o fim da tela: o calendário ocupa o que sobra abaixo do título */}
      <div className="flex min-h-0 flex-1 flex-col">
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
