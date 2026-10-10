import { useEffect } from 'react'

export const adsenseClient = (import.meta.env.VITE_ADSENSE_CLIENT || '').trim()
export const adsenseEnabled = import.meta.env.VITE_ADSENSE_ENABLED === 'true' && /^ca-pub-\d{16}$/.test(adsenseClient)

export function useAdSense(path) {
  useEffect(() => {
    if (!adsenseEnabled || !import.meta.env.PROD) return
    if (['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) return
    const existing = document.getElementById('google-adsense')
    const isPostPage = path === '/' || path === '/posts' || /^\/(story|post)\/[^/]+\/?$/.test(path)
    if (!isPostPage) {
      // Removing a script cannot stop Auto ads already running in this document.
      if (existing) window.location.reload()
      return
    }
    if (existing) return
    const script = document.createElement('script')
    script.id = 'google-adsense'
    script.async = true
    script.crossOrigin = 'anonymous'
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`
    document.head.appendChild(script)
  }, [path])
}
