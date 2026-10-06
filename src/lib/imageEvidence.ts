import * as exifr from 'exifr'

export const MAX_FILE_BYTES = 25 * 1024 * 1024
export const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export type EvidenceTone = 'strong' | 'supporting' | 'neutral' | 'counter'

export type EvidenceItem = {
  label: string
  detail: string
  tone: EvidenceTone
}

export type MetadataItem = {
  label: string
  value: string
}

export type AiAssessment = {
  verdict: 'likely-ai' | 'signals-found' | 'no-signals' | 'inconclusive'
  title: string
  summary: string
  confidence: 'high' | 'medium' | 'low'
  score: number
  evidence: EvidenceItem[]
}

export type ImageInspection = {
  width: number
  height: number
  megapixels: number
  metadata: MetadataItem[]
  rawMetadata: Record<string, unknown>
  fingerprint: string
  assessment: AiAssessment
}

const AI_MARKERS: Array<[RegExp, string]> = [
  [/midjourney/i, 'Midjourney'],
  [/stable[ -]?diffusion|automatic1111|a1111/i, 'Stable Diffusion'],
  [/comfyui/i, 'ComfyUI'],
  [/dall[· -]?e|openai image/i, 'OpenAI image generation'],
  [/adobe firefly|generative fill/i, 'Adobe Firefly / Generative Fill'],
  [/\bflux(?:\.|\s|$)/i, 'FLUX'],
  [/leonardo\.ai|leonardo ai/i, 'Leonardo AI'],
  [/ideogram/i, 'Ideogram'],
  [/invokeai|fooocus/i, 'AI generation workflow'],
  [/negative prompt|sampler_name|cfg scale|\bsteps\s*:\s*\d+/i, 'Diffusion prompt parameters'],
]

const DISPLAY_FIELDS: Array<[string, string]> = [
  ['Make', 'Camera maker'],
  ['Model', 'Camera model'],
  ['Software', 'Software'],
  ['CreatorTool', 'Creator tool'],
  ['Artist', 'Artist'],
  ['Copyright', 'Copyright'],
  ['DateTimeOriginal', 'Captured'],
  ['CreateDate', 'Created'],
  ['ModifyDate', 'Modified'],
  ['GPSLatitude', 'GPS latitude'],
  ['GPSLongitude', 'GPS longitude'],
  ['ImageDescription', 'Description'],
  ['UserComment', 'User comment'],
  ['XPComment', 'Comment'],
  ['Parameters', 'Generation parameters'],
]

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function validateImage(file: File) {
  if (!SUPPORTED_TYPES.includes(file.type as (typeof SUPPORTED_TYPES)[number])) {
    throw new Error('Choose a JPEG, PNG, or WebP image.')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Choose an image smaller than 25 MB.')
  }
}

function printable(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toLocaleString()
  if (Array.isArray(value)) {
    const joined = value.map(printable).filter(Boolean).join(', ')
    return joined || null
  }
  if (typeof value === 'object') return null
  const text = String(value).trim()
  return text && text !== '[object Object]' ? text : null
}

export function flattenMetadata(raw: Record<string, unknown>): MetadataItem[] {
  const preferred = DISPLAY_FIELDS.flatMap(([key, label]) => {
    const value = printable(raw[key])
    return value ? [{ label, value }] : []
  })

  const used = new Set(DISPLAY_FIELDS.map(([key]) => key))
  const extra = Object.entries(raw)
    .filter(([key]) => !used.has(key))
    .flatMap(([key, value]) => {
      const text = printable(value)
      if (!text || text.length > 280) return []
      return [{ label: key.replace(/([a-z])([A-Z])/g, '$1 $2'), value: text }]
    })
    .slice(0, 8)

  return [...preferred, ...extra].slice(0, 16)
}

