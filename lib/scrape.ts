import * as cheerio from 'cheerio'

export type ScrapedProduct = {
  name: string
  brand: string
  description: string
  images: string[]
  bladeStyle: string
  handleMaterial: string
  specs: {
    weight: string
    overallLength: string
    bladeLength: string
    bladeThickness: string
    bladeCoating: string
    bladeMaterial: string
    lockingMechanism: string
    designer: string
    modelNumber: string
    handleLength: string
    hardness: string
    country: string
  }
  sourceUrl: string
}

export type ScrapeConfidence = {
  name: boolean
  brand: boolean
  description: boolean
  images: boolean
  bladeStyle: boolean
  handleMaterial: boolean
  specs: {
    weight: boolean
    overallLength: boolean
    bladeLength: boolean
    bladeThickness: boolean
    bladeCoating: boolean
    bladeMaterial: boolean
    lockingMechanism: boolean
    designer: boolean
    modelNumber: boolean
    handleLength: boolean
    hardness: boolean
    country: boolean
  }
}

export type ScrapeResult = {
  product: ScrapedProduct
  confidence: ScrapeConfidence
}

const EMPTY_PRODUCT: ScrapedProduct = {
  name: '',
  brand: '',
  description: '',
  images: [],
  bladeStyle: '',
  handleMaterial: '',
  specs: {
    weight: '',
    overallLength: '',
    bladeLength: '',
    bladeThickness: '',
    bladeCoating: '',
    bladeMaterial: '',
    lockingMechanism: '',
    designer: '',
    modelNumber: '',
    handleLength: '',
    hardness: '',
    country: '',
  },
  sourceUrl: '',
}

function resolveUrl(
  href: string | undefined,
  base: string,
): string | undefined {
  if (!href) return undefined
  try {
    return new URL(href, base).href
  } catch {
    return href.startsWith('http') ? href : undefined
  }
}

function cleanText(text: string | undefined): string {
  return text?.replace(/\s+/g, ' ').trim() ?? ''
}

function cleanValue(text: string | undefined): string {
  return cleanText(text).replace(/[.,;:]+$/g, '')
}

