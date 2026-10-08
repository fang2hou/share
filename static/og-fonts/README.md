# Link preview fonts

These static fonts are loaded by the Worker's PNG renderer. They are not imported into the SPA or downloaded by normal page visitors.

- `IBMPlexSans-Bold.ttf`: IBM Plex Sans, matching the existing `og.png` wordmark. Source: [IBM Plex](https://github.com/IBM/plex/blob/master/packages/plex-sans/fonts/complete/ttf/IBMPlexSans-Bold.ttf). License: `IBM-LICENSE.txt` (SIL Open Font License 1.1).
- `NotoSansCJKsc-Regular.otf`: Noto Sans CJK SC, with Chinese characters, Japanese kana and Korean Hangul for arbitrary filenames. Source: [Noto CJK](https://github.com/notofonts/noto-cjk/blob/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf). License: `NOTO-LICENSE.txt` (SIL Open Font License 1.1).

The fonts are assets rather than Worker imports, so they do not increase the JavaScript/WASM bundle. Keep both upstream license files when updating or redistributing them.
