import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
