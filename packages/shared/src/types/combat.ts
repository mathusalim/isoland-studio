export type Element =
  | 'fire' | 'ice' | 'lightning' | 'dark'
  | 'holy' | 'arcane' | 'void' | 'physical'

export type GemPattern =
  | 'arc' | 'sphere' | 'line' | 'particle'
  | 'cone' | 'nova' | 'beam' | 'projectile'
  | 'aura' | 'ground' | 'chain'

export type GemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export type GemPurpose =
  | 'generator' | 'spender' | 'defensive'
  | 'utility' | 'channel' | 'reaction' | 'summon' | 'ultimate'

export type Resource =
  | 'rage' | 'overflow' | 'combo' | 'focus'
  | 'faith' | 'shadow' | 'blood' | 'momentum'

export interface SkillGem {
  id: string
  pattern: GemPattern
  element: Element
  rarity: GemRarity
  purpose: GemPurpose
}
