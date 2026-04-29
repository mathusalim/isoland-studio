import type { Vec2 } from '../types/math.js'
import type { Tilemap } from '../types/tile.js'
import type { Element, GemPattern, GemPurpose, GemRarity, Resource } from '../types/combat.js'

// ─── Shared domain types ───────────────────────────────────────────────────

export type EntityType = 'player' | 'npc' | 'monster' | 'item' | 'boss'

export type StatusType =
  | 'burn'
  | 'freeze'
  | 'stun'
  | 'curse'
  | 'sear'
  | 'silence'
  | 'drain'
  | 'bleed'

export type AnimationTrigger = 'hit' | 'death' | 'skill_cast' | 'walk' | 'run' | 'idle'

export type EquipSlot =
  | 'head'
  | 'chest'
  | 'legs'
  | 'feet'
  | 'hands'
  | 'weapon'
  | 'offhand'
  | 'accessory'

export type ChatChannel = 'zone' | 'party' | 'trade' | 'whisper'

export type InteractionType = 'loot' | 'talk' | 'use' | 'harvest'

export type KickReason = 'auth_failed' | 'version_mismatch' | 'server_full' | 'banned' | 'timeout'

export type MissReason = 'evaded' | 'out_of_range' | 'immune'

export type NotificationType = 'achievement' | 'level_up' | 'quest_update'

export type WeatherType = 'clear' | 'rain' | 'storm' | 'fog' | 'blizzard'

export type EventKind = 'world_boss' | 'invasion' | 'treasure' | 'dungeon_surge'

export interface StatusEffect {
  type: StatusType
  duration: number // ms remaining
  stacks: number
  sourceId?: string // entity that applied it
}

export interface EntitySnapshot {
  id: string
  type: EntityType
  position: Vec2
  hp: number
  maxHp: number
  status: StatusEffect[]
  animState: AnimationTrigger
}

export interface NetItem {
  id: string // instance ID
  definitionId: string // item template
  quantity: number
  slot?: EquipSlot // set when in an equip slot
}

export interface InventorySlotEntry {
  index: number
  item: NetItem | null
}

export interface CooldownEntry {
  slot: number // skill slot index 0–5
  expiresAt: number // server timestamp (ms)
}

export interface PartyMember {
  id: string
  name: string
  hp: number
  maxHp: number
  position: Vec2
}

export interface AhListing {
  id: string
  item: NetItem
  price: number
  sellerId: string
  sellerName: string
  expiresAt: number
}

export interface AhSearchFilter {
  pattern?: GemPattern
  element?: Element
  rarity?: GemRarity
  purpose?: GemPurpose
  minPrice?: number
  maxPrice?: number
  page?: number
}

// ─── Payload types (one per MessageType value) ────────────────────────────

// Connection lifecycle

export interface HandshakePayload {
  clientVersion: string
  authToken: string
  characterId: string
}

export interface HandshakeAckPayload {
  serverVersion: string
  sessionId: string
  serverTime: number // server clock at send time — used for clock offset calculation
}

export interface PingPayload {
  clientTs: number
}

export interface PongPayload {
  clientTs: number // echo of ping.clientTs
  serverReceiveTs: number
}

export interface KickPayload {
  reason: KickReason
  message: string
}

export interface ReconnectPayload {
  sessionId: string
  lastSeq: number // last sequence the client received — server replays or sends fresh snapshot
}

// World state

export interface WorldInitPayload {
  zoneId: string
  tilemap: Tilemap
  entities: EntitySnapshot[]
  serverTime: number
}

export interface EntityMovePayload {
  id: string
  position: Vec2
  velocity: Vec2
  animState: AnimationTrigger
}

export interface EntityHealthPayload {
  id: string
  hp: number
  maxHp: number
  shield: number
}

export interface EntityStatusPayload {
  id: string
  status: StatusEffect[] // full replacement, not delta
}

export interface EntityAnimationPayload {
  id: string
  trigger: AnimationTrigger
}

export interface EntityResourcePayload {
  id: string
  resource: Resource
  current: number
  max: number
}

