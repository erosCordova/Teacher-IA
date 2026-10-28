import { createRoot } from 'react-dom/client'
import ComposerAcciones from './ComposerAcciones'

function mountComposer() {
  if (document.getElementById('conauti-composer-root')) {
    return
  }

  const container = document.createElement('div')

  container.id = 'conauti-composer-root'
  container.setAttribute('aria-hidden', 'true')

  document.body.appendChild(container)

  createRoot(container).render(
    <ComposerAcciones />,
  )
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    mountComposer,
    { once: true },
  )
} else {
  mountComposer()
}
