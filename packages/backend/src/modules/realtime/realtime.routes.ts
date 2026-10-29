import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { heartbeat, subscribe } from './hub';

const router = Router();

// Canal de avisos da pessoa logada. fetch (não EventSource) para poder mandar o Authorization.
router.get('/', requireAuth, (req, res) => {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // proxies (Railway/nginx) não seguram os avisos
  });
  res.flushHeaders();
  res.write('retry: 5000\n: connected\n\n');
  const unsubscribe = subscribe(req.user!.id, res);
  req.on('close', unsubscribe);
});

// Ping periódico: proxies derrubam conexões ociosas
setInterval(heartbeat, 25_000).unref();

export default router;
