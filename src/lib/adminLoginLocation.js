import cnLoginLocations from '@/data/cnLoginLocations.json'

const COUNTRY_DISPLAY_NAMES = new Intl.DisplayNames(['zh-CN'], { type: 'region' })

function clean(value) {
  return String(value || '').trim()
}

function normalizeLookup(value) {
  return clean(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function getCnLocation(row) {
  const regionCode = clean(row?.region).toUpperCase()
  const rawCity = clean(row?.city)
  const cityLookup = normalizeLookup(rawCity)
  const region = cnLoginLocations.regions[regionCode]

  let cityName = region?.places?.[cityLookup] || ''
  if (!cityName && rawCity && /[\u3400-\u9fff]/.test(rawCity)) cityName = rawCity

  if (!cityName && cityLookup) {
    for (const candidate of Object.values(cnLoginLocations.regions)) {
      if (candidate.places?.[cityLookup]) {
        cityName = candidate.places[cityLookup]
        break
      }
    }
  }

  return {
    regionCode,
    regionName: region?.name || clean(row?.region),
    cityKey: cityLookup || rawCity.toLowerCase(),
    cityName: cityName || rawCity,
  }
}

/** 同一城市、省份、国家的公网 IP 合并为一张地区画像卡片。 */
export function adminLoginLocationKey(row) {
  const country = clean(row?.country_code).toUpperCase()
  const region = clean(row?.region).toUpperCase()
  const city = country === 'CN' ? getCnLocation(row).cityKey : clean(row?.city).toLowerCase()
  if (!country && !region && !city) return 'unknown'
  return `${country}|${region}|${city}`
}

export function adminLoginLocationLabel(row) {
  const countryCode = clean(row?.country_code).toUpperCase()
  const region = clean(row?.region)
  const city = clean(row?.city)

  if (countryCode === 'CN') {
    const { cityName, regionName } = getCnLocation(row)
    return Array.from(new Set([cityName, regionName, '中国'].filter(Boolean))).join(' · ') || '中国'
  }

  let countryName = countryCode
  if (countryCode) {
    try {
      countryName = COUNTRY_DISPLAY_NAMES.of(countryCode) || countryCode
    } catch {
      countryName = countryCode
    }
  }
  return [city, region, countryName].filter(Boolean).join(' · ') || '位置未知'
}
