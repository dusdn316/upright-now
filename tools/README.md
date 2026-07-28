# tools — 에셋 스크립트

승인된 이미지를 `public/assets/` 로 가져오고 검증하는 Node 스크립트입니다.
앱 코드가 아니라 빌드 전에 한 번씩 돌리는 도구입니다.

| 파일 | 하는 일 |
|---|---|
| `verify-approved-assets.mjs` | `npm run assets:verify` — 필요한 이미지가 다 있고 깨지지 않았는지 검사 |
| `import-approved-assets.mjs` | `npm run assets:import` — 원본 이미지를 WebP 여러 크기로 변환해 배치 |
| `approved-asset-manifest.csv` | 어떤 이미지가 어디로 가야 하는지 목록 |
| `asset-import-report.json` | 마지막 import 결과 기록 |

새 이미지를 추가할 때는 manifest 에 줄을 추가한 뒤 import → verify 순서로 실행합니다.
