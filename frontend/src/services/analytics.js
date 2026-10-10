// Keep tracking configured even when the hosting environment has no ID set.
const measurementId = (import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim() || 'G-50HNG6MNDX'

export function initializeAnalytics() {
  if (!/^G-[A-Z0-9]+$/.test(measurementId)) return
  if (!import.meta.env.PROD || ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) return
  if (document.getElementById('google-analytics')) return

  window.dataLayer = window.dataLayer || []
  window.gtag = function () { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  // GA4 Enhanced Measurement handles subsequent History API navigation.
  window.gtag('config', measurementId)

  const script = document.createElement('script')
  script.id = 'google-analytics'
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.appendChild(script)
}