export interface WorldDeltaPayload {
  tick: number
  entityCount: number
  lastProcessedSeq: number // highest input seq the server has processed for this player this tick
  moves: EntityMovePayload[] // includes the local player's own authoritative state for reconciliation
  health: EntityHealthPayload[]
  status: EntityStatusPayload[]
  resources: EntityResourcePayload[]
  animations: EntityAnimationPayload[]
  spawns: EntitySnapshot[]
  despawns: string[]
}

export interface ZoneChangePayload {
  zoneId: string
  entryPosition: Vec2
}

export interface EntitySpawnPayload extends EntitySnapshot {
  placeholder: boolean
}

export interface EntityDespawnPayload {
  id: string
}

// Player input

export interface MovePayload {
  seq: number
  direction: Vec2 // cardinal: each axis is -1, 0, or 1
  dt: number // seconds; stored so the server replays with the exact same dt
  timestamp: number // client clock (ms since epoch)
}

export interface SkillUsePayload {
  slot: number
  targetPosition?: Vec2
  targetEntityId?: string
  inputTs: number
}

export interface SkillCancelPayload {
  slot: number
}

export interface InteractPayload {
  targetId: string
  interaction: InteractionType
}

export interface ItemUsePayload {
  itemId: string
  targetId?: string
}

// Combat

export interface CombatHitPayload {
  attackerId: string
  targetId: string
  damage: number
  element: Element
  isCrit: boolean
  knockback?: Vec2
}

export interface CombatMissPayload {
  attackerId: string
  targetId: string
  reason: MissReason
}

export interface CombatStatusApplyPayload {
  entityId: string
  status: StatusType
  duration: number
  sourceId: string
}

export interface CombatStatusExpirePayload {
  entityId: string
  status: StatusType
}

export interface CombatKillPayload {
  killerId: string
  targetId: string
  lootIds: string[]
}

export interface SkillResultPayload {
  slot: number
  accepted: boolean
  rejectReason?: string
  cooldownExpiresAt?: number
  resourceCost?: number
}

// Inventory

export interface ItemPickupPayload {
  itemEntityId: string
}

export interface ItemDropPayload {
  itemId: string
  quantity: number
  position: Vec2
}

export interface ItemEquipPayload {
  itemId: string
  slot: EquipSlot
}

export interface ItemUnequipPayload {
  slot: EquipSlot
}

export interface ItemMovePayload {
  fromIndex: number
  toIndex: number
}

export interface InventoryFullPayload {
  slots: InventorySlotEntry[]
  equipped: Partial<Record<EquipSlot, NetItem>>
}

export interface InventoryDeltaPayload {
  changed: InventorySlotEntry[]
  equippedChanged: Partial<Record<EquipSlot, NetItem | null>>
}

export interface ItemDroppedWorldPayload {
  entityId: string
  position: Vec2
  item: NetItem
}

export interface ItemRemovedWorldPayload {
  entityId: string
}

// Crafting

export interface CraftRequestPayload {
  recipeId: string
  quantity: number
}

export interface CraftResultPayload {
  accepted: boolean
  rejectReason?: string
  producedIds?: string[]
  consumedIds?: string[]
}

// Auction house

export interface AhListPayload {
  itemId: string
  quantity: number
  price: number
  durationHours: number
}

export interface AhBuyPayload {
  listingId: string
}

export interface AhCancelPayload {
  listingId: string
}

export interface AhSearchPayload {
  filter: AhSearchFilter
}

export interface AhSearchResultPayload {
  listings: AhListing[]
  totalCount: number
  page: number
}

export interface AhListingSoldPayload {
  listingId: string
  goldReceived: number
}

export interface AhListingExpiredPayload {
  listingId: string
}

// Social

export interface ChatSendPayload {
  channel: ChatChannel
  targetId?: string // required for whisper
  text: string
}

export interface ChatReceivePayload {
  channel: ChatChannel
  senderId: string
  senderName: string
  text: string
  serverTs: number
}

export interface PartyInvitePayload {
  inviterId: string
  inviterName: string
}

