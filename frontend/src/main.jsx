import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initializeAnalytics } from './services/analytics'
import { logoUrl } from './branding'

const favicon = document.querySelector('link[rel="icon"]')
if (favicon) {
  favicon.removeAttribute('type')
  favicon.href = logoUrl
}

initializeAnalytics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
