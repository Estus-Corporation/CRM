import { api } from './api';

export interface Note {
  content: string;
  updated_at: string | null;
}

export const notesService = {
  async getMine(): Promise<Note> {
    const { data } = await api.get<{ data: Note }>('/notes/me');
    return data.data;
  },

  async saveMine(content: string): Promise<Note> {
    const { data } = await api.put<{ data: Note }>('/notes/me', { content });
    return data.data;
  },
};