function normalizeText(text: string): string {
  return text
    .replace(/[\u00A0\u202F\u2007]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Same as normalizeText but preserves newlines so line-based spec parsing works.
function normalizeMultilineText(text: string): string {
  return text
    .replace(/[\u00A0\u202F\u2007]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Extract text from an element while converting <br> and block-level
// boundaries into newlines. Cheerio's .text() collapses <br> to nothing,
// which joins consecutive spec lines into one unusable string.
function elementTextWithBreaks(
  $: cheerio.CheerioAPI,
  el: Parameters<cheerio.CheerioAPI>[0] | cheerio.CheerioAPI,
): string {
  const $el = $(el as any)
  const html = $el.html()
  if (!html) return $el.text()
  return htmlToPlainText(html)
}

function findMeta($: cheerio.CheerioAPI, names: string[]): string {
  for (const name of names) {
    const value =
      $(`meta[property="${name}"]`).attr('content') ??
      $(`meta[name="${name}"]`).attr('content')
    if (value) return cleanText(value)
  }
  return ''
}

function extractJsonLdProduct($: cheerio.CheerioAPI): Partial<ScrapedProduct> {
  const result: Partial<ScrapedProduct> = {}
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() ?? ''
      const data = JSON.parse(raw)
      const candidates = Array.isArray(data) ? data : [data]
      for (const item of candidates) {
        const graph = item['@graph']
        const items = graph && Array.isArray(graph) ? graph : [item]
        for (const node of items) {
          const type = node?.['@type']
          if (
            type === 'Product' ||
            (Array.isArray(type) && type.includes('Product'))
          ) {
            result.name = result.name || cleanText(node.name)
            result.brand =
              result.brand ||
              cleanText(node.brand?.name || node.brand?.value || node.brand)
            result.description =
              result.description || htmlToPlainText(node.description)
            if (node.image) {
              const images = Array.isArray(node.image)
                ? node.image
                : [node.image]
              result.images = images
                .map((img: unknown) =>
                  typeof img === 'string'
                    ? img
                    : (img as { url?: string })?.url,
                )
                .filter(
                  (img: unknown): img is string =>
                    typeof img === 'string' && img.length > 0,
                )
            }
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  })
  return result
}

function extractTitle($: cheerio.CheerioAPI): string {
  return (
    findMeta($, ['og:title', 'twitter:title']) ||
    cleanText($('h1').first().text()) ||
    cleanText($('title').text())
  )
}

function htmlToPlainText(html: string): string {
  if (!html) return ''
  return (
    html
      // Remove scripts and styles before parsing text.
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      // Preserve line breaks from block-level tags and line breaks.
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
      .replace(/<\/li>\s*<li[^>]*>/gi, '\n')
      .replace(/<\/h([1-6])>/gi, '\n\n')
      // Strip any remaining tags.
      .replace(/<[^>]+>/g, ' ')
      // Decode common HTML entities.
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Normalize whitespace while preserving paragraph breaks.
      .replace(/\r\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/ {2,}/g, ' ')
      .trim()
  )
}

function extractDescription($: cheerio.CheerioAPI): string {
  const meta = findMeta($, [
    'og:description',
    'twitter:description',
    'description',
  ])
  if (meta) return htmlToPlainText(meta)

  const paragraphs = $('p')
    .filter((_, el) => $(el).text().trim().length > 30)
    .slice(0, 3)
    .map((_, el) => $(el).text().trim())
    .get()
  if (paragraphs.length > 0) {
    return htmlToPlainText(paragraphs.join('\n\n'))
  }

  return ''
}

function extractImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const seen = new Set<string>()
  const images: string[] = []

  const add = (href: string | undefined) => {
    const resolved = resolveUrl(href, baseUrl)
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved)
      images.push(resolved)
    }
  }

  findMeta($, ['og:image', 'twitter:image']).split(',').forEach(add)

  const imageSelectors = [
    '[data-main-image] img',
    '.product-image img',
    '.product__image img',
    '#product-image img',
    '.woocommerce-product-gallery__image img',
    '.product-gallery img',
    '[data-media-id] img',
    '.product__media img',
    '.product-photo img',
    '.pdp-image img',
    '.image-gallery-image img',
    '.slick-active img',
    '.zoomImg',
    '[data-image] img',
  ]

  $(imageSelectors.join(', ')).each((_, el) => {
    const $el = $(el)
    add(
      $el.attr('src') ||
        $el.attr('data-src') ||
        $el.attr('data-lazy-src') ||
        $el.attr('data-zoom') ||
        $el.attr('srcset')?.split(',')[0]?.trim().split(' ')[0],
    )
  })

  $('img').each((_, el) => {
    const $el = $(el)
    const src =
      $el.attr('src') || $el.attr('data-src') || $el.attr('data-lazy-src')
    if (src && /product|knife|blade|item/i.test(src)) {
      add(src)
    }
  })

  return images
}

function extractBrand(name: string, $: cheerio.CheerioAPI): string {
  const siteName = findMeta($, ['og:site_name', 'application-name'])
  if (siteName) {
    // Some retailers put their own name here, not the product brand.
    const retailerNames =
      /Blade HQ|Knife Center|GP Knives|DLT Trading|KnifeWorks|KnivesPlus|Knife Art|KnifeJoy|NC Blade|Southern Edges|House of Blades|New Graham Knives|True North Knives|Steel Addiction|USA Made Blade/i
    if (!retailerNames.test(siteName)) return siteName
  }

  const commonBrands = [
    'Chris Reeve',
    'Spyderco',
    'Benchmade',
    'Microtech',
    'Hinderer',
    'Grimsmo',
    'Pro-Tech',
    'ZT',
    'Zero Tolerance',
    'Bark River',
    'Boker',
    'Böker',
    'Buck',
    'Case',
    'Cold Steel',
    'CRKT',
    'Demko',
    'Emerson',
    'Fox',
    'GiantMouse',
    'Kershaw',
    'Liong Mah',
    'Medford',
    'MKM',
    'Nemesis',
    'Olamic',
    'QuietCarry',
    'Reate',
    'Rike',
    'Shirogorov',
    'Smith & Wesson',
    'Spartan Blades',
    'Toor',
    'Tops',
    'Viper',
    'WE Knife',
    'WE',
    'CIVIVI',
    'Kizer',
    'Kizer Cutlery',
    'Bestech',
    'Civivi',
    'QSP',
    'Kansept',
    'Petrified Fish',
    'Sencut',
    'Twosun',
    'CJRB',
    ' Artisan ',
    'Artisan Cutlery',
    'Real Steel',
    'James Brand',
    'Opinel',
    'Victorinox',
    'Leatherman',
    'SOG',
    'Brous Blades',
    'Chaves',
    'CRK',
    'Hogue',
    'Midgards-Messer',
    'Miguron',
    'North Arms',
    'Pena',
    'Rassenti',
    'Rogers',
    'Sergey Rogovets',
    'Skiff',
    'SBD',
    'Strider',
    'Tactile Turn',
    'Terrain 365',
    'Trevor Burger',
    'Vero Engineering',
    'Vosteed',
  ]

  for (const brand of commonBrands) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(name)) {
      return brand.trim()
    }
  }
  return ''
}

