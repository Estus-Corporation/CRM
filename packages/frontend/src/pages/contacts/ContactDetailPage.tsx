import { useParams, useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { ArrowLeft, Pencil, Mail, Phone, Building2, Briefcase, Globe, UserCheck, User, Camera, Trash2 } from 'lucide-react';
import { useContact, useUpdateContact, useUploadContactPhoto, useDeleteContactPhoto } from '@/hooks/useContacts';
import { ActivityTimeline } from '@/components/activities/ActivityTimeline';
import { ContractSection } from '@/components/contacts/ContractSection';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { contactsService } from '@/services/contacts.service';
import { ContactForm } from '@/components/contacts/ContactForm';
import { useState } from 'react';

const typeBadgeVariant: Record<string, 'green' | 'blue' | 'default'> = {
  lead: 'blue',
  contact: 'default',
  client: 'green',
};

const typeLabel: Record<string, string> = {
  lead: 'Lead',
  contact: 'Contato',
  client: 'Cliente',
};

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: contact, isLoading } = useContact(id!);
  const updateContact = useUpdateContact();
  const uploadPhoto = useUploadContactPhoto();
  const deletePhoto = useDeleteContactPhoto();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="text-center py-24 text-text-muted">Contato não encontrado.</div>
    );
  }

  const handleUpdate = async (formData: Parameters<typeof updateContact.mutateAsync>[0]['input']) => {
    await updateContact.mutateAsync({ id: contact.id, input: formData });
    setEditOpen(false);
  };

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadPhoto.mutateAsync({ id: contact.id, file });
    } catch {
      // toast já exibido pelo hook
    } finally {
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async () => {
    try {
      await deletePhoto.mutateAsync(contact.id);
    } catch {
      // toast já exibido pelo hook
    }
  };

  const isPhotoLoading = uploadPhoto.isPending || deletePhoto.isPending;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/contacts')}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="page-title-sm flex-1">{contact.full_name}</h1>
        <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil size={13} /> Editar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — profile + contracts (clients only) */}
        <div className="flex flex-col gap-5">
          <div className="card p-5 space-y-5">
            <div className="flex flex-col items-center text-center gap-3">

              {/* Avatar / foto com controles inline para clientes */}
              {contact.type === 'client' ? (
                <div className="relative group">
                  {contact.has_photo ? (
                    <img
                      src={`${contactsService.photoUrl(contact.id)}?t=${contact.updated_at}`}
                      alt={contact.full_name}
                      className="h-20 w-20 rounded-full object-cover border-2 border-bg-border"
                    />
                  ) : (
                    <Avatar name={contact.full_name} size="lg" />
                  )}

                  {isPhotoLoading && (
                    <div className="absolute inset-0 rounded-full bg-bg-darker/70 flex items-center justify-center">
                      <Spinner />
                    </div>
                  )}

                  {/* Botão de trocar foto */}
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isPhotoLoading}
                    title="Trocar foto"
                    className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-bg-surface border border-bg-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent-green/10 hover:border-accent-green/40 disabled:opacity-50"
                  >
                    <Camera size={11} className="text-text-secondary" />
                  </button>

                  {/* Botão de remover foto */}
                  {contact.has_photo && (
                    <button
                      onClick={handleDeletePhoto}
                      disabled={isPhotoLoading}
                      title="Remover foto"
                      className="absolute top-0 right-0 w-5 h-5 rounded-full bg-bg-surface border border-bg-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-status-lost/10 hover:border-status-lost/40 disabled:opacity-50"
                    >
                      <Trash2 size={9} className="text-text-muted" />
                    </button>
                  )}

                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    className="hidden"
                    onChange={handlePhotoFile}
                  />
                </div>
              ) : (
                <div className="h-10 w-10 rounded-full bg-bg-border flex items-center justify-center flex-shrink-0">
                  <User size={20} className="text-text-muted" />
                </div>
              )}

              <div>
                <p className="font-semibold text-text-primary">{contact.full_name}</p>
                {contact.job_title && (
                  <p className="text-sm text-text-secondary">{contact.job_title}</p>
                )}
                <Badge variant={typeBadgeVariant[contact.type] ?? 'default'} className="mt-2">
                  {typeLabel[contact.type] ?? contact.type}
                </Badge>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              {contact.email && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Mail size={14} className="flex-shrink-0 text-text-muted" />
                  <a href={`mailto:${contact.email}`} className="hover:text-accent-green truncate">
                    {contact.email}
                  </a>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Phone size={14} className="flex-shrink-0 text-text-muted" />
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.company_name && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Building2 size={14} className="flex-shrink-0 text-text-muted" />
                  <span>{contact.company_name}</span>
                </div>
              )}
              {contact.job_title && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Briefcase size={14} className="flex-shrink-0 text-text-muted" />
                  <span>{contact.job_title}</span>
                </div>
              )}
              {contact.source && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Globe size={14} className="flex-shrink-0 text-text-muted" />
                  <span className="capitalize">{contact.source}</span>
                </div>
              )}
            </div>

            {contact.tags && contact.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {contact.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-bg-border text-xs text-text-muted space-y-2">
              {contact.type !== 'client' && (
                <div className="flex items-center gap-2">
                  <UserCheck size={13} className="flex-shrink-0" />
                  {contact.owner_name ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar name={contact.owner_name} size="sm" />
                      <span className="text-text-secondary">{contact.owner_name}</span>
                    </div>
                  ) : (
                    <span>Sem responsável</span>
                  )}
                </div>
              )}
              <p>Criado em: {new Date(contact.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>

          {contact.type === 'client' && <ContractSection contactId={contact.id} />}
        </div>

        {/* Right — activity timeline */}
        <div className="lg:col-span-2 card p-5">
          <ActivityTimeline contactId={contact.id} />
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar contato">
        <ContactForm
          defaultValues={contact}
          onSubmit={handleUpdate}
          onCancel={() => setEditOpen(false)}
          isSubmitting={updateContact.isPending}
        />
      </Modal>
    </div>
  );
}
