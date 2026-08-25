# FocusMatrix — 코비 4사분면 Task 매니저

Stephen Covey의 시간 관리 매트릭스 기반 스마트 Task 관리 앱.  
중요도와 기한을 입력하면 Task가 자동으로 4사분면에 배치됩니다.

## 기술 스택

- **Web**: Next.js 14 (App Router)
- **Auth**: NextAuth.js v5 + Google OAuth
- **DB**: PostgreSQL + Prisma ORM
- **UI**: Tailwind CSS + Radix UI
- **알림**: Firebase Cloud Messaging (Phase 2)
- **모바일**: Flutter (Phase 3)

## 로컬 개발 환경 설정

### 1. 필수 요구사항

- Node.js 18+
- PostgreSQL 15+

### 2. 환경변수 설정

```bash
cp .env.example .env.local
```

`.env.local` 파일을 열어 아래 값들을 채웁니다:

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `AUTH_SECRET` | `openssl rand -base64 32` 로 생성 |
| `AUTH_GOOGLE_ID` | Google Cloud Console → OAuth 2.0 클라이언트 ID |
| `AUTH_GOOGLE_SECRET` | Google Cloud Console → OAuth 2.0 클라이언트 보안 비밀 |

### 3. Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 선택
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Authorized redirect URIs에 추가:
   - `http://localhost:3000/api/auth/callback/google` (개발)
   - `https://your-domain.com/api/auth/callback/google` (프로덕션)
6. 생성된 Client ID와 Secret을 `.env.local`에 입력

### 4. 데이터베이스 설정

```bash
# Prisma 마이그레이션
npx prisma migrate dev --name init

# (선택) Prisma Studio로 DB 확인
npx prisma studio
```

### 5. 개발 서버 실행

```bash
npm install
npm run dev
```

→ http://localhost:3000 접속

## 4사분면 자동 배치 알고리즘

| | 긴급도 ≥ 7 | 긴급도 < 7 |
|---|---|---|
| **중요도 ≥ 7** | Q1 — 즉시 처리 | Q2 — 핵심 투자 |
| **중요도 < 7** | Q3 — 위임/거절 | Q4 — 제거 |

긴급도는 기한(Due Date)까지 남은 일수로 자동 계산:

| 남은 일수 | 긴급도 |
|---|---|
| 기한 초과 | 10 |
| 오늘/내일 | 9 |
| 3일 이내 | 8 |
| 1주 이내 | 6 |
| 2주 이내 | 4 |
| 1달 이내 | 2 |
| 장기 | 1 |

## 개발 로드맵

- [x] **Phase 1**: 인증 + Task CRUD + 사분면 자동 배치 + 웹 UI
- [ ] **Phase 2**: Google Tasks 동기화 + FCM 푸시 알림
- [ ] **Phase 3**: Flutter 앱 (Android/iOS)
- [ ] **Phase 4**: 주간 리포트 + 반복 Task + 스토어 출시

## 배포

Vercel + Supabase PostgreSQL 권장:

```bash
# Vercel 배포
npx vercel --prod
```

환경변수는 Vercel Dashboard → Settings → Environment Variables에서 설정.
