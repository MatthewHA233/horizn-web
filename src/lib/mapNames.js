/**
 * 现代战舰地图简体中文名称。
 *
 * 游戏 I2Languages 的原始翻译键为 `Maps/map_${MapId}`；联队赛接口通常只返回
 * `MapId`（例如 `TwoSamurai`）。这里同时兼容接口 ID、`map_` 前缀和完整 I2 key。
 */
export const MAP_NAMES_ZH_CN = Object.freeze({
  Greenlands: '绿地',
  Storm: '风暴',
  UnexploredRocks: '未开发岩石区',
  IceWorld: '北极圈',
  LostCity: '失落之城',
  Iceland: '冰岛',
  VikingBay: '维京湾',
  HelicarrierBattle: '天空边境',
  HelicarrierBattle_Day: '浮空群岛',
  StonePeaks: '岩峰',
  TwoSamurai: '双武士',
  MonstrousMaelstrom: '大漩涡',
  MysteryBay: '神秘湾',
  LostCity_rework: '失落之城',
  HiddenDragon: '潜龙',
  AridFrontier: '荒漠前线',
  DeadlyReefs: '致命暗礁',
  PolarFrontier_TDM: '极地边疆',
  OldFactory: '废旧工厂',
  StormClassic: '风暴（经典）',
  IceWorldRemastered: '北极圈（重置）',
  PolarFrontier: '极地边疆',
  OldFactory_DN: '废旧工厂',
  RisingFortress: '高崖要塞',
  IceWorld_NG: '北极圈（迷你）',
  StonePeaks_NG: '岩峰（迷你）',
  UnexploredRocks_NG: '未开发岩石区（迷你）',
  Greenlands_NG: '绿地（迷你）',
})

const MAP_ID_ALIASES = Object.freeze({
  // 联队赛历史数据带下划线，I2 key 实际为 Maps/map_StormClassic。
  Storm_Classic: 'StormClassic',
})

const HAS_HAN = /[\u3400-\u9fff]/

export function mapName(mapId) {
  const raw = String(mapId || '').trim()
  if (!raw) return '未知地图'
  if (HAS_HAN.test(raw)) return raw

  const id = raw.replace(/^Maps\//, '').replace(/^map_/, '')
  return MAP_NAMES_ZH_CN[MAP_ID_ALIASES[id] || id] || '未知地图'
}
