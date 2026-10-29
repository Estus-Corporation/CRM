import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Baixa um Blob com o nome escolhido (o Content-Disposition do backend não é legível entre origens) */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revogar na hora faz Safari/Firefox antigos perderem o download
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Telefone BR enquanto digita: (16) 99238-6188 / (16) 3333-4444 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Envolve o `register('phone')` do React Hook Form aplicando a máscara a cada tecla */
export function withPhoneMask<T extends { onChange: (e: { target: { value: string } }) => unknown }>(field: T): T {
  return {
    ...field,
    onChange: (e: { target: { value: string } }) => {
      e.target.value = formatPhone(e.target.value);
      return field.onChange(e);
    },
  };
}

/** Aplica uma transformação no valor digitado (mesmo formato do withPhoneMask) */
export function withTransform<T extends { onChange: (e: { target: { value: string } }) => unknown }>(
  field: T,
  fn: (value: string) => string,
): T {
  return {
    ...field,
    onChange: (e: { target: { value: string } }) => {
      e.target.value = fn(e.target.value);
      return field.onChange(e);
    },
  };
}

export const lowerEmail = (v: string) => v.toLowerCase().replace(/\s/g, '');

// Preposições que ficam minúsculas no meio do nome ("Maria da Silva")
const NAME_LOWER = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);

/** Nome com a primeira letra de cada palavra maiúscula (mantém o resto como digitado) */
/** Primeiro e último nome ("Lucca Periotto" de "Lucca de Souza Periotto") */
export function shortName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0];
}

export function capitalizeName(value: string): string {
  return value.replace(/(^|\s)(\S)(\S*)/g, (_m, sp: string, first: string, rest: string, offset: number) => {
    const word = (first + rest).toLowerCase();
    if (offset > 0 && NAME_LOWER.has(word)) return sp + word;
    return sp + first.toUpperCase() + rest;
  });
}

/** Cargos prontos pra escolher (pessoa de contato / lead); "Outro" abre campo livre */
export const JOB_TITLE_OPTIONS = [
  'Dono(a)',
  'Sócio(a)',
  'Gerente',
  'Diretor(a)',
  'Atendente',
  'Recepcionista',
  'Secretário(a)',
  'Comprador(a)',
  'Marketing',
  'Financeiro',
];
