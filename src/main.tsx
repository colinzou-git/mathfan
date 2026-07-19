import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { repairCanonicalItemStateCache } from './features/scheduler/dailyReviewCandidates'

// When a new service worker activates (skipWaiting fires), reload so the fresh
// bundle is served. Guard with hadController so the very first SW install on a
// brand-new visit doesn't trigger a spurious reload.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload();
  });
}

async function bootstrap(): Promise<void> {
  try {
    const result = await repairCanonicalItemStateCache()
    if (result.aliasRowsRemoved || result.unresolvedRowsRemoved) {
      console.info('[itemStates] canonical cache repair', result)
    }
  } catch (error) {
    // itemStates is a derived cache. Continue into the existing migration and
    // recovery flow, but retain diagnostics for affected installations.
    console.warn('[itemStates] canonical cache repair failed', error)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
