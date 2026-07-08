export type Knife = {
  id: string
  name: string
  brand: string
  bladeStyle: string
  handleMaterial: string
  images: string[]
  specs: {
    weight: string
    overallLength: string
    bladeLength: string
    bladeThickness?: string
    bladeCoating?: string
    bladeMaterial?: string
    lockingMechanism?: string
    designer?: string
    modelNumber?: string
    handleLength?: string
    hardness?: string
    country: string
  }
  addedAt: string
  description: string
  sourceUrl: string
  pinned: boolean
}

export type KnifeDraft = Omit<Knife, 'id' | 'addedAt'>

export type KnifeUpdates = Partial<
  Omit<Knife, 'id' | 'addedAt' | 'images' | 'specs' | 'pinned'>
> & {
  specs?: Partial<Knife['specs']>
  images?: string[]
  pinned?: boolean
}

export function getImageUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('data:image')) return path
  return `/api/images/${path}`
}

export function matchesKnifeSearch(knife: Knife, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    knife.brand.toLowerCase().includes(q) ||
    knife.name.toLowerCase().includes(q)
  )
}
