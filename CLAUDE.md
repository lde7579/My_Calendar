# 프로젝트: YouTube Next Content

내 유튜브 채널을 분석하고, 인기 급상승 영상을 참고해 다음 콘텐츠를 추천하는 **MVP 프로토타입**. 기획은 `docs/PRD.md`, 구조는 `docs/ARCHITECTURE.md`, 결정 사항은 `docs/ADR.md`, UI 규칙은 `docs/UI_GUIDE.md`를 따른다.

## 기술 스택
- Next.js (App Router)
- TypeScript strict mode
- Tailwind CSS
- Vitest (테스트)
- `@anthropic-ai/sdk` + `zod` (추천 생성) / YouTube Data API v3는 `fetch`로 직접 호출

## 아키텍처 규칙
- CRITICAL: MVP다. 오버엔지니어링 금지. `docs/PRD.md`에 없는 기능, 추상화 레이어, 상태 관리 라이브러리, DB, 캐시, 인증을 추가하지 말 것.
- CRITICAL: `YOUTUBE_API_KEY`, `ANTHROPIC_API_KEY`는 서버에서만 사용한다. `src/services/`는 `src/app/api/` 라우트 핸들러에서만 import하고, Client Component에서 import하지 말 것.
- CRITICAL: 테스트에서 실제 YouTube/Claude API를 호출하지 말 것. `fetch`와 Anthropic 클라이언트는 mock한다.
- 디렉토리: 외부 API 래퍼는 `src/services/`, 순수 함수는 `src/lib/`, 타입은 `src/types/`, 테스트는 `tests/`.
- 새 npm 패키지는 ADR에 적힌 것 외에 추가하지 말 것.

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트 (vitest run)
