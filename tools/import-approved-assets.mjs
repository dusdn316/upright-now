/**
 * 승인 에셋 import — asset-drop 의 ZIP 에서 public/assets 로 재현 가능하게 변환.
 *
 * 규칙:
 * - ZIP 은 .tmp-assets 안에서만 해제, 원본은 수정하지 않음
 * - 승인 경로만 import (프리뷰·contact sheet·README 제외)
 * - PNG → WebP (quality 88, alpha 유지, 메타데이터 제거)
 * - 캐릭터·괴물은 256/512/1024 변형, 스트레칭 카드는 1024 단일,
 *   캠퍼스 지도는 768/1024/1536
 * - 동일 입력 → 동일 출력 (파일명·크기·인코딩 고정)
 * - 원본 PNG·ZIP 을 public 에 복사하지 않음
 *
 * 실행: npm run assets:import
 */
import AdmZip from 'adm-zip'
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DROP = join(ROOT, 'asset-drop')
const TMP = join(ROOT, '.tmp-assets')
const OUT = join(ROOT, 'public', 'assets')

const MASTER_ZIP = 'UpRight_Now_Approved_Design_Assets_v1.zip'
const KOMONG_ZIP = '꼬몽이.zip'
/** 자동 생성 팩 — 발견해도 절대 import 금지 */
const BANNED = /full_asset_pack/i

const report = { imported: [], skipped: [], missing: [], errors: [] }

function out(rel) {
  const p = join(OUT, rel)
  mkdirSync(dirname(p), { recursive: true })
  return p
}

async function toWebp(inputBuf, rel, size) {
  const image = sharp(inputBuf, { failOn: 'error' })
  const meta = await image.metadata()
  // 스트레칭 카드·캠퍼스 지도는 배경이 있는 전체 이미지라 alpha 가 없어도 정상.
  if (!meta.hasAlpha && !rel.startsWith('campus/') && !rel.startsWith('stretch/')) {
    report.errors.push(`no-alpha: ${rel}`)
  }
  const resized = size
    ? image.resize({ width: size, height: size, fit: 'inside', withoutEnlargement: false })
    : image
  // 메타데이터(EXIF 등)는 기본적으로 제거됩니다. effort 고정으로 결정적 출력.
  const buf = await resized.webp({ quality: 88, effort: 4 }).toBuffer()
  writeFileSync(out(rel), buf)
  report.imported.push(rel)
}

function entryBuf(zip, name) {
  const entry = zip.getEntry(name)
  return entry ? entry.getData() : null
}

async function importCharacters(zip) {
  const stages = [
    ['stage-01-ppogak-turtle', 'stage-01'],
    ['stage-02-kkumteul-turtle', 'stage-02'],
    ['stage-03-ppaekkom-turtle-giraffe', 'stage-03'],
    ['stage-04-bandeut-turtle-giraffe', 'stage-04'],
    ['stage-05-jjukjjuk-giraffe', 'stage-05'],
    ['stage-06-uttuk-giraffe', 'stage-06'],
  ]
  for (const [src, dir] of stages) {
    const buf = entryBuf(zip, `asset-drop/02_characters/web_ready_1024/${src}.png`)
    if (!buf) {
      report.missing.push(`characters/${dir}`)
      continue
    }
    for (const size of [256, 512, 1024]) {
      await toWebp(buf, `characters/stages/${dir}/idle-${size}.webp`, size)
    }
  }
}

async function importMonsters(zip, komongZip) {
  for (const monster of ['bookmong', 'neulmong']) {
    for (let phase = 1; phase <= 4; phase += 1) {
      const p = String(phase).padStart(2, '0')
      const buf = entryBuf(
        zip,
        `asset-drop/03_monsters/${monster}/${monster}-phase-${p}-idle.png`,
      )
      if (!buf) {
        report.missing.push(`monsters/${monster}/phase-${p}`)
        continue
      }
      for (const size of [256, 512, 1024]) {
        await toWebp(buf, `monsters/${monster}/phase-${p}/idle-${size}.webp`, size)
      }
    }
  }
  // 꼬몽이 — 별도 승인 ZIP 이 있을 때만 생성
  if (!komongZip) {
    report.missing.push('monsters/komong (승인 ZIP 없음 — SVG 폴백 유지)')
    return
  }
  for (let phase = 1; phase <= 4; phase += 1) {
    const p = String(phase).padStart(2, '0')
    const buf = entryBuf(komongZip, `phase-${p}_kkomongi_idle_1024.png`)
    if (!buf) {
      report.missing.push(`monsters/komong/phase-${p}`)
      continue
    }
    for (const size of [256, 512, 1024]) {
      await toWebp(buf, `monsters/komong/phase-${p}/idle-${size}.webp`, size)
    }
  }
}

