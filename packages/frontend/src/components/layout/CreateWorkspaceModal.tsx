import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateWorkspace } from '@/hooks/useWorkspaces';
import type { KeyPerson } from '@/hooks/useTenant';
import { useUsers } from '@/hooks/useUsers';
import { useAuthStore } from '@/store/authStore';
import { KeyPeopleEditor, cleanKeyPeople } from '@/components/company/KeyPeopleEditor';

/** Novo workspace próprio: a pessoa vira admin, entra nele e segue pro onboarding */
export function CreateWorkspaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  // Quem cria já vem como fundador
  const creator = (): KeyPerson[] => (user ? [{ name: user.full_name, title: 'Fundador', email: user.email }] : []);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [people, setPeople] = useState<KeyPerson[]>(creator);
  const { data: users } = useUsers();
  const members = (users?.data ?? []).map((u) => ({ name: u.full_name, email: u.email }));
  const create = useCreateWorkspace();
  const emailValid = !email.trim() || /^\S+@\S+\.\S+$/.test(email.trim());
  const valid = name.trim().length >= 2 && emailValid;

  const reset = () => {
    setName('');
    setEmail('');
    setPeople(creator());
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-lg"
      title="Criar novo workspace"
      description="Um espaço só seu, com contatos, pipeline e equipe próprios. Você continua nos outros workspaces."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          create.mutate(
            { name: name.trim(), email: email.trim() || undefined, keyPeople: cleanKeyPeople(people) },
            { onSuccess: () => { reset(); onClose(); } },
          );
        }}
        className="space-y-4"
      >
        <Input
          id="workspace-name"
          label="Nome do workspace (ou da empresa) *"
          placeholder="Ex.: Minha Agência"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          autoFocus
        />
        <Input
          id="workspace-email"
          type="email"
          label="E-mail da empresa"
          placeholder="contato@minhaagencia.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={255}
          error={emailValid ? undefined : 'E-mail inválido'}
        />
        <KeyPeopleEditor value={people} onChange={setPeople} members={members} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!valid || create.isPending}>
            {create.isPending ? 'Criando…' : 'Criar workspace'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
