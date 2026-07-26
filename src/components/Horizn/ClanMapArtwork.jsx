import { mapArtworkUrl } from '@/lib/mapNames'

const VARIANTS = Object.freeze({
  panel: {
    imageOpacity: 0.82,
    overlay: [
      'linear-gradient(180deg, rgba(3,7,18,0.04) 0%, rgba(3,7,18,0.28) 42%, rgba(3,7,18,0.98) 100%)',
      'linear-gradient(90deg, rgba(3,7,18,0.74) 0%, rgba(3,7,18,0.12) 58%, rgba(3,7,18,0.54) 100%)',
    ].join(','),
  },
  selector: {
    imageOpacity: 0.52,
    overlay: [
      'linear-gradient(90deg, rgba(3,7,18,0.92) 0%, rgba(3,7,18,0.58) 52%, rgba(3,7,18,0.78) 100%)',
      'linear-gradient(180deg, rgba(3,7,18,0.18), rgba(3,7,18,0.72))',
    ].join(','),
  },
  row: {
    imageOpacity: 0.3,
    overlay: 'linear-gradient(90deg, rgba(8,14,23,0.96) 0%, rgba(8,14,23,0.74) 50%, rgba(8,14,23,0.46) 100%)',
  },
})

/** 不参与布局的联队战地图材质层，CDN 不可用时自然退回原背景。 */
export default function ClanMapArtwork({ mapId, variant = 'panel', className = '', style }) {
  const src = mapArtworkUrl(mapId)
  if (!src) return null

  const config = VARIANTS[variant] || VARIANTS.panel

  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={style}
    >
      <span
        className="absolute inset-0 scale-[1.01] bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.035]"
        style={{ backgroundImage: `url("${src}")`, opacity: config.imageOpacity }}
      />
      <span className="absolute inset-0" style={{ background: config.overlay }} />
      <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
    </span>
  )
}