export interface PartyUpdatePayload {
  members: PartyMember[]
}

export interface PartyLeavePayload {
  memberId: string
}

// World events

export interface EventAnnouncePayload {
  eventId: string
  kind: EventKind
  zoneId: string
  startAt: number
  duration: number
}

export interface EventStartPayload {
  eventId: string
  kind: EventKind
}

export interface EventEndPayload {
  eventId: string
  kind: EventKind
}

export interface WorldBossSpawnPayload {
  entityId: string
  position: Vec2
  hp: number
  maxHp: number
}

export interface WeatherChangePayload {
  zoneId: string
  weather: WeatherType
  transitionMs: number
}

// System

export interface NotificationPayload {
  kind: NotificationType
  text: string
  data?: Record<string, string | number>
}

export interface CooldownSyncPayload {
  cooldowns: CooldownEntry[]
}

export interface ServerMessagePayload {
  text: string
}

// ─── Type map and envelope ────────────────────────────────────────────────

export type MessagePayloadMap = {
  handshake: HandshakePayload
  handshake_ack: HandshakeAckPayload
  ping: PingPayload
  pong: PongPayload
  kick: KickPayload
  reconnect: ReconnectPayload
  world_init: WorldInitPayload
  world_delta: WorldDeltaPayload
  zone_change: ZoneChangePayload
  entity_spawn: EntitySpawnPayload
  entity_despawn: EntityDespawnPayload
  move: MovePayload
  skill_use: SkillUsePayload
  skill_cancel: SkillCancelPayload
  interact: InteractPayload
  item_use: ItemUsePayload
  entity_move: EntityMovePayload
  entity_health: EntityHealthPayload
  entity_status: EntityStatusPayload
  entity_animation: EntityAnimationPayload
  entity_resource: EntityResourcePayload
  combat_hit: CombatHitPayload
  combat_miss: CombatMissPayload
  combat_status_apply: CombatStatusApplyPayload
  combat_status_expire: CombatStatusExpirePayload
  combat_kill: CombatKillPayload
  skill_result: SkillResultPayload
  item_pickup: ItemPickupPayload
  item_drop: ItemDropPayload
  item_equip: ItemEquipPayload
  item_unequip: ItemUnequipPayload
  item_move: ItemMovePayload
  inventory_full: InventoryFullPayload
  inventory_delta: InventoryDeltaPayload
  item_dropped_world: ItemDroppedWorldPayload
  item_removed_world: ItemRemovedWorldPayload
  craft_request: CraftRequestPayload
  craft_result: CraftResultPayload
  ah_list: AhListPayload
  ah_buy: AhBuyPayload
  ah_cancel: AhCancelPayload
  ah_search: AhSearchPayload
  ah_search_result: AhSearchResultPayload
  ah_listing_sold: AhListingSoldPayload
  ah_listing_expired: AhListingExpiredPayload
  chat_send: ChatSendPayload
  chat_receive: ChatReceivePayload
  party_invite: PartyInvitePayload
  party_update: PartyUpdatePayload
  party_leave: PartyLeavePayload
  event_announce: EventAnnouncePayload
  event_start: EventStartPayload
  event_end: EventEndPayload
  world_boss_spawn: WorldBossSpawnPayload
  weather_change: WeatherChangePayload
  notification: NotificationPayload
  cooldown_sync: CooldownSyncPayload
  server_message: ServerMessagePayload
}

// Compile-time guard — errors if any MessageType value is missing from the map
type _Exhaustive = Record<import('./messageType.js').MessageType, unknown>
type _AssertCoverage = MessagePayloadMap extends _Exhaustive ? true : never

// Discriminated union: narrowing by .type gives the exact payload type
export type NetMessage = {
  [K in keyof MessagePayloadMap]: {
    type: K
    seq: number
    ts: number // sender clock (ms since epoch)
    payload: MessagePayloadMap[K]
  }
}[keyof MessagePayloadMap]

// Typed helper for constructing a message with a specific type
export type TypedMessage<T extends keyof MessagePayloadMap> = Extract<NetMessage, { type: T }>
