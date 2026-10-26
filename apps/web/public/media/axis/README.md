# Axis media slots

The Featured Work section keeps nullable media paths so it can fall back safely,
but the verified local assets are now enabled in `src/content/site.ts`.

Active production filenames:

- `axis-logo.svg`
- `axis-teaser.mp4`
- `axis-teaser-poster.webp`

`axis-teaser.mp4` is the web delivery encode. The original high-bitrate source is
kept locally under the git-ignored `docs/design/concepts/product-cinema/source-media/`
directory so it is not copied into the Cloudflare static asset bundle.

To temporarily disable an asset without producing a 404, set its corresponding
`logoSrc`, `videoSrc`, or `posterSrc` value to `null`.