export function assessAiSignals(
  rawText: string,
  metadata: Record<string, unknown>,
): AiAssessment {
  const metadataText = Object.entries(metadata)
    .map(([key, value]) => `${key}: ${printable(value) ?? ''}`)
    .join('\n')
  const corpus = `${metadataText}\n${rawText}`
  const evidence: EvidenceItem[] = []
  const foundTools = new Set<string>()

  for (const [pattern, name] of AI_MARKERS) {
    if (pattern.test(corpus)) foundTools.add(name)
  }

  for (const tool of foundTools) {
    evidence.push({
      label: `${tool} marker`,
      detail: 'A generator or workflow identifier appears in embedded file data.',
      tone: 'strong',
    })
  }

  const hasTrainedAlgorithmic = /trainedAlgorithmicMedia/i.test(corpus)
  const hasC2pa = /c2pa|content credentials|claim_generator|digitalSourceType/i.test(corpus)

  if (hasTrainedAlgorithmic) {
    evidence.push({
      label: 'AI provenance assertion',
      detail: 'Embedded provenance text identifies trained algorithmic media.',
      tone: 'strong',
    })
  } else if (hasC2pa) {
    evidence.push({
      label: 'Content Credentials data',
      detail: 'A provenance structure may be present; cryptographic validation needs a dedicated C2PA verifier.',
      tone: 'supporting',
    })
  }

  const make = printable(metadata.Make)
  const model = printable(metadata.Model)
  if (make || model) {
    evidence.push({
      label: 'Camera metadata present',
      detail: `${[make, model].filter(Boolean).join(' ')} is named in EXIF. This supports a camera origin but does not rule out later AI editing.`,
      tone: 'counter',
    })
  }

  if (foundTools.size > 0 || hasTrainedAlgorithmic) {
    const score = Math.min(98, 82 + foundTools.size * 5 + (hasTrainedAlgorithmic ? 8 : 0))
    return {
      verdict: 'likely-ai',
      title: 'Likely AI-generated or AI-edited',
      summary: 'Strong embedded signals name an AI generator, workflow, or provenance assertion.',
      confidence: score >= 92 ? 'high' : 'medium',
      score,
      evidence,
    }
  }

  if (hasC2pa) {
    return {
      verdict: 'signals-found',
      title: 'Provenance data found',
      summary: 'The file contains provenance-related data, but this local scan cannot validate what it asserts.',
      confidence: 'medium',
      score: 62,
      evidence,
    }
  }

  if (make || model) {
    return {
      verdict: 'no-signals',
      title: 'No embedded AI signal found',
      summary: 'Camera information is present and no known AI marker was found. This is not proof that the image was never AI-edited.',
      confidence: 'low',
      score: 24,
      evidence,
    }
  }

  evidence.push({
    label: 'No identifying metadata',
    detail: 'The file does not expose a camera, generator, or provenance marker this scanner recognizes.',
    tone: 'neutral',
  })
  return {
    verdict: 'inconclusive',
    title: 'Inconclusive',
    summary: 'No recognized AI signal was found, but metadata may have been removed or never written.',
    confidence: 'low',
    score: 50,
    evidence,
  }
}

async function imageDimensions(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const dimensions = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return dimensions
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

async function rawSearchText(file: File) {
  const buffer = await file.arrayBuffer()
  return new TextDecoder('latin1').decode(buffer)
}

export async function inspectImage(file: File): Promise<ImageInspection> {
  validateImage(file)
  const [dimensions, parsed, fingerprint, rawText] = await Promise.all([
    imageDimensions(file),
    exifr
      .parse(file, { tiff: true, exif: true, gps: true, xmp: true, iptc: true, icc: true })
      .catch(() => ({})),
    sha256(file),
    rawSearchText(file),
  ])
  const rawMetadata = (parsed ?? {}) as Record<string, unknown>

  return {
    ...dimensions,
    megapixels: (dimensions.width * dimensions.height) / 1_000_000,
    metadata: flattenMetadata(rawMetadata),
    rawMetadata,
    fingerprint,
    assessment: assessAiSignals(rawText, rawMetadata),
  }
}

export async function cleanImage(file: File) {
  validateImage(file)
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d', { alpha: file.type !== 'image/jpeg' })
  if (!context) {
    bitmap.close()
    throw new Error('This browser could not create an image canvas.')
  }
  if (file.type === 'image/jpeg') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('The cleaned image could not be encoded.'))),
      file.type,
      file.type === 'image/png' ? undefined : 0.94,
    )
  })

  return blob
}

export function cleanedFilename(file: File) {
  const dot = file.name.lastIndexOf('.')
  const base = dot > 0 ? file.name.slice(0, dot) : file.name
  const extension = dot > 0 ? file.name.slice(dot) : file.type === 'image/png' ? '.png' : '.jpg'
  return `${base.replace(/[^a-zA-Z0-9._-]+/g, '-')}-clean${extension}`
}
