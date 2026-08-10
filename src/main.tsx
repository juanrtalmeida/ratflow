import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Raiz } from './ui/Raiz.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Raiz />
  </StrictMode>,
)