const SPEC_PATTERNS: Array<[keyof ScrapedProduct['specs'], RegExp]> = [
  ['bladeLength', /blade\s*(length|size|len)/i],
  ['overallLength', /overall\s*(length|size|len)/i],
  ['handleLength', /handle\s*(length|size|len)/i],
  ['bladeThickness', /blade\s*(thickness|thick)/i],
  ['weight', /weight|mass/i],
  ['bladeCoating', /blade\s*(coating|finish|finishing|coating\s*\/\s*finish)/i],
  ['bladeMaterial', /blade\s*(material|steel)/i],
  ['lockingMechanism', /locking\s*mechanism|lock\s*type|lock\s*mechanism/i],
  ['designer', /designer|designed\s*by/i],
  ['modelNumber', /model\s*(number|#|no\.?)|\bsku\b/i],
  ['hardness', /hardness|hrc|rockwell/i],
  ['country', /country\s*(of\s*origin)?|made\s*in|origin/i],
]

const COUNTRIES = [
  'USA',
  'United States',
  'China',
  'Taiwan',
  'Japan',
  'Italy',
  'Germany',
  'France',
  'Spain',
  'Sweden',
  'Finland',
  'Norway',
  'Denmark',
  'Austria',
  'Czech Republic',
  'Russia',
  'South Africa',
  'Canada',
  'Mexico',
  'Brazil',
  'Argentina',
  'Australia',
  'New Zealand',
  'UK',
  'United Kingdom',
  'England',
]

function normalizeCountry(value: string): string {
  const clean = cleanText(value)
  for (const country of COUNTRIES) {
    if (
      new RegExp(
        `\\b${country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'i',
      ).test(clean)
    ) {
      if (country.toLowerCase() === 'united states') return 'USA'
      if (country.toLowerCase() === 'united kingdom') return 'UK'
      return country
    }
  }
  return ''
}

function normalizeLength(value: string): string {
  // Preserve the original value (including dual imperial/metric units like
  // `8.18" / 207.7 mm`). Only trim trailing punctuation/whitespace.
  return cleanValue(value)
}

function normalizeWeight(value: string): string {
  // Preserve the original value (including dual oz/g units like
  // `4.50 oz/127.5g`). Only trim trailing punctuation/whitespace.
  return cleanValue(value)
}

function extractLabeledValue(text: string, labels: string[]): string {
  if (!text) return ''
  const lowerLabels = labels.map((l) => l.toLowerCase())

  // Primary strategy: split the text at known spec-label boundaries, then
  // look for a chunk whose label matches one of the requested labels. This
  // handles both normal "Label: Value\n" lines and the concatenated format
  // "Label: ValueLabel2: Value2" that Shopify themes emit in JSON-LD.
  const chunks = splitBySpecLabels(text)
  for (const chunk of chunks) {
    const m = chunk.match(/^(.{2,40}?)\s*[:\uFF1A]\s*(.{1,80}?)\s*$/)
    if (!m) continue
    if (lowerLabels.includes(m[1].toLowerCase().trim())) {
      return cleanText(m[2])
    }
  }

  // Fallback: simple "Label: value" with newline/end boundary.
  const escapedLabels = labels.map((label) =>
    label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  )
  const simplePattern = new RegExp(
    `(?:${escapedLabels.join('|')})\\s*[:\uFF1A]\\s*(.{1,80}?)(?=\\n|$)`,
    'i',
  )
  const simpleMatch = text.match(simplePattern)
  if (simpleMatch) return cleanText(simpleMatch[1])

  return ''
}

// Known spec labels used for label-aware splitting. Order matters: longer
// and more specific labels come first so they win over prefix labels
// (e.g. "Model Number" must be tried before "Model"). Labels we do not
// extract (like "Color" or "Model") are still listed because they act as
// boundaries when values run into the next label without a separator.
// Note: we intentionally do NOT use \b word boundaries here, because brand
// sites often concatenate specs without separators (e.g. "MicartaWeight:"),
// and \b would fail to match between two word characters. The trailing ":"
// requirement already prevents most false positives.
const SPEC_LABEL_ALTERNATIONS = [
  'model\\s*number',
  'model\\s*#',
  'model\\s*no\\.?',
  'sku',
  'overall\\s*(?:length|size|len)',
  'handle\\s*(?:length|size|len)',
  'handle\\s*material',
  'blade\\s*style',
  'blade\\s*(?:length|size|len)',
  'blade\\s*(?:thickness|thick)',
  'blade\\s*(?:coating|finish|finishing)',
  'blade\\s*(?:material|steel)',
  'locking\\s*mechanism',
  'lock\\s*type',
  'lock\\s*mechanism',
  'country\\s*of\\s*origin',
  'made\\s*in',
  'weight',
  'mass',
  'designer',
  'designed\\s*by',
  'hardness',
  'hrc',
  'rockwell',
  'color',
  'colour',
  'model', // generic - keep last so "Model Number" wins first
]

const SPEC_LABEL_SPLIT_RE = new RegExp(
  `(?=(?:${SPEC_LABEL_ALTERNATIONS.join('|')})\\s*[:\\uFF1A])`,
  'gi',
)

// Split text at each known label that is followed by a colon. This lets us
// recover individual `Label: Value` pairs even when a Shopify theme renders
// them concatenated without separators (e.g. in JSON-LD descriptions).
function splitBySpecLabels(text: string): string[] {
  if (!text) return []
  return text
    .split(SPEC_LABEL_SPLIT_RE)
    .map((part) => part.trim())
    .filter(Boolean)
}

// Parse a block of text line-by-line, calling onPair for every `Label: Value`
// line. Also falls back to label-aware splitting for lines that still contain
// multiple concatenated specs.
function parseSpecLines(
  text: string,
  onPair: (label: string, value: string) => void,
) {
  if (!text) return
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  for (const line of lines) {
    const m = line.match(/^(.{2,40}?)\s*[:\uFF1A]\s*(.{1,120}?)\s*$/)
    if (m) {
      onPair(m[1], m[2])
      continue
    }
    // Line had no colon match - try splitting concatenated specs on it.
    const chunks = splitBySpecLabels(line)
    if (chunks.length > 1) {
      for (const chunk of chunks) {
        const cm = chunk.match(/^(.{2,40}?)\s*[:\uFF1A]\s*(.{1,120}?)\s*$/)
        if (cm) onPair(cm[1], cm[2])
      }
    }
  }
}

// Find a SPECIFICATIONS (or Specs / Details) section heading and return the
// following block of text with line breaks preserved. Brand sites typically
// render this as a heading followed by a <p> with <br>-separated spec lines.
function extractSpecBlock($: cheerio.CheerioAPI): string {
  const headingSelectors =
    'h1, h2, h3, h4, h5, h6, strong, b, p, div, span, dt, th'
  const $heading = $(headingSelectors)
    .filter((_, el) => {
      const t = $(el).text().trim()
      return /^(specifications?|specs?|details?|technical\s+(?:data|specs|details)|product\s+(?:specs|details|specifications))$/i.test(
        t,
      )
    })
    .first()

  if (!$heading.length) return ''

  let text = ''
  let $next = $heading.next()
  let safety = 50
  while ($next.length > 0 && safety-- > 0) {
    if ($next.is('h1, h2, h3, h4, h5, h6')) break
    const t = elementTextWithBreaks($, $next as any)
    if (t) text += '\n' + t
    $next = $next.next()
  }
  // Also include the heading's own siblings if the heading itself contained
  // spec text (some sites put everything inside one <p> with the heading
  // inline as <strong>SPECIFICATIONS</strong>).
  return normalizeMultilineText(text)
}

function extractSpecs($: cheerio.CheerioAPI): ScrapedProduct['specs'] {
  const specs: ScrapedProduct['specs'] = {
    weight: '',
    overallLength: '',
    bladeLength: '',
    bladeThickness: '',
    bladeCoating: '',
    bladeMaterial: '',
    lockingMechanism: '',
    designer: '',
    modelNumber: '',
    handleLength: '',
    hardness: '',
    country: '',
  }

  const setSpec = (key: keyof ScrapedProduct['specs'], value: string) => {
    if (!value) return
    if (key === 'country') {
      const country = normalizeCountry(value)
      if (country) specs[key] = country
    } else if (
      key === 'bladeLength' ||
      key === 'overallLength' ||
      key === 'bladeThickness' ||
      key === 'handleLength'
    ) {
      const v = normalizeLength(value)
      if (v) specs[key] = v
    } else if (key === 'weight') {
      const v = normalizeWeight(value)
      if (v) specs[key] = v
    } else {
      const v = cleanValue(value)
      if (v) specs[key] = v
    }
  }

  const tryExtract = (rawLabel: string, rawValue: string) => {
    const label = normalizeText(rawLabel)
    const value = normalizeText(rawValue)
    if (!label || !value) return

    for (const [key, pattern] of SPEC_PATTERNS) {
      if (pattern.test(label) && !specs[key]) {
        setSpec(key, value)
      }
    }
  }

  // 1) Structured rows: tables, definition lists, and divs with label/value
  // classes. These are still the most reliable source when present.
  const rowSelectors = [
    'table tr',
    'table tbody tr',
    'dl div',
    'dl dd',
    '.spec-row',
    '.product-spec',
    '[class*="spec"]',
    '[class*="ProductSpec"]',
    '.product-attribute',
    '.product-data-row',
    '.woocommerce-product-attributes-item',
    '.pdp-specs-row',
    '.specifications-row',
    '.accordion__content tr',
    '.product-card-specification',
  ]

  const labelSelectors =
    'th, dt, .spec-label, [class*="label"], .attribute-label, .pdp-specs-label, [class*="specification-data-title"], [class*="specification-title"]'
  const valueSelectors =
    'td, dd, .spec-value, [class*="value"], .attribute-value, .pdp-specs-value, [class*="specification-data-value"], [class*="specification-value"]'

  $(rowSelectors.join(', ')).each((_, row) => {
    const $row = $(row)
    const label = $row.find(labelSelectors).first().text()
    const value = $row.find(valueSelectors).first().text()
    tryExtract(label, value)
  })

  // 2) SPECIFICATIONS section heading followed by <br>-separated spec lines.
  // This handles Kizer, GiantMouse, and most Shopify-theme spec blocks where
  // all specs live inside a single <p> with <strong>Label</strong>: Value<br>.
  const specBlockText = extractSpecBlock($)
  if (specBlockText) {
    parseSpecLines(specBlockText, tryExtract)
  }

  // 3) Per-element line-based extraction. We re-extract each element's text
  // with <br> preserved as newlines so a single <p> holding many spec lines
  // is parsed correctly.
  $('div, span, p, li').each((_, el) => {
    const text = normalizeMultilineText(elementTextWithBreaks($, el as any))
    if (!text) return
    parseSpecLines(text, tryExtract)
  })

  // 4) Label-aware extraction from JSON-LD / meta descriptions. These often
  // concatenate specs without separators, so we split by known labels.
  const metaDescription = $('meta[name="description"]').attr('content') ?? ''
  const ldDescription = extractJsonLdProduct($).description ?? ''

  for (const source of [ldDescription, metaDescription]) {
    if (!source) continue
    const normalized = normalizeMultilineText(source)
    const chunks = splitBySpecLabels(normalized)
    for (const chunk of chunks) {
      const m = chunk.match(/^(.{2,40}?)\s*[:\uFF1A]\s*(.{1,120}?)\s*$/)
      if (m) tryExtract(m[1], m[2])
    }
    // Also try plain line-by-line in case the description kept newlines.
    parseSpecLines(normalized, tryExtract)
  }

  // 5) Final plain-text fallback regexes. These use word boundaries and
  // require meaningful units so we don't pick up "font-weight:400" or
  // Shopify JSON `"weight":0`.
  const pageText = normalizeMultilineText(
    elementTextWithBreaks($, 'body' as any),
  )
  const allText = `${ldDescription}\n${metaDescription}\n${pageText}`

  const runFallback = (
    key: keyof ScrapedProduct['specs'],
    pattern: RegExp,
    transform: (v: string) => string,
  ) => {
    if (specs[key]) return
    const m = allText.match(pattern)
    if (m) {
      const v = transform(m[1])
      if (v) specs[key] = v
    }
  }

  runFallback(
    'bladeLength',
    /\bblade\s*(?:length|size|len)\s*[:\uFF1A]\s*([\d.,/]+\s*(?:"|''|in|inches|mm|cm)?)/i,
    normalizeLength,
  )
  runFallback(
    'overallLength',
    /\boverall\s*(?:length|size|len)\s*[:\uFF1A]\s*([\d.,/]+\s*(?:"|''|in|inches|mm|cm)?)/i,
    normalizeLength,
  )
  runFallback(
    'handleLength',
    /\bhandle\s*(?:length|size|len)\s*[:\uFF1A]\s*([\d.,/]+\s*(?:"|''|in|inches|mm|cm)?)/i,
    normalizeLength,
  )
  runFallback(
    'bladeThickness',
    /\bblade\s*(?:thickness|thick)\s*[:\uFF1A]\s*([\d.,/]+\s*(?:"|''|in|inches|mm|cm)?)/i,
    normalizeLength,
  )
  runFallback(
    'weight',
    /\bweight\s*[:\uFF1A]\s*([\d.,]+\s*(?:oz|g|grams|lbs|lb|kg)\b)/i,
    normalizeWeight,
  )
  runFallback(
    'bladeMaterial',
    /\bblade\s*(?:material|steel)\s*[:\uFF1A]\s*(.{1,40}?)(?=\n|$)/i,
    cleanValue,
  )
  runFallback(
    'bladeCoating',
    /\bblade\s*(?:coating|finish|finishing)\s*[:\uFF1A]\s*(.{1,40}?)(?=\n|$)/i,
    cleanValue,
  )
  runFallback(
    'lockingMechanism',
    /\b(?:locking\s*mechanism|lock\s*type|lock\s*mechanism)\s*[:\uFF1A]\s*(.{1,40}?)(?=\n|$)/i,
    cleanValue,
  )
  runFallback(
    'designer',
    /\b(?:designer|designed\s*by)\s*[:\uFF1A]\s*(.{1,40}?)(?=\n|$)/i,
    cleanValue,
  )
  runFallback(
    'modelNumber',
    /\b(?:model\s*(?:number|#|no\.?)|sku)\s*[:\uFF1A]\s*(.{1,40}?)(?=\n|$)/i,
    cleanValue,
  )
  runFallback(
    'hardness',
    /\b(?:hardness|hrc|rockwell)\s*[:\uFF1A]\s*([\d.-]+\s*(?:hrc|rockwell)?)/i,
    cleanValue,
  )

  // Country needs special normalization.
  if (!specs.country) {
    const countryMatch = allText.match(
      /\b(?:country\s*of\s*origin|made\s*in)\s*[:\uFF1A]\s*([A-Za-z\s]+?)(?=\n|\.|\s{2,}|$)/i,
    )
    if (countryMatch) {
      const country = normalizeCountry(countryMatch[1])
      if (country) specs.country = country
    }
  }

  return specs
}

const HANDLE_MATERIALS = [
  'Natural Canvas Micarta',
  'Linen Micarta',
  'Canvas Micarta',
  'Micarta',
  'Carbon Fiber',
  'G-10',
  'G10',
  'FRN',
  'PEI',
  'Ultem',
  'Titanium',
  'Aluminum',
  'Aluminium',
  'Brass',
  'Copper',
  'Bronze',
  'Stabilized Wood',
  'Wood',
  'Bone',
  'Stag',
  'Mother of Pearl',
  'Abalone',
  'Rubber',
  'Kraton',
  'Grivory',
  'Nylon',
  'Polymer',
]

function normalizeHandleMaterial(material: string): string {
  const lower = material.toLowerCase()
  if (lower === 'g10') return 'G-10'
  if (lower === 'stag') return 'Stag'
  return material.trim()
}

function extractHandleMaterial(text: string): string {
  const found = new Set<string>()
  for (const material of HANDLE_MATERIALS) {
    const escaped = material.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) {
      found.add(normalizeHandleMaterial(material))
    }
  }
  if (found.size === 0) return ''
  const materials = Array.from(found)
  // Drop generic materials when a more specific variant is present (e.g. Stabilized Wood over Wood).
  const filtered = materials.filter((material) => {
    const lower = material.toLowerCase()
    return !materials.some(
      (other) =>
        other !== material &&
        other.toLowerCase().includes(lower) &&
        other.length > material.length,
    )
  })
  // Sort for stable output.
  return filtered.join(' / ')
}

const BLADE_STYLES = [
  'Reverse Tanto',
  'Drop Point',
  'Clip Point',
  'Tanto',
  'Spear Point',
  'Sheepsfoot',
  'Wharncliffe',
  'Hawkbill',
  'Dagger',
  'Spanto',
  'Trailing Point',
  'Needle Point',
  'Pen Blade',
  'Warncliffe',
  'Harpoons',
  'Hawksbill',
  'Straight back',
  'Straight Back',
]

function extractBladeStyle(text: string): string {
  for (const style of BLADE_STYLES) {
    const escaped = style.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) {
      return style
    }
  }
  return ''
}

function stripHtml(html: string): string {
  return htmlToPlainText(html)
}

export function getShopifyJsonUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    const match = parsed.pathname.match(/\/products\/([^/]+)\/?$/)
    if (!match) return undefined
    parsed.pathname = `/products/${match[1]}.json`
    parsed.search = ''
    parsed.hash = ''
    return parsed.href
  } catch {
    return undefined
  }
}

export function isShopifyProductPage(url: string, html: string): boolean {
  if (!getShopifyJsonUrl(url)) return false
  const shopifyMarkers = [
    'Shopify.shop',
    'myshopify.com',
    'cdn.shopify.com',
    'shopify-checkout-api-token',
    '"@type":"Product"',
  ]
  return shopifyMarkers.some((marker) => html.includes(marker))
}

export function extractShopifyProduct(
  json: unknown,
): Partial<ScrapedProduct> | null {
  const product = (json as { product?: Record<string, unknown> })?.product
  if (!product || typeof product !== 'object') return null

  const title =
    typeof product.title === 'string' ? cleanText(product.title) : ''
  const vendor =
    typeof product.vendor === 'string' ? cleanText(product.vendor) : ''
  const bodyHtml =
    typeof product.body_html === 'string' ? product.body_html : ''
  const description = stripHtml(bodyHtml)

  const images: string[] = []
  const rawImages = product.images
  if (Array.isArray(rawImages)) {
    for (const img of rawImages) {
      if (
        typeof img === 'object' &&
        img &&
        typeof (img as { src?: string }).src === 'string'
      ) {
        images.push((img as { src: string }).src)
      }
    }
  }

  const result: Partial<ScrapedProduct> = {}
  if (title) result.name = title
  if (vendor) result.brand = vendor
  if (description) result.description = description
  if (images.length > 0) result.images = images

  return result
}

function buildConfidence(product: ScrapedProduct): ScrapeConfidence {
  return {
    name: Boolean(product.name),
    brand: Boolean(product.brand),
    description: Boolean(product.description),
    images: product.images.length > 0,
    bladeStyle: Boolean(product.bladeStyle),
    handleMaterial: Boolean(product.handleMaterial),
    specs: {
      weight: Boolean(product.specs.weight),
      overallLength: Boolean(product.specs.overallLength),
      bladeLength: Boolean(product.specs.bladeLength),
      bladeThickness: Boolean(product.specs.bladeThickness),
      bladeCoating: Boolean(product.specs.bladeCoating),
      bladeMaterial: Boolean(product.specs.bladeMaterial),
      lockingMechanism: Boolean(product.specs.lockingMechanism),
      designer: Boolean(product.specs.designer),
      modelNumber: Boolean(product.specs.modelNumber),
      handleLength: Boolean(product.specs.handleLength),
      hardness: Boolean(product.specs.hardness),
      country: Boolean(product.specs.country),
    },
  }
}

export function scrapeProduct(
  html: string,
  baseUrl: string,
  sourceUrl?: string,
): ScrapeResult {
  const $ = cheerio.load(html)
  const ld = extractJsonLdProduct($)

  const name = ld.name || extractTitle($)
  const brand = ld.brand || extractBrand(name, $)
  const description = ld.description || extractDescription($)
  const images = ld.images?.length ? ld.images : extractImages($, baseUrl)
  // Use elementTextWithBreaks so block-level tags and <br> become word
  // boundaries; cheerio's .text() concatenates table cells and <br> lines
  // without separators, which breaks keyword matching (e.g. "MaterialAluminum").
  const pageText = normalizeMultilineText(
    elementTextWithBreaks($, 'body' as any),
  )
  const titleText = normalizeText($('title').text())
  const h1Text = normalizeText($('h1').first().text())
  const searchText = `${titleText} ${h1Text} ${pageText}`
  const specs = extractSpecs($)

  // Use the product description for material/style extraction when available,
  // since it is more likely to describe this exact knife than the full page text.
  const productDescriptionText = normalizeText(description ?? '')
  const bladeStyle =
    cleanValue(extractLabeledValue(productDescriptionText, ['blade style'])) ||
    cleanValue(extractLabeledValue(searchText, ['blade style'])) ||
    extractBladeStyle(productDescriptionText) ||
    extractBladeStyle(searchText)
  const handleMaterial =
    cleanValue(
      extractLabeledValue(productDescriptionText, ['handle material']),
    ) ||
    extractHandleMaterial(productDescriptionText) ||
    cleanValue(extractLabeledValue(searchText, ['handle material'])) ||
    extractHandleMaterial(searchText)

  const product: ScrapedProduct = {
    name,
    brand,
    description,
    images,
    bladeStyle,
    handleMaterial,
    specs,
    sourceUrl: sourceUrl ?? baseUrl,
  }

  return {
    product,
    confidence: buildConfidence(product),
  }
}