async function importStoreLayers(zip) {
  const jackets = [
    ['navy', 'jacket-navy'],
    ['burgundy', 'jacket-burgundy'],
    ['forest', 'jacket-forest'],
    ['coral', 'jacket-coral'],
  ]
  const backpacks = [
    ['freshman', 'backpack-freshman'],
    ['library', 'backpack-library'],
    ['team_project', 'backpack-team'],
  ]
  for (const [src, itemId] of jackets) {
    for (let stage = 1; stage <= 6; stage += 1) {
      const st = String(stage).padStart(2, '0')
      const buf = entryBuf(
        zip,
        `asset-drop/04_store_items/01_app_layers/jackets/${src}/stage_${st}_jacket.png`,
      )
      if (!buf) {
        report.missing.push(`store/jackets/${itemId}/stage-${st}`)
        continue
      }
      await toWebp(buf, `store/layers/jackets/${itemId}/stage-${st}.webp`, 1024)
    }
  }
  for (const [src, itemId] of backpacks) {
    for (let stage = 1; stage <= 6; stage += 1) {
      const st = String(stage).padStart(2, '0')
      for (const side of ['back', 'front']) {
        const buf = entryBuf(
          zip,
          `asset-drop/04_store_items/01_app_layers/backpacks/${src}/stage_${st}_${side}.png`,
        )
        if (!buf) {
          report.missing.push(`store/backpacks/${itemId}/stage-${st}-${side}`)
          continue
        }
        await toWebp(
          buf,
          `store/layers/backpacks/${itemId}/stage-${st}-${side}.webp`,
          1024,
        )
      }
    }
  }
}

async function importStretch(zip) {
  const cards = [
    ['01-shoulder-roll', 'shoulder-roll'],
    ['02-scapular-squeeze', 'scapular-squeeze'],
    ['03-wrist-forearm-stretch', 'wrist-forearm'],
    ['04-seated-torso-rotation', 'seated-torso-rotation'],
    ['05-neck-side-movement', 'neck-side-movement'],
    ['06-calf-raise', 'calf-raise'],
  ]
  for (const [src, id] of cards) {
    const buf = entryBuf(zip, `asset-drop/05_stretching/${src}.png`)
    if (!buf) {
      report.missing.push(`stretch/${id}`)
      continue
    }
    await toWebp(buf, `stretch/cards/${id}.webp`, 1024)
  }
}

async function importCampus(zip) {
  const buf = entryBuf(zip, 'asset-drop/01_campus/campus-map-source.png')
  if (!buf) {
    report.missing.push('campus/campus-map-bg')
    return
  }
  for (const width of [768, 1024, 1536]) {
    const image = sharp(buf, { failOn: 'error' }).resize({ width })
    const outBuf = await image.webp({ quality: 88, effort: 4 }).toBuffer()
    writeFileSync(out(`campus/campus-map-bg-${width}.webp`), outBuf)
    report.imported.push(`campus/campus-map-bg-${width}.webp`)
  }
  // 기존 코드 호환 경로 (TerritoryMap 이 참조) — 1024 를 기본으로
  const base = await sharp(buf, { failOn: 'error' })
    .resize({ width: 1024 })
    .webp({ quality: 88, effort: 4 })
    .toBuffer()
  writeFileSync(out('campus/campus-map-bg.webp'), base)
  report.imported.push('campus/campus-map-bg.webp')
}

async function main() {
  if (!existsSync(join(DROP, MASTER_ZIP))) {
    console.error(`master zip not found: asset-drop/${MASTER_ZIP}`)
    process.exit(1)
  }
  rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })

  const master = new AdmZip(join(DROP, MASTER_ZIP))
  const komongPath = join(DROP, KOMONG_ZIP)
  const komongAlt = join(DROP, 'komong.zip')
  const komong = existsSync(komongPath)
    ? new AdmZip(komongPath)
    : existsSync(komongAlt)
      ? new AdmZip(komongAlt)
      : null

  // 금지 팩 감지 — 있어도 절대 사용하지 않음
  for (const entry of master.getEntries()) {
    if (BANNED.test(entry.entryName)) {
      report.skipped.push(`banned: ${entry.entryName}`)
    }
  }

  await importCharacters(master)
  await importMonsters(master, komong)
  await importStoreLayers(master)
  await importStretch(master)
  await importCampus(master)

  // manifest 사본 (참조용, 이미지 아님) — 재현성 확인용 해시 기록
  const manifestEntry = master.getEntry('asset-drop/ASSET_MANIFEST.csv')
  if (manifestEntry) {
    const csv = manifestEntry.getData()
    writeFileSync(join(ROOT, 'tools', 'approved-asset-manifest.csv'), csv)
  }

  rmSync(TMP, { recursive: true, force: true })

  const summary = {
    importedCount: report.imported.length,
    missing: report.missing,
    skipped: report.skipped,
    errors: report.errors,
    hash: createHash('sha256')
      .update(report.imported.sort().join('\n'))
      .digest('hex')
      .slice(0, 12),
  }
  writeFileSync(
    join(ROOT, 'tools', 'asset-import-report.json'),
    JSON.stringify({ ...summary, imported: report.imported.sort() }, null, 2),
  )
  console.log(JSON.stringify(summary, null, 2))
  if (report.errors.length > 0) process.exit(1)
}

await main()
