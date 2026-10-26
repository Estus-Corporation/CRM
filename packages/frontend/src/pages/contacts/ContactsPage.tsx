import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Download, Trash2, Pencil, Users, User, Check } from 'lucide-react';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { cn } from '@/lib/utils';
import { useContacts, useCreateContact, useUpdateContact, useDeleteContact } from '@/hooks/useContacts';
import { contactsService, type Contact } from '@/services/contacts.service';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { ContactForm } from '@/components/contacts/ContactForm';
import { ImportContactsModal } from '@/components/contacts/ImportContactsModal';
import { NicheFilter } from '@/components/contacts/NicheFilter';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DataList, DataListBody, DataListHead, DataListRow, DataListSkeleton, listSpring } from '@/components/ui/DataList';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';

// Mesma grade no cabeçalho de colunas e em cada card — mantém as colunas alinhadas entre cards
// Celular: colunas "auto" — sem o modo de edição a coluna de ações some (display:none) e o nome ganha o espaço
const ROW_GRID =
  'grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[minmax(0,1fr)_92px_76px] md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_92px_76px] lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_92px_76px]';


const TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'lead', label: 'Leads' },
  { value: 'contact', label: 'Contatos' },
  { value: 'client', label: 'Clientes' },
];

const typeLabel: Record<string, string> = {
  lead: 'Lead',
  contact: 'Contato',
  client: 'Cliente',
};

const typeBadgeVariant: Record<string, 'green' | 'blue' | 'default'> = {
  lead: 'blue',
  contact: 'default',
  client: 'green',
};

