import React, { useEffect, useSyncExternalStore, Suspense } from 'react';
import App from './App';

// lazy is optional; you can inline-import if you prefer
const ExportPanel = React.lazy(() => import('./pages/Export'));

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
function getSnapshot() { return window.location.hash || '#/'; }

export default function RootRouter() {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const route = hash.replace(/^#/, ''); // "#/export" -> "/export"

  return (
    <Suspense fallback={null}>
      {route === '/export' ? <ExportPanel /> : <App />}
    </Suspense>
  );
}
