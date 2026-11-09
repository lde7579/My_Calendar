# Architecture Decision Records

## 철학
MVP 속도 최우선. 오버엔지니어링 금지. 외부 의존성 최소화. 작동하는 최소 구현을 선택한다. 페이지 1개, API 라우트 2개, DB 없음.

허용 npm 패키지(이 외 추가 금지):
- dependencies: `next`, `react`, `react-dom`, `@anthropic-ai/sdk`, `zod`
- devDependencies: `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `tailwindcss`, `@tailwindcss/postcss`, `postcss`, `eslint`, `eslint-config-next`, `vitest`

컴포넌트 렌더링 테스트(jsdom, Testing Library)는 하지 않는다. UI는 `npm run build`와 `npm run lint`, 그리고 사용자의 수동 확인으로 검증한다.

---

### ADR-001: Next.js (App Router) + TypeScript + Tailwind CSS
**결정**: Next.js App Router, TypeScript strict mode, Tailwind CSS. 테스트는 Vitest.
**이유**: 페이지와 서버 API 라우트를 한 프로젝트에서 처리할 수 있어 API 키를 서버에만 두기 쉽다. Vitest는 설정이 가볍고 TS를 바로 지원한다.
**트레이드오프**: Python 대비 데이터 처리 코드가 약간 길다. 별도 백엔드 없이 Next.js에 묶인다.

### ADR-002: YouTube Data API v3는 `fetch`로 직접 호출 (googleapis 패키지 미사용)
**결정**: `https://www.googleapis.com/youtube/v3/*` 엔드포인트를 `fetch` + API 키(`key=`)로 호출한다. 사용 엔드포인트는 `channels.list`(`id` 또는 `forHandle`), `playlistItems.list`, `videos.list`(id 조회 및 `chart=mostPopular`) 4가지뿐이다.
**이유**: `googleapis` 패키지는 크고, 우리가 쓰는 엔드포인트는 4개뿐이다. 공개 데이터라 OAuth가 필요 없다.
**트레이드오프**: 응답 타입을 직접 정의해야 한다. 필요한 필드만 최소로 정의한다.

### ADR-003: "바이럴" 기준 = YouTube 공식 인기 급상승 차트 (`chart=mostPopular`, `regionCode=KR`)
**결정**: 내 채널의 주력 카테고리(`videoCategoryId`)로 필터한 인기 급상승 영상을 사용한다. 그 카테고리가 차트를 지원하지 않아 에러나 빈 결과가 나오면 카테고리 없이 다시 조회하고, 응답에 `trendingFallback: true`를 담는다.
**이유**: 쿼터가 1 unit으로 싸고 구현이 단순하다. `search.list`는 100 units라 무료 쿼터(10,000/일)에서 부담이 된다.
**트레이드오프**: 카테고리 단위라 내 세부 장르와 무관한 영상이 섞일 수 있다. 관련성 판단은 Claude 추천 단계에 맡긴다.

### ADR-004: 추천은 Claude API, 구조화 출력(Zod)으로 받는다
**결정**: `@anthropic-ai/sdk`의 `client.messages.parse()` + `output_config: { format: zodOutputFormat(Schema) }`로 JSON을 스키마 검증된 상태로 받는다. 모델은 `claude-opus-5-5`, `output_config.effort: "medium"`(Opus 5.5 기본값이지만 명시), `max_tokens: 16000`, thinking 파라미터는 생략(adaptive 기본).
**이유**: 자연어 추천 품질이 규칙 기반보다 훨씬 좋다. Zod 스키마로 받으면 UI가 응답 형식을 신뢰할 수 있다.
**트레이드오프**: `ANTHROPIC_API_KEY`가 추가로 필요하고 요청마다 비용·지연(수 초~수십 초)이 생긴다.
**주의**:
- 응답을 읽기 전에 `stop_reason`을 확인한다. `"refusal"`이면 에러로 처리한다.
- Opus 5.5는 assistant prefill, `temperature`/`top_p`, `thinking: {type: "disabled"}`, `budget_tokens`를 모두 400으로 거부한다. 사용하지 않는다.
- 모델 ID에 날짜 접미사를 붙이지 않는다 (`claude-opus-5-5` 그대로).
- 서버 측 refusal fallback(beta)은 MVP에서 쓰지 않는다. 콘텐츠 추천 주제에서는 거절될 일이 드물고, 거절되면 502를 돌려주고 화면의 "추천 다시 시도"로 처리한다.

### ADR-005: API 라우트를 2개로 나눈다 (`/api/channel`, `/api/recommend`)
**결정**: YouTube 조회·요약(빠름)과 Claude 추천(느림)을 별도 라우트로 분리한다. 1단계 응답을 클라이언트가 들고 있다가 2단계 요청 본문으로 보낸다.
**이유**: 사용자가 30초 동안 빈 화면을 보지 않게 하고, "다른 추천 받기"에서 YouTube를 다시 조회하지 않게 한다. 스트리밍이나 작업 큐보다 훨씬 단순하다.
**트레이드오프**: `/api/recommend`가 클라이언트가 보낸 요약을 그대로 신뢰한다. 로컬 1인용 MVP라 허용한다. 대신 Zod로 요청 본문 형식은 검증한다.

### ADR-006: 테스트에서 외부 API를 실제로 호출하지 않는다
**결정**: `services/` 테스트는 `fetch`와 Anthropic 클라이언트를 mock한다. `lib/`는 순수 함수라 입력/출력만 검증한다.
**이유**: TDD 반복 속도, 쿼터·비용 절약, API 키 없이 CI/execute.py에서 테스트를 통과시키기 위해서다.
**트레이드오프**: 실제 API 응답 형식이 바뀌면 테스트가 못 잡는다. 실 API 확인은 사용자가 `npm run dev`에서 수동으로 한다.
