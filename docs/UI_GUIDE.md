# UI 디자인 가이드

## 디자인 원칙
1. 도구처럼 보여야 한다. 마케팅 페이지가 아니라 매일 쓰는 분석 대시보드다.
2. 숫자와 추천 내용이 주인공이다. 장식은 넣지 않는다.
3. 한 화면, 위에서 아래로 읽는다: 입력 → 내 채널 요약 → 분석 코멘트·추천 → 참고한 인기 급상승 영상.

## AI 슬롭 안티패턴 — 하지 마라
| 금지 사항 | 이유 |
|-----------|------|
| backdrop-filter: blur() | glass morphism은 AI 템플릿의 가장 흔한 징후 |
| gradient-text (배경 그라데이션 텍스트) | AI가 만든 SaaS 랜딩의 1번 특징 |
| "Powered by AI" 배지 | 기능이 아니라 장식. 사용자에게 가치 없음 |
| box-shadow 글로우 애니메이션 | 네온 글로우 = AI 슬롭 |
| 보라/인디고 브랜드 색상 | "AI = 보라색" 클리셰 |
| 모든 카드에 동일한 rounded-2xl | 균일한 둥근 모서리는 템플릿 느낌 |
| 배경 gradient orb (blur-3xl 원형) | 모든 AI 랜딩 페이지에 있는 장식 |

## 색상
### 배경
| 용도 | 값 |
|------|------|
| 페이지 | #0a0a0a |
| 카드 | #141414 |

### 텍스트
| 용도 | 값 |
|------|------|
| 주 텍스트 | text-white |
| 본문 | text-neutral-300 |
| 보조 | text-neutral-400 |
| 비활성 | text-neutral-500 |

### 데이터/시맨틱 색상
| 용도 | 값 |
|------|------|
| 포인트 (강조 숫자, Primary 액션 포커스) | #f59e0b (amber-500) |
| 에러 | #ef4444 |
| 중립/구분선 | #262626 (neutral-800) |

## 컴포넌트
### 카드
```
rounded-md bg-[#141414] border border-neutral-800 p-5
```

### 버튼
```
Primary: rounded-md bg-white text-black px-4 py-2 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50
Text:    text-neutral-500 hover:text-neutral-300
```

### 입력 필드
```
rounded-md bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-amber-500 focus:outline-none
```

### 키워드/태그 칩
```
rounded bg-neutral-900 border border-neutral-800 px-2 py-0.5 text-xs text-neutral-300
```

## 레이아웃
- 전체 너비: max-w-5xl mx-auto px-6 py-10
- 정렬: 좌측 정렬 기본. 중앙 정렬 금지
- 간격: 카드 그리드 gap-4, 섹션 간 space-y-8
- 인기 급상승 목록은 표(제목 / 채널 / 조회수) 형태. 썸네일은 작게(w-24)만 허용

## 타이포그래피
| 용도 | 스타일 |
|------|--------|
| 페이지 제목 | text-2xl font-semibold text-white |
| 섹션 제목 | text-sm font-medium text-neutral-400 uppercase tracking-wide |
| 큰 숫자 (구독자, 평균 조회수) | text-3xl font-semibold text-white tabular-nums |
| 본문 | text-sm text-neutral-300 leading-relaxed |

## 애니메이션
- 결과 영역 fade-in (0.3s)만 허용
- 로딩 중에는 버튼 텍스트를 "분석 중…"으로 바꾸고 비활성화한다. 스피너·스켈레톤 애니메이션은 넣지 않는다
- 그 외 모든 애니메이션 금지

## 아이콘
- 기본적으로 아이콘을 쓰지 않는다. 필요하면 SVG 인라인, strokeWidth 1.5
- 아이콘 컨테이너(둥근 배경 박스)로 감싸지 않는다
