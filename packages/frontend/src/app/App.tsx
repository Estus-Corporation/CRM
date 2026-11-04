import { RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { Providers } from './providers';
import { router } from './router';

export function App() {
  return (
    <Providers>
      {/* reducedMotion never: no Windows do usuário os efeitos de animação estão desligados e o framer cortava tudo */}
      <MotionConfig reducedMotion="never">
        <RouterProvider router={router} />
      </MotionConfig>
    </Providers>
  );
}
