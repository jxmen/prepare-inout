# 인아웃 과제/면접 대비 연습용 레포

- [JD](./docs/jd.md)

### 공부

- [DB 공부 플랜](./docs/db-study-plan.md)

### 실행

```bash
cp .env.example .env
docker compose up -d --wait   # MySQL 8.4 (localhost:3307, buffer pool 256MB)
pnpm install
pnpm start:dev                # GET localhost:3000/health 로 DB 연결 확인
```
