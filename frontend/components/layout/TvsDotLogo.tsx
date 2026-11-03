'use client'
// TVS DOT Logo — "TVS" Arial light blue + "DOT" Arial lime green with horizontal speed-line effect
export default function TvsDotLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: { w: 170, h: 36 }, md: { w: 230, h: 48 }, lg: { w: 290, h: 60 } }
  const { w, h } = dims[size]

  // Center of viewBox = 145
  // "TVS" ends roughly at center, "DOT" starts just after
  const cx = 145  // horizontal center
  const tvsX = cx - 6   // TVS right-anchored to just left of center
  const dotX = cx + 8   // DOT left-anchored just right of center

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 290 58"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="TVS DOT"
      style={{ display: 'block', margin: '0 auto' }}
    >
      <defs>
        {/* Speed-line stripes over DOT region */}
        <clipPath id={`speed-${size}`}>
          {Array.from({ length: 14 }).map((_, i) => (
            <rect key={i} x={dotX} y={i * 4.14} width={290 - dotX} height="2.2" />
          ))}
        </clipPath>
      </defs>

      {/* TVS — right-anchored, light blue Arial */}
      <text
        x={tvsX}
        y="44"
        textAnchor="end"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontStyle="normal"
        fontSize="42"
        fill="#7ec8f7"
        letterSpacing="1"
      >
        TVS
      </text>

      {/* DOT — left-anchored, lime green Arial, speed-line clipped */}
      <text
        x={dotX}
        y="44"
        textAnchor="start"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontStyle="normal"
        fontSize="42"
        fill="#6ceb06"
        letterSpacing="1"
        clipPath={`url(#speed-${size})`}
      >
        DOT
      </text>

      {/* DOT outline for legibility between stripes */}
      <text
        x={dotX}
        y="44"
        textAnchor="start"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontStyle="normal"
        fontSize="42"
        fill="none"
        stroke="#6ceb06"
        strokeWidth="0.8"
        strokeOpacity="0.4"
        letterSpacing="1"
      >
        DOT
      </text>
    </svg>
  )
}
