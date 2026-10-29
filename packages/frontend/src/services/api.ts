import axios from 'axios';
import { API_URL } from '@/lib/constants';
import { useAuthStore } from '@/store/authStore';
import { useUpgradeStore } from '@/store/upgradeStore';
import { queryClient } from '@/lib/queryClient';
import { toast } from 'sonner';

export const api = axios.create({
  baseURL: API_URL,
  // Sem isso, um pedido que nunca responde deixa a tela carregando pra sempre (ex.: "Entrando…")
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Renovação de sessão em voo único: o refresh token gira a cada uso, então duas renovações
// ao mesmo tempo invalidariam uma à outra (a segunda usaria um token já descartado).
let renewing: Promise<string> | null = null;

/**
 * Troca o refresh token por uma sessão nova e sincroniza o papel/workspace na tela.
 * Usada pelo 401 do interceptor e pelo aviso em tempo real de que o acesso da pessoa mudou.
 */
export function renewSession(): Promise<string> {
  if (renewing) return renewing;
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) {
    useAuthStore.getState().logout();
    return Promise.reject(new Error('no_refresh_token'));
  }
  renewing = (async () => {
    try {
      const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefreshToken, tenantId, role } = res.data.data;
      const auth = useAuthStore.getState();
      auth.setTokens(accessToken, newRefreshToken);
      // Se a pessoa foi removida do workspace atual, a renovação a leva pra outro workspace dela:
      // atualiza a sessão na tela e descarta os dados do workspace antigo
      if (auth.user && tenantId && (tenantId !== auth.user.tenant_id || role !== auth.user.role)) {
        const movedOut = tenantId !== auth.user.tenant_id;
        auth.patchUser({ tenant_id: tenantId, role });
        if (movedOut) {
          queryClient.clear();
          toast.info('Você não faz mais parte daquele workspace — voltou para o seu.');
        } else {
          // Mesmo workspace, papel novo: o menu e as telas mudam, os dados são rebuscados
          queryClient.invalidateQueries();
          toast.info('Seu acesso neste workspace foi atualizado.');
        }
      }
      return accessToken as string;
    } catch (err) {
      useAuthStore.getState().logout();
      throw err;
    } finally {
      renewing = null;
    }
  })();
  return renewing;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 402) {
      const requiredPlan = error.response.data?.requiredPlan ?? 'pro';
      useUpgradeStore.getState().showUpgrade(requiredPlan);
      return Promise.reject(error);
    }

    // 401 do próprio login/cadastro é "senha errada", não sessão expirada — não tenta renovar
    const isAuthEndpoint = /\/auth\/(login|register|refresh)$/.test(originalRequest?.url ?? '');
    if (error.response?.status !== 401 || originalRequest._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    try {
      const accessToken = await renewSession();
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch {
      return Promise.reject(error);
    }
  },
);
