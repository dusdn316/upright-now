/**
 * incoming-assets/*.png → public/assets/characters/stage-XX/<state>.webp
 *
 * 원본 PNG 는 읽기만 하고 지우거나 덮어쓰지 않습니다.
 * 실행: node scripts/convert-characters.mjs
 */
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SRC = 'incoming-assets'
const OUT = 'public/assets/characters'
const QUALITY = 88
/** 목표 용량. 넘으면 품질을 한 단계씩만 낮춥니다. */
const MAX_BYTES = 350 * 1024

/** stage-03-slouch.png → { stage: '03', state: 'slouch' } */
function parseName(file) {
  const match = /^stage-(\d{2})-([a-z]+)\.png$/.exec(file)
  return match ? { stage: match[1], state: match[2] } : null
}

async function main() {
  const files = (await readdir(SRC)).filter((f) => f.endsWith('.png')).sort()
  const rows = []

  for (const file of files) {
    const parsed = parseName(file)
    if (!parsed) {
      console.log(`건너뜀 (이름 규칙 밖): ${file}`)
      continue
    }

    const srcPath = path.join(SRC, file)
    const image = sharp(srcPath)
    const meta = await image.metadata()
    const outDir = path.join(OUT, `stage-${parsed.stage}`)
    await mkdir(outDir, { recursive: true })
    const outPath = path.join(outDir, `${parsed.state}.webp`)

    let quality = QUALITY
    let buffer = await sharp(srcPath).webp({ quality, effort: 6 }).toBuffer()
    while (buffer.length > MAX_BYTES && quality > 70) {
      quality -= 6
      buffer = await sharp(srcPath).webp({ quality, effort: 6 }).toBuffer()
    }
    await writeFile(outPath, buffer)

    const pngSize = (await stat(srcPath)).size
    rows.push({
      file,
      out: outPath.replace(/\\/g, '/'),
      size: `${meta.width}x${meta.height}`,
      alpha: meta.hasAlpha ? 'yes' : 'no',
      quality,
      pngKB: Math.round(pngSize / 1024),
      webpKB: Math.round(buffer.length / 1024),
    })
  }

  console.table(rows)

  const total = rows.reduce((sum, r) => sum + r.webpKB, 0)
  console.log(`파일 ${rows.length}개 · WebP 합계 ${total}KB`)

  // 변환 결과를 코드에서 참조할 수 있게 목록도 남깁니다.
  await writeFile(
    path.join(OUT, 'generated.json'),
    `${JSON.stringify(
      rows.map(({ out, size, webpKB }) => ({ out, size, webpKB })),
      null,
      2,
    )}\n`,
    'utf8',
  )

  // README 는 참고용으로 함께 복사합니다.
  try {
    const readme = await readFile(path.join(SRC, 'README.md'), 'utf8')
    await writeFile(path.join(OUT, 'SOURCE.md'), readme, 'utf8')
  } catch {
    // README 가 없어도 변환 자체는 성공입니다.
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
