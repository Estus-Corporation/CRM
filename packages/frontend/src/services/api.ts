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

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token?: string) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
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

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

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
        }
      }
      processQueue(null, accessToken);
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      useAuthStore.getState().logout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
