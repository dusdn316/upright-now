# ASSET MANIFEST

## 1. 기준 이미지

| 파일 | 용도 |
|---|---|
| `references/character-growth-final.jpeg` | 6단계 캐릭터 디자인 기준 |
| `references/dashboard-ui-concept.png` | 대시보드 구조·색상 기준 |

기준 이미지는 최종 화면에 그대로 노출하는 프로덕션 에셋이 아니라 제작 기준입니다.

## 2. 캐릭터 기본 에셋

권장 경로:

```text
public/assets/characters/
├─ stage-01/
│  ├─ idle.webp
│  ├─ warning.webp
│  ├─ slouch.webp
│  └─ recover.webp
├─ stage-02/
├─ stage-03/
├─ stage-04/
├─ stage-05/
└─ stage-06/
```

### 단계 매핑

| 폴더 | 캐릭터 |
|---|---|
| stage-01 | 뽀각 거북 |
| stage-02 | 꿈틀 거북 |
| stage-03 | 빼꼼 거부기린 |
| stage-04 | 반듯 거부기린 |
| stage-05 | 쭉쭉 기린 |
| stage-06 | 우뚝 기린 |

## 3. 공통 모션

```text
public/assets/effects/
├─ attack.webm
├─ celebrate.webm
├─ level-up.webm
├─ giraffe-sync.webm
├─ boss-hit.webm
└─ shield.webm
```

감소된 모션용:

```text
attack.webp
celebrate.webp
level-up.webp
```

## 4. 몬스터

```text
public/assets/bosses/d-day/
├─ phase-01.webp
├─ phase-02.webp
├─ phase-03.webp
├─ defeated.webp
└─ hit.webm
```

## 5. 스트레칭

```text
public/assets/stretch/
├─ shoulder-roll.webm
├─ scapular-squeeze.webm
├─ wrist-forearm.webm
├─ seated-twist.webm
├─ neck-turn.webm
├─ calf-raise.webm
└─ posters/
   ├─ shoulder-roll.webp
   └─ ...
```

## 6. 과잠

```text
public/assets/items/jackets/
├─ navy/
│  ├─ stage-01.webp
│  └─ ... stage-06.webp
├─ burgundy/
├─ forest/
└─ coral/
```

각 파일은 캐릭터 기본 이미지와 동일한 캔버스·기준선·중심을 사용합니다.

## 7. 백팩

```text
public/assets/items/backpacks/
├─ freshman/
├─ library/
└─ team/
```

단계별 6장 또는 제한된 성장 단계에서만 표시합니다.

## 8. 사운드

```text
public/assets/audio/
├─ recovery-success.ogg
├─ boss-hit.ogg
├─ giraffe-sync.ogg
├─ level-up.ogg
└─ stretch-complete.ogg
```

도서관 모드에서는 기본 음소거입니다.

## 9. 아이콘

Lucide 같은 일관된 오픈소스 아이콘 세트를 사용합니다. 외부 서비스 아이콘을 복사하지 않습니다.

## 10. Asset Manifest JSON

```ts
interface CharacterAssetManifest {
  stages: Record<
    CharacterStage,
    Record<"idle" | "warning" | "slouch" | "recover", string>
  >;
  effects: {
    attack: string;
    celebrate: string;
    levelUp: string;
    giraffeSync: string;
  };
}
```

## 11. 파일명 규칙

- 영문 소문자
- kebab-case
- 한글·공백 없음
- 단계는 두 자리
- 상태명 고정

예:

```text
stage-03-recover.webp
jacket-forest-stage-06.webp
stretch-shoulder-roll.webm
```

## 12. 품질 체크

- [ ] 이미지 크기 통일
- [ ] 발바닥 기준선 통일
- [ ] 같은 조명·각도
- [ ] WebP 300KB 이하 목표
- [ ] WebM 1.5MB 이하 목표
- [ ] alt 문구 있음
- [ ] 감소된 모션 폴백 있음
- [ ] 누락 시 기본 에셋 폴백
