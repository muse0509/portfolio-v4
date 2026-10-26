export function GlassFilterDefs() {
  return (
    <svg
      aria-hidden="true"
      className="glass-filter-defs"
      focusable="false"
      width="0"
      height="0"
    >
      <defs>
        <filter
          id="liquid-glass-distortion"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.018"
            numOctaves="1"
            seed="19"
            stitchTiles="stitch"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="0.65" result="softNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softNoise"
            scale="16"
            xChannelSelector="R"
            yChannelSelector="G"
            result="distortedBackdrop"
          />
          <feGaussianBlur in="distortedBackdrop" stdDeviation="0.35" />
        </filter>
      </defs>
    </svg>
  );
}
