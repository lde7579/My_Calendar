# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (특히 "허용 npm 패키지" 목록)
- `/.gitignore`, `/.env.example`
- `/.claude/settings.json` (Stop 훅이 `npm run lint && npm run build && npm run test`를 실행한다. 이 step이 끝나면 세 명령이 모두 통과해야 한다)

현재 저장소에는 Next.js 프로젝트가 없다. 루트에는 `docs/`, `scripts/`, `phases/`, `CLAUDE.md`, `life-calendar.html`, `harness_framework/`(빈 폴더)가 있다.

## 작업

저장소 루트(`/`)에 Next.js App Router + TypeScript + Tailwind CSS + Vitest 프로젝트의 최소 골격을 만든다.

1. **패키지 설치**: `docs/ADR.md`의 허용 패키지만 `npm install` / `npm install -D`로 설치한다. 버전은 각 패키지의 최신 안정 버전을 쓴다.
2. **`package.json` scripts** (이름 고정):
   ```json
   {
     "dev": "next dev",
     "build": "next build",
     "start": "next start",
     "lint": "eslint .",
     "test": "vitest run"
   }
   ```
   `name`은 `youtube-next-content`, `private: true`.
3. **설정 파일**:
   - `tsconfig.json`: `strict: true`, path alias `@/*` → `./src/*`
   - `next.config.ts`: 기본값 (옵션 추가 금지)
   - `postcss.config.mjs`: `@tailwindcss/postcss` 플러그인
   - `eslint.config.mjs`: `eslint-config-next` 기반 flat config. `.next/`, `node_modules/`, `scripts/`, `harness_framework/`, `life-calendar.html`은 lint 대상에서 제외
   - `vitest.config.ts`: `environment: "node"`, `include: ["tests/**/*.test.ts"]`, `resolve.alias`로 `@` → `./src` 매핑 (별도 플러그인 설치 금지)
4. **최소 앱 파일**:
   - `src/app/globals.css`: `@import "tailwindcss";` 와 `body { background: #0a0a0a; }` 정도만 둔다
   - `src/app/layout.tsx`: `<html lang="ko">`, 다크 배경, 페이지 제목 metadata `"YouTube Next Content"`
   - `src/app/page.tsx`: "YouTube Next Content" 제목만 렌더링하는 placeholder (step 5에서 교체됨)
5. **스모크 테스트**: `tests/smoke.test.ts`에 `expect(1 + 1).toBe(2)` 수준의 테스트 1개 (vitest가 동작하는지 확인용. 이후 step에서 지워도 된다)
6. **빈 폴더 자리**: `src/types/`, `src/lib/`, `src/services/`는 다음 step에서 만든다. 이 step에서 만들지 마라.
7. **`.gitignore`**: 기존 내용은 유지하고, Next.js 기본 항목 중 빠진 것(`.next/`, `node_modules/`, `next-env.d.ts`, `*.tsbuildinfo`, `.env`)이 있는지만 확인해서 보충한다.

## Acceptance Criteria

```bash
npm run lint    # 에러 없음
npm run build   # 컴파일 에러 없음 (.env 값이 비어 있어도 성공해야 함)
npm run test    # smoke 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (`src/app/` 아래에 앱 코드)
   - ADR의 허용 패키지 목록 외 패키지가 `package.json`에 없는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (설치된 Next.js 버전, 설정 파일 목록, scripts 이름 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 저장소 루트에서 `npx create-next-app`을 실행하지 마라. 이유: 루트에 이미 파일이 있어 충돌로 실패하거나 기존 `CLAUDE.md`·`.gitignore`를 덮어쓸 수 있다. 패키지와 설정 파일을 직접 만든다.
- `CLAUDE.md`, `docs/`, `scripts/`, `phases/`, `life-calendar.html`, `.env`를 수정하거나 지우지 마라. 이유: 하네스 가드레일과 사용자 파일이다.
- ADR 허용 목록 외 패키지(jsdom, @testing-library/*, vite-tsconfig-paths, prettier, UI 라이브러리 등)를 설치하지 마라. 이유: MVP 오버엔지니어링 금지.
- `src/app/api/`, `src/services/` 등 다음 step의 파일을 미리 만들지 마라. 이유: step별 scope 분리.
