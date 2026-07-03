import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Download, Trash2, Pencil, Users, User } from 'lucide-react';
import { useContacts, useCreateContact, useUpdateContact, useDeleteContact } from '@/hooks/useContacts';
import { contactsService, type Contact } from '@/services/contacts.service';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { ContactForm } from '@/components/contacts/ContactForm';
import { ImportContactsModal } from '@/components/contacts/ImportContactsModal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';

const TYPE_FILTER_OPTIONS = [
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
  const [modalOpen, setModalOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useContacts({
    search: debouncedSearch || undefined,
    type: typeFilter || undefined,
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
            <Button variant="secondary" size="sm" onClick={handleExport} disabled={exportLoading}>
              <Download size={14} />
              {exportLoading ? 'Exportando…' : 'Exportar CSV'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
              <Users size={14} />
              Importar
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} />
              Novo contato
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="input-base pl-8"
            placeholder="Buscar nome, e-mail, empresa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {TYPE_FILTER_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setTypeFilter(o.value)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                typeFilter === o.value
                  ? 'bg-accent-green text-bg-darker'
                  : 'bg-bg-surface text-text-secondary border border-bg-border hover:text-text-primary'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title={debouncedSearch ? 'Nenhum resultado' : 'Nenhum contato ainda'}
            description={
              debouncedSearch
                ? `Nada encontrado para "${debouncedSearch}". Tente outro termo.`
                : 'Adicione seu primeiro contato para começar a organizar seu pipeline.'
            }
            action={!debouncedSearch ? { label: 'Adicionar contato', onClick: openCreate } : undefined}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bg-border text-text-muted text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Empresa</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Telefone</th>
                <th className="text-left px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-bg-border last:border-0 hover:bg-bg-surface/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/contacts/${c.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {c.type === 'client' ? (
                        c.has_photo ? (
                          <img
                            src={contactsService.photoUrl(c.id)}
                            alt={c.full_name}
                            className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <Avatar name={c.full_name} size="md" />
                        )
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-bg-border flex items-center justify-center flex-shrink-0">
                          <User size={14} className="text-text-muted" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-text-primary">{c.full_name}</p>
                        {c.job_title && (
                          <p className="text-xs text-text-muted">{c.job_title}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                    {c.company_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">
                    {c.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={typeBadgeVariant[c.type] ?? 'default'}>{typeLabel[c.type] ?? c.type}</Badge>
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-border transition-colors"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded text-text-muted hover:text-status-lost hover:bg-status-lost/10 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
      {importOpen && <ImportContactsModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}
