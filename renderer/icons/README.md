# Icons

PWA / Capacitor 用アイコン。

## 現状

- `uni-icon.svg` — マスター SVG (うに 11 触手 + コア + クリーム背景)

## TODO (リリース前に必須)

- [ ] `uni-icon-192.png` — Android home screen
- [ ] `uni-icon-512.png` — splash + iOS
- [ ] `uni-icon-maskable-512.png` — Android maskable (80% safe zone)
- [ ] `apple-touch-icon-180.png` — iOS web clip
- [ ] `favicon.ico`

SVG からの export は別途。 ImageMagick:

```
magick -background none -density 384 uni-icon.svg -resize 192x192 uni-icon-192.png
magick -background none -density 384 uni-icon.svg -resize 512x512 uni-icon-512.png
```

manifest.webmanifest が PNG エントリを参照しているので、 これらを置けば PWA インストール時に正しく使われる。
SVG だけでも Chrome Android はインストール可能、 iOS Safari は PNG 必須。
