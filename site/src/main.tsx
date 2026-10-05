import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App, { matchesPrerender } from './App.tsx'
import { trackVisit } from './lib/analytics'
import { setupInstall } from './lib/install'
import { PRERENDER } from './lib/prerender'

trackVisit()
setupInstall()

const root = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)
if (PRERENDER) import('react-dom/server').then(({ renderToString }) => (root.innerHTML = renderToString(app)))
else if (root.firstChild && matchesPrerender()) requestAnimationFrame(() => setTimeout(() => hydrateRoot(root, app, { onRecoverableError: () => {} })))
else createRoot(root).render(app)
