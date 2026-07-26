import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AREA_CITY_COMMIT = 'c6c6e35bea3066d674efe2cded189dc57a86e7d8'
const AREA_CITY_URL = `https://raw.githubusercontent.com/xiangyuecn/AreaCity-JsSpider-StatsGov/${AREA_CITY_COMMIT}/src/%E9%87%87%E9%9B%86%E5%88%B0%E7%9A%84%E6%95%B0%E6%8D%AE/ok_data_level3.csv`
const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql'
const WIKIDATA_QUERY = `
SELECT ?code ?itemLabel WHERE {
  ?item wdt:P300 ?code.
  FILTER(STRSTARTS(?code, "CN-"))
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "zh-hans,zh,en".
  }
}
`

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = path.join(projectRoot, 'src', 'data', 'cnLoginLocations.json')
const areaCitySnapshotPath = path.join(projectRoot, 'scripts', 'data', 'ok_data_level3.csv')
const regionSnapshotPath = path.join(projectRoot, 'scripts', 'data', 'cnIsoRegions.wikidata.json')

function parseCsv(source) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ''))
    rows.push(row)
  }

  const [headers, ...records] = rows
  return records
    .filter(record => record.some(Boolean))
    .map(record => Object.fromEntries(headers.map((header, index) => [header.replace(/^\uFEFF/, ''), record[index] || ''])))
}

function normalizeLookup(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'horizn-web-location-dictionary/1.0' },
  })
  if (!response.ok) throw new Error(`下载失败 ${response.status}: ${url}`)
  return response.text()
}

async function loadAreaCitySource() {
  if (process.argv.includes('--refresh-area-city')) {
    const source = await fetchText(AREA_CITY_URL)
    await mkdir(path.dirname(areaCitySnapshotPath), { recursive: true })
    await writeFile(areaCitySnapshotPath, source, 'utf8')
    return source
  }
  return readFile(areaCitySnapshotPath, 'utf8')
}

async function fetchRegionCodes() {
  const url = new URL(WIKIDATA_ENDPOINT)
  url.searchParams.set('format', 'json')
  url.searchParams.set('query', WIKIDATA_QUERY)

  const response = await fetch(url, {
    headers: {
      accept: 'application/sparql-results+json',
      'user-agent': 'horizn-web-location-dictionary/1.0',
    },
  })
  if (!response.ok) throw new Error(`Wikidata 查询失败 ${response.status}`)

  const result = await response.json()
  return result.results.bindings
    .map(binding => ({
      code: binding.code.value.replace(/^CN-/, '').toUpperCase(),
      label: binding.itemLabel.value,
    }))
    .sort((a, b) => a.code.localeCompare(b.code))
}

async function loadRegionCodes() {
  if (process.argv.includes('--refresh-regions')) {
    const regions = await fetchRegionCodes()
    const snapshot = {
      source: 'https://www.wikidata.org/',
      license: 'CC0-1.0',
      retrievedAt: new Date().toISOString(),
      query: 'ISO 3166-2 code (P300) beginning with CN-; Simplified Chinese label',
      regions,
    }
    await mkdir(path.dirname(regionSnapshotPath), { recursive: true })
    await writeFile(regionSnapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
    return snapshot
  }

  return JSON.parse(await readFile(regionSnapshotPath, 'utf8'))
}

const areaRows = parseCsv(await loadAreaCitySource())
const provinceRows = areaRows.filter(row => row.deep === '0' && row.name !== '国外')
const cityRows = areaRows.filter(row => row.deep === '1' || row.deep === '2')
const regionSnapshot = await loadRegionCodes()
const regionCodes = regionSnapshot.regions

if (regionCodes.length !== 34) {
  throw new Error(`ISO 3166-2 中国省级区划应为 34 条，实际得到 ${regionCodes.length} 条`)
}

const provinceByCode = new Map()
for (const region of regionCodes) {
  const matches = provinceRows.filter(province => province.ext_name === region.label || province.name === region.label)
  if (matches.length !== 1) {
    throw new Error(`无法唯一关联 ${region.code} ${region.label}，匹配数：${matches.length}`)
  }
  provinceByCode.set(region.code, matches[0])
}

const provinceCodeById = new Map(
  Array.from(provinceByCode, ([code, province]) => [province.id, code]),
)
const cityById = new Map(areaRows.filter(row => row.deep === '1').map(row => [row.id, row]))
const placesByRegion = new Map(Array.from(provinceByCode.keys(), code => [code, new Map()]))

for (const place of cityRows) {
  const provinceId = place.deep === '1' ? place.pid : cityById.get(place.pid)?.pid
  const regionCode = provinceCodeById.get(provinceId)
  const lookup = normalizeLookup(place.pinyin)
  if (!regionCode || !lookup) continue

  const places = placesByRegion.get(regionCode)
  const existing = places.get(lookup)
  const candidate = {
    name: place.name,
    fullName: place.ext_name,
    level: Number(place.deep),
  }

  // 同音地名无法仅凭 Vercel city 头区分，优先采用更稳定的地级市名称。
  if (!existing || candidate.level < existing.level) places.set(lookup, candidate)
}

const regions = {}
for (const [code, province] of Array.from(provinceByCode).sort(([a], [b]) => a.localeCompare(b))) {
  const places = Object.fromEntries(
    Array.from(placesByRegion.get(code))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([lookup, place]) => [lookup, place.name]),
  )

  regions[code] = {
    name: province.name,
    fullName: province.ext_name,
    pinyin: normalizeLookup(province.pinyin),
    places,
  }
}

const dictionary = {
  meta: {
    generatedAt: regionSnapshot.retrievedAt,
    areaCity: {
      repository: 'https://github.com/xiangyuecn/AreaCity-JsSpider-StatsGov',
      revision: AREA_CITY_COMMIT,
      license: 'MIT',
      source: AREA_CITY_URL,
    },
    regionCodes: {
      source: regionSnapshot.source,
      license: regionSnapshot.license,
      retrievedAt: regionSnapshot.retrievedAt,
      query: regionSnapshot.query,
    },
  },
  regions,
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(dictionary, null, 2)}\n`, 'utf8')

const placeCount = Object.values(regions).reduce(
  (sum, region) => sum + Object.keys(region.places).length,
  0,
)
console.log(`已生成 ${outputPath}`)
console.log(`省级区划 ${Object.keys(regions).length} 条，城市/区县拼音索引 ${placeCount} 条`)
