import VocesKokoro from './VocesKokoro'
import BibliotecaVoces from './BibliotecaVoces'
import { createRoot } from 'react-dom/client'

function montar(): void {
  if (document.getElementById('conauti-config-root')) return
  const nodo = document.createElement('div')
  nodo.id = 'conauti-config-root'
  document.body.appendChild(nodo)
  createRoot(nodo).render(
    <>
      <VocesKokoro />
      <BibliotecaVoces />
    </>,
  )
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', montar, { once: true })
} else {
  montar()
}
