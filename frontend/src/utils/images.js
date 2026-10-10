import { normalizeAssetUrl } from '../services/api'

export function optimizedImageUrl(value, width = 800) {
  const original = normalizeAssetUrl(value)
  if (!original) return ''
  // Only transform standard, unsigned Cloudinary originals.
  return original.replace(
    /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/)/,
    `$1c_limit,w_${width}/q_auto/f_auto/$2`,
  )
}

export const thumbnailUrl = (value) => optimizedImageUrl(value, 800)