export function ContactsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canDelete = user?.role === 'admin' || user?.role === 'manager';

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [nicheFilter, setNicheFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Celular: editar/excluir só aparecem nas linhas depois de tocar no lápis
  const [editMode, setEditMode] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useContacts({
    search: debouncedSearch || undefined,
    type: typeFilter || undefined,
    niche: nicheFilter || undefined,
  });

  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const contacts: Contact[] = data?.data ?? [];

  const openCreate = () => { setEditContact(null); setModalOpen(true); };
  const openEdit = (c: Contact) => { setEditContact(c); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditContact(null); };

  const handleSubmit = async (formData: {
    type: 'lead' | 'contact' | 'client';
    fullName: string;
    email?: string;
    phone?: string;
    companyName?: string;
    jobTitle?: string;
    source?: string;
    niche?: string;
  }) => {
    if (editContact) {
      await updateContact.mutateAsync({ id: editContact.id, input: formData });
    } else {
      await createContact.mutateAsync(formData);
    }
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este contato? Esta ação não pode ser desfeita.')) return;
    await deleteContact.mutateAsync(id);
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const blob = await contactsService.exportCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Exportação falhou — faça upgrade para Pro para exportar contatos');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contatos"
        subtitle={`${data?.meta?.total ?? 0} no total`}
        actions={
          <>
            {/* Celular: exportar/importar só com ícone; "Novo contato" ocupa o resto da linha */}
            <Button variant="secondary" size="sm" onClick={handleExport} disabled={exportLoading} aria-label="Exportar CSV" className="max-sm:h-11 max-sm:w-11 max-sm:px-0">
              <Download size={14} />
              <span className="max-sm:hidden">{exportLoading ? 'Exportando…' : 'Exportar CSV'}</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)} aria-label="Importar" className="max-sm:h-11 max-sm:w-11 max-sm:px-0">
              <Users size={14} />
              <span className="max-sm:hidden">Importar</span>
            </Button>
            <Button size="lg" onClick={openCreate} className="px-6 text-[15px] max-sm:h-11 max-sm:flex-1">
              <Plus size={18} strokeWidth={2.25} />
              Novo contato
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-sm:basis-full sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="input-base h-10 pl-9"
            placeholder="Buscar nome, e-mail, empresa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Celular: lápis liga o modo de edição (editar/excluir aparecem em cada linha) */}
        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          aria-pressed={editMode}
          aria-label={editMode ? 'Sair do modo de edição' : 'Editar contatos'}
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border transition-colors sm:hidden',
            editMode ? 'border-accent-green/60 bg-accent-green/15 text-accent-green' : 'border-fg/[0.1] bg-field text-text-secondary',
          )}
        >
          {editMode ? <Check size={16} /> : <Pencil size={16} />}
        </button>

        {/* Tipo: segmentado no desktop, um botão com dropdown no celular */}
        <SegmentedControl
          layoutId="contacts-filter-pill"
          options={TYPE_FILTER_OPTIONS}
          value={typeFilter}
          onChange={setTypeFilter}
          className="max-sm:hidden"
        />
        <SelectDropdown title="Tipo" options={TYPE_FILTER_OPTIONS} value={typeFilter} onChange={setTypeFilter} className="flex-1 sm:hidden" />

        <div className="sm:ml-auto">
          <NicheFilter value={nicheFilter} onChange={setNicheFilter} />
        </div>
      </div>

      {/* Lista: card único com o padrão compartilhado (DataList) */}
      {isLoading ? (
        <DataListSkeleton grid={ROW_GRID} cells={3} />
      ) : contacts.length === 0 ? (
        <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={listSpring}>
          <EmptyState
            icon={Users}
            title={debouncedSearch || nicheFilter ? 'Nenhum resultado' : 'Nenhum contato ainda'}
            description={
              debouncedSearch
                ? `Nada encontrado para "${debouncedSearch}". Tente outro termo.`
                : 'Adicione seu primeiro contato para começar a organizar seu pipeline.'
            }
            action={!debouncedSearch ? { label: 'Adicionar contato', onClick: openCreate } : undefined}
          />
        </motion.div>
      ) : (
        <DataList>
          <DataListHead grid={ROW_GRID}>
            <span>Nome</span>
            <span className="hidden md:block">Empresa</span>
            <span className="hidden md:block">Nicho</span>
            <span className="hidden lg:block">Telefone</span>
            <span>Tipo</span>
            <span className={cn(!editMode && 'max-sm:hidden')} />
          </DataListHead>

          <DataListBody>
            {contacts.map((c, i) => (
              <DataListRow key={c.id} grid={ROW_GRID} index={i} onClick={() => navigate(`/contacts/${c.id}`)}>
                <div className="flex min-w-0 items-center gap-3">
                  {c.type === 'client' ? (
                    c.has_photo ? (
                      <img
                        src={contactsService.photoUrl(c.id)}
                        alt={c.full_name}
                        className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <Avatar name={c.full_name} className="h-10 w-10" />
                    )
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-fg/[0.06]">
                      <User size={16} className="text-text-muted" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-medium text-text-primary">{c.full_name}</p>
                    {(c.job_title || c.email) && <p className="truncate text-xs text-text-muted">{c.job_title ?? c.email}</p>}
                  </div>
                </div>
                <span className="hidden truncate text-sm text-text-secondary md:block">{c.company_name ?? '—'}</span>
                <span className="hidden min-w-0 items-center md:flex">
                  {c.niche ? (
                    <span className="inline-block max-w-full truncate rounded-md bg-fg/[0.05] px-2 py-0.5 text-[12.5px] font-medium text-text-secondary">
                      {c.niche}
                    </span>
                  ) : (
                    <span className="text-sm text-text-muted">—</span>
                  )}
                </span>
                <span className="hidden truncate text-sm text-text-secondary lg:block">{c.phone ?? '—'}</span>
                <span>
                  <Badge variant={typeBadgeVariant[c.type] ?? 'default'}>{typeLabel[c.type] ?? c.type}</Badge>
                </span>
                <div
                  className={cn(
                    'flex justify-end gap-1 opacity-60 transition-opacity duration-200 group-hover:opacity-100',
                    editMode ? 'max-sm:opacity-100' : 'max-sm:hidden',
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => openEdit(c)}
                    className="rounded-lg p-2 text-text-muted transition-colors hover:bg-fg/[0.06] hover:text-text-primary"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="rounded-lg p-2 text-text-muted transition-colors hover:bg-status-lost/10 hover:text-status-lost"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </DataListRow>
            ))}
          </DataListBody>
        </DataList>
      )}

      {/* Pagination hint */}
      {data?.meta && data.meta.totalPages > 1 && (
        <p className="text-xs text-text-muted text-center">
          Page {data.meta.page} of {data.meta.totalPages}
        </p>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editContact ? 'Editar contato' : 'Novo contato'}
      >
        <ContactForm
          defaultValues={editContact ?? undefined}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          isSubmitting={createContact.isPending || updateContact.isPending}
        />
      </Modal>

      {/* Import Modal */}
      <AnimatePresence>
        {importOpen && <ImportContactsModal onClose={() => setImportOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
