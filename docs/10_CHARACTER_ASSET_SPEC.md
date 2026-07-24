# CHARACTER ASSET SPEC

## 1. 디자인 기준

기준 이미지: `references/character-growth-final.jpeg`

### 스타일

- 따뜻한 3D 렌더
- 말랑하고 둥근 비율
- 초록 거북이 → 노란 기린
- 큰 눈과 친근한 표정
- 아이보리 배경
- 부드러운 그림자
- 최종 단계에 대학 과잠·캠퍼스 백팩

실제 실시간 3D 모델·GLB·리깅은 구현하지 않습니다.

## 2. 성장 단계

| 단계 | 이름 | 반드시 구분할 외형 |
|---:|---|---|
| 1 | 뽀각 거북 | 목 완전 숨김, 등껍질이 몸보다 큼, 낮은 실루엣 |
| 2 | 꿈틀 거북 | 머리·짧은 목 등장, 거북이 체형 유지 |
| 3 | 빼꼼 거부기린 | 짧은 기린 목·뿔·얼룩, 큰 등껍질 유지 |
| 4 | 반듯 거부기린 | 중간 길이 목·세운 몸통, 등껍질이 백팩 크기 |
| 5 | 쭉쭉 기린 | 완전한 기린 체형, 긴 목, 기본 상태 |
| 6 | 우뚝 기린 | 가장 긴 목, 당당한 표정, 과잠·백팩, 성숙한 자세 |

### 차별화 핵심

- 빼꼼과 반듯은 **목 길이·몸통 각도·등껍질 크기**가 분명히 달라야 합니다.
- 쭉쭉과 우뚝은 **의상·백팩·표정·목 길이·자세**가 달라야 합니다.

## 3. 필요한 기본 에셋

### 성장 화면

```text
stage-01.webp
stage-02.webp
stage-03.webp
stage-04.webp
stage-05.webp
stage-06.webp
```

### 세션 상태

최종 권장:

```text
stage-XX-idle.webp
stage-XX-warning.webp
stage-XX-slouch.webp
stage-XX-recover.webp
```

6단계 × 4상태 = 24장

### 공통 모션

```text
attack.webm
celebrate.webm
level-up.webm
stretch.webm
away.webm
```

모션 에셋이 준비되지 않으면 CSS scale·translate·glow로 대체합니다.

## 4. 파일 규격

### WebP

- 1024×1024 마스터
- 표시용 512×512 또는 640×640
- 투명 배경 권장
- sRGB
- 파일당 300KB 이하 목표

### WebM

- VP9 alpha 또는 배경색 고정
- 3~6초 루프
- 30fps 이하
- 파일당 1.5MB 이하 목표
- 자동 재생 시 음소거

## 5. 정렬 규격

모든 단계와 상태:

- 동일 캔버스
- 발바닥 기준선 동일
- 중심 x 동일
- 카메라 45도 또는 정면 중 하나로 통일
- 조명 방향 동일
- 그림자 위치 동일
- 머리·목이 캔버스 밖으로 나가지 않음

## 6. 프로토타입 폴백

상태별 에셋이 없을 때:

- 성장 단계 WebP 6장만 사용
- warning: 0.98 scale + 고개 살짝 아래
- bad: 0.94 scale + y 6px + 코랄 글로우
- recover: 1.03 scale + 파랑→초록 글로우
- success: 공통 attack WebM 오버레이

## 7. 컴포넌트 계약

```ts
interface CharacterViewportProps {
  stage: 1 | 2 | 3 | 4 | 5 | 6;
  state: "idle" | "warning" | "slouch" | "recover" | "away";
  jacketId?: string;
  backpackId?: string;
  reducedMotion?: boolean;
}
```

UI는 파일 경로를 직접 하드코딩하지 않고 manifest를 사용합니다.

## 8. 아이템 레이어

과잠·백팩은 캐릭터와 같은 캔버스 규격의 투명 레이어로 만듭니다.

```text
jacket-navy-stage-01.webp
...
jacket-navy-stage-06.webp
backpack-library-stage-01.webp
...
```

MVP에서 모든 상태별 의상 레이어를 만들기 어렵다면 성장·상점 화면에서만 장착 이미지를 표시하고 세션 화면은 기본 캐릭터를 사용해도 됩니다.

## 9. 접근성

- 이미지 alt: `Lv.3 빼꼼 거부기린`
- 상태는 이미지 외에 텍스트로 표시
- 감소된 모션에서는 WebM 사용 금지
- 반짝임 빈도 제한

## 10. 검수 체크

- [ ] 6단계 실루엣이 즉시 구분됨
- [ ] 초록→노랑 변화가 자연스러움
- [ ] 빼꼼·반듯 차이가 명확함
- [ ] 쭉쭉·우뚝 차이가 명확함
- [ ] 작은 위젯에서 얼굴과 목이 보임
- [ ] 과잠·백팩 위치가 단계별로 맞음
- [ ] 전체 앱에서 그림체가 동일함
