export type QualityTier = 'LOW' | 'MED' | 'HIGH'

export type QualityReport = {
  tier: QualityTier
  score: number
  gpu: string
  isMobile: boolean
  deviceMemoryGb: number | null   // navigator.deviceMemory — absent on Firefox/Safari
  cpuCores: number | null         // navigator.hardwareConcurrency
  devicePixelRatio: number
}

// Reads the unmasked GPU renderer string via a temporary WebGL context
const readGpuString = (): string => {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER)
    return String(renderer).toLowerCase()
  } catch {
    return ''
  }
}

const isMobileDevice = (): boolean =>
  navigator.maxTouchPoints > 0 &&
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)

// Scores hardware signals and buckets into a quality tier
export const detectQualityTier = (): QualityReport => {
  const gpu = readGpuString()
  const isMobile = isMobileDevice()
  const deviceMemoryGb = (navigator as { deviceMemory?: number }).deviceMemory ?? null
  const cpuCores = navigator.hardwareConcurrency ?? null
  const devicePixelRatio = window.devicePixelRatio ?? 1

  let score = 0

  // GPU — desktop cards score high, low-end mobile cards score negative
  if (/nvidia|radeon|geforce|rx \d|rtx \d/.test(gpu)) score += 4
  else if (/intel (u?hd|iris|arc)/.test(gpu)) score += 3
  else if (/apple m\d|apple gpu/.test(gpu)) score += 4
  else if (/adreno [6-9]\d\d|mali-g[7-9]\d|apple a1[4-9]/.test(gpu)) score += 2  // high-end mobile
  else if (/adreno [5]\d\d|mali-g[5-6]\d/.test(gpu)) score += 1                   // mid mobile
  else if (/adreno [3-4]\d\d|mali-[34]\d\d|powervr/.test(gpu)) score -= 2         // low-end mobile

  // RAM
  if (deviceMemoryGb === null) score += 1          // desktop browsers don't expose this
  else if (deviceMemoryGb >= 8) score += 3
  else if (deviceMemoryGb >= 4) score += 2
  else if (deviceMemoryGb >= 2) score += 1
  else score -= 2

  // CPU cores
  if (cpuCores === null) score += 1
  else if (cpuCores >= 8) score += 3
  else if (cpuCores >= 4) score += 2
  else if (cpuCores >= 2) score += 1
  else score -= 1

  // Mobile penalty — same GPU+RAM is slower due to thermals and battery limits
  if (isMobile) score -= 2

  // Very high DPI on a weak device = more pixels to push, negative signal
  if (devicePixelRatio > 3) score -= 1

  const tier: QualityTier = score >= 7 ? 'HIGH' : score >= 3 ? 'MED' : 'LOW'

  return { tier, score, gpu, isMobile, deviceMemoryGb, cpuCores, devicePixelRatio }
}

// Per-tier PixiJS init settings
export const resolutionForTier = (tier: QualityTier): number => {
  if (tier === 'HIGH') return window.devicePixelRatio
  if (tier === 'MED') return Math.min(window.devicePixelRatio, 1.5)
  return 1
}

export const antialiasForTier = (tier: QualityTier): boolean => tier === 'HIGH'
