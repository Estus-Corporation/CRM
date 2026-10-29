import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/constants';
import { renewSession } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

/**
 * Avisos em tempo real do servidor (SSE via fetch, pra poder mandar o Authorization).
 * O aviso só diz "algo mudou": a tela busca de novo só o que mudou, sem F5 e sem esperar o polling.
 * Se a conexão cair, reconecta sozinha; o polling dos hooks continua como rede de segurança.
 */
const REFETCH: Record<string, (qc: QueryClient) => void> = {
  notifications: (qc) => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  invites: (qc) => {
    void qc.invalidateQueries({ queryKey: ['invites'] });
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  },
  workspaces: (qc) => void qc.invalidateQueries({ queryKey: ['workspaces'] }),
  team: (qc) => {
    void qc.invalidateQueries({ queryKey: ['users'] });
    void qc.invalidateQueries({ queryKey: ['invites', 'tenant'] });
    void qc.invalidateQueries({ queryKey: ['tenant'] });
  },
  // Papel/acesso mudou: o papel vive no token, então renova a sessão (atualiza menu e rotas)
  session: (qc) => {
    void renewSession().then(() => qc.invalidateQueries({ queryKey: ['workspaces'] })).catch(() => {});
  },
};

export function useRealtime() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const tenantId = useAuthStore((s) => s.user?.tenant_id);

  // Reabre quando troca de pessoa ou de workspace (o token novo vale pro novo contexto)
  useEffect(() => {
    if (!userId) return;
    const abort = new AbortController();
    let retry = 1000;

    const handle = (block: string) => {
      const event = /^event: (.+)$/m.exec(block)?.[1];
      if (event) REFETCH[event]?.(qc);
    };

    async function run() {
      while (!abort.signal.aborted) {
        try {
          const token = useAuthStore.getState().accessToken;
          const res = await fetch(`${API_URL}/realtime`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
            signal: abort.signal,
          });
          if (res.status === 401) {
            await renewSession(); // token vencido: renova e tenta de novo
            continue;
          }
          if (!res.ok || !res.body) throw new Error(`realtime ${res.status}`);
          retry = 1000;
          // Ao (re)conectar, algo pode ter mudado enquanto estava fora do ar
          void qc.invalidateQueries({ queryKey: ['invites'] });
          void qc.invalidateQueries({ queryKey: ['notifications'] });

          const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
          let buffer = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            let sep: number;
            while ((sep = buffer.indexOf('\n\n')) !== -1) {
              handle(buffer.slice(0, sep));
              buffer = buffer.slice(sep + 2);
            }
          }
        } catch {
          if (abort.signal.aborted) return;
        }
        await new Promise((r) => setTimeout(r, retry));
        retry = Math.min(retry * 2, 30_000);
      }
    }

    void run();
    return () => abort.abort();
  }, [qc, userId, tenantId]);
}
