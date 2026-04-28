// Every message type identifier in the protocol — both directions
export const MessageType = {
  // Connection lifecycle
  HANDSHAKE: 'handshake',
  HANDSHAKE_ACK: 'handshake_ack',
  PING: 'ping',
  PONG: 'pong',
  KICK: 'kick',
  RECONNECT: 'reconnect',
  // World state (server → client)
  WORLD_INIT: 'world_init',
  WORLD_DELTA: 'world_delta',
  ZONE_CHANGE: 'zone_change',
  ENTITY_SPAWN: 'entity_spawn',
  ENTITY_DESPAWN: 'entity_despawn',
  // Player input (client → server)
  MOVE: 'move',
  SKILL_USE: 'skill_use',
  SKILL_CANCEL: 'skill_cancel',
  INTERACT: 'interact',
  ITEM_USE: 'item_use',
  // Entity state (server → client)
  ENTITY_MOVE: 'entity_move',
  ENTITY_HEALTH: 'entity_health',
  ENTITY_STATUS: 'entity_status',
  ENTITY_ANIMATION: 'entity_animation',
  ENTITY_RESOURCE: 'entity_resource',
  // Combat (server → client)
  COMBAT_HIT: 'combat_hit',
  COMBAT_MISS: 'combat_miss',
  COMBAT_STATUS_APPLY: 'combat_status_apply',
  COMBAT_STATUS_EXPIRE: 'combat_status_expire',
  COMBAT_KILL: 'combat_kill',
  SKILL_RESULT: 'skill_result',
  // Inventory (bidirectional)
  ITEM_PICKUP: 'item_pickup',
  ITEM_DROP: 'item_drop',
  ITEM_EQUIP: 'item_equip',
  ITEM_UNEQUIP: 'item_unequip',
  ITEM_MOVE: 'item_move',
  INVENTORY_FULL: 'inventory_full',
  INVENTORY_DELTA: 'inventory_delta',
  ITEM_DROPPED_WORLD: 'item_dropped_world',
  ITEM_REMOVED_WORLD: 'item_removed_world',
  // Crafting (bidirectional)
  CRAFT_REQUEST: 'craft_request',
  CRAFT_RESULT: 'craft_result',
  // Auction house (bidirectional)
  AH_LIST: 'ah_list',
  AH_BUY: 'ah_buy',
  AH_CANCEL: 'ah_cancel',
  AH_SEARCH: 'ah_search',
  AH_SEARCH_RESULT: 'ah_search_result',
  AH_LISTING_SOLD: 'ah_listing_sold',
  AH_LISTING_EXPIRED: 'ah_listing_expired',
  // Social (bidirectional)
  CHAT_SEND: 'chat_send',
  CHAT_RECEIVE: 'chat_receive',
  PARTY_INVITE: 'party_invite',
  PARTY_UPDATE: 'party_update',
  PARTY_LEAVE: 'party_leave',
  // World events (server → client)
  EVENT_ANNOUNCE: 'event_announce',
  EVENT_START: 'event_start',
  EVENT_END: 'event_end',
  WORLD_BOSS_SPAWN: 'world_boss_spawn',
  WEATHER_CHANGE: 'weather_change',
  // System (server → client)
  NOTIFICATION: 'notification',
  COOLDOWN_SYNC: 'cooldown_sync',
  SERVER_MESSAGE: 'server_message',
} as const

export type MessageType = (typeof MessageType)[keyof typeof MessageType]
