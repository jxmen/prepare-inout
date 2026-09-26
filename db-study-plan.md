# 식단 기록 웹으로 배우는 DB 설계·최적화 플랜

> 작성일: 2026-09-26 · 기간: 3일~1주

## 왜 이렇게 짰는지

- **공고가 요구하는 것과 이력서에 있는 것의 차이:** JD는 "테이블·관계·인덱스 설계", "쿼리·인덱스·캐시 개선", "고려한 대안과 선택한 이유"를 요구한다. 그런데 이력서의 DB 근거는 cs-ai-interviewer에서 한 복합 인덱스 교체 한 줄뿐이고, 개선 전후 측정값이 없다.
- **목표는 앱이 아니라 기록이다:** 앱 기능은 최소로 두고, 결과물을 두 가지로 남긴다.
  - **`DECISIONS.md`:** 설계에서 고려한 대안과 선택한 이유
  - **`BENCHMARK.md`:** 개선 전후의 EXPLAIN 결과와 수치
- **스택은 Node.js, TypeScript, MySQL 8(Docker), SQL 직접 작성:** 온라인 과제와 스택이 같아서 과제 연습도 된다.
  - Kysely나 mysql2로 SQL을 직접 쓰는 이유는 ORM이 쿼리를 가리지 않게 하려는 것이다.
  - MariaDB 대신 MySQL 8을 고른 이유는 `EXPLAIN ANALYZE`, 히스토그램, invisible index 같은 실험 도구가 더 좋아서다.
- **데이터가 많아야 배울 게 생긴다:** 몇백 건으로는 인덱스가 있든 없든 결과가 같다. 최소 1,000만 건은 넣고, `innodb_buffer_pool_size`를 256MB 정도로 줄여서 데이터가 메모리에 다 올라가지 않게 해야 차이가 보인다.

---

## 앱 후보

하나를 고르기보다는 **1번을 코어로 두고 2~7번 중 1~2개를 붙인다.**

| # | 앱/모듈 | 핵심 기능 | 이걸로 파고드는 DB 주제 |
|---|---|---|---|
| 1 | **식단 기록 코어** (필수) | 끼니별 음식 기록, 하루 합계 | 정규화와 비정규화 판단, 기록 시점 영양정보 스냅샷, 복합 인덱스 순서, timezone과 `local_date` |
| 2 | **음식 검색·자동완성** | 음식 이름 검색, "최근 자주 먹은 음식" 추천 | `LIKE 'x%'`와 `'%x%'`의 차이, 한글 FULLTEXT(ngram), 커버링 인덱스, GROUP BY 기반 top-N |
| 3 | **주간·월간 통계 대시보드** | 30일 칼로리 추이, 탄단지 평균 | 실시간 집계와 집계 테이블(`daily_summaries`) 비교, 갱신 전략별 정합성 비교, sargable 조건(`DATE(col)` 함정) |
| 4 | **소셜 피드** | 팔로우한 사람의 식단 피드 | OFFSET과 keyset 페이지네이션 비교, fan-out on read와 on write 비교, `(created_at, id)` 인덱스 |
| 5 | **연속 기록·챌린지 랭킹** | streak, 주간 랭킹 | 윈도우 함수, gaps-and-islands 문제, 동시 갱신 시 락과 lost update |
| 6 | **기록 리마인더 알림** | "오늘 점심 기록 안 한 사용자"에게 알림 | anti-join(`NOT EXISTS`와 `LEFT JOIN IS NULL` 비교), 사용자별 timezone 배치, `SKIP LOCKED` 작업 큐, outbox |
| 7 | **AI 코칭 컨텍스트** | 최근 7일 기록 요약을 LLM에 전달 | 요약 쿼리 최적화, 캐시 무효화 시점 |

**추천 조합은 1 + 3 + 6이다.**
- **3번(통계):** "쿼리·인덱스·캐시 개선"과 정합성 주제를 가장 깊게 다룬다.
- **6번(리마인더):** JD의 "알림이 제때 닿는"과 우대사항 "예약 작업·메시지 큐"에 바로 연결된다.
- 시간이 남으면 4번을 붙인다. 페이지네이션은 면접 단골 질문이다.

---

## 커리큘럼 (7일)

### Day 1: 요구사항을 ERD로 옮기기, 정규화
- **먼저 할 일:** 조회 쿼리 목록(워크로드)을 적는다. 인덱스는 쿼리가 정해진 뒤에 설계한다.
  - Q1: 특정 날짜의 식단과 합계 (가장 자주 불리는 쿼리)
  - Q2: 최근 30일 일별 칼로리 추이
  - Q3: 자주 먹은 음식 top 10
  - Q4: 오늘 기록하지 않은 사용자
- **공부할 것:** 1NF~3NF, BCNF, 함수 종속, 정규화를 일부러 깨는 기준
- **`DECISIONS.md`에 남길 설계 논점**
  - **영양소 저장 방식:** 컬럼형(`kcal`, `carb` 등)으로 둘지, 행형(`food_nutrients(food_id, nutrient_id, amount)`)으로 둘지
  - **기록 시점 스냅샷:** `meal_items`가 `foods`를 참조만 할지, 기록 시점의 칼로리를 복사해 둘지. 음식 DB가 수정됐을 때 과거 기록이 바뀌어도 되는지가 기준이다.
  - **날짜 기준:** `eaten_at`(UTC)만 저장할지, `local_date`를 따로 둘지. 사용자가 timezone을 바꾸면 어떻게 되는지도 따져 본다. 글로벌 확장 중인 회사라서, 위밋모빌리티의 timezone 경험과 연결할 수 있다.
  - **`user_id` 중복 저장:** `meal_items`에 `user_id`를 한 번 더 둘지
  - **음식 데이터 테이블 구성:** 사용자가 직접 만든 음식과 공공 음식 DB를 한 테이블에 둘지, 나눌지

### Day 2: 스키마 구현, 대량 데이터 생성, InnoDB 구조
- **데이터 규모:** 사용자 10만 명, 식사 기록 약 1,000만 건. 헤비 유저 10%처럼 분포를 한쪽으로 치우치게 만든다.
- **넣는 방법:** CSV로 만든 뒤 `LOAD DATA`로 넣거나, multi-row INSERT를 쓰고 두 방법의 속도를 비교한다.
- **공부할 것:** 클러스터드 인덱스, 세컨더리 인덱스가 PK를 품는 구조, 페이지와 B+Tree
- **실험:** PK를 AUTO_INCREMENT, UUIDv4, UUIDv7로 바꿔 가며 INSERT 속도와 인덱스 크기를 측정한다.

### Day 3: 인덱스 설계와 실행 계획 읽기
- **실행 계획 읽기:** `EXPLAIN`과 `EXPLAIN ANALYZE`에서 `type`, `key`, `rows`, `filtered`, `Extra`를 읽는 법을 익힌다. `Extra`에서는 Using filesort, Using temporary, Using index를 구분한다.
- **Q1~Q3에 적용할 인덱스 원칙**
  - 동등 조건 컬럼을 앞에, 범위 조건 컬럼을 뒤에 둔다.
  - ORDER BY까지 인덱스로 해결한다.
  - 커버링 인덱스를 쓴다.
- **실험:** `(user_id, local_date)`와 `(local_date, user_id)`의 순서를 바꿔 보고, 카디널리티가 낮은 컬럼(`meal_type`)에 인덱스를 걸면 어떻게 되는지 확인한다.
- **기록:** 모든 실험을 "인덱스 없음 → 인덱스 A → 인덱스 B" 순서로 `BENCHMARK.md`에 남긴다.

### Day 4: 쿼리 최적화
- **sargable 조건:** `WHERE DATE(eaten_at) = ?`를 범위 조건으로 바꾼다.
- **페이지네이션:** OFFSET 100000과 keyset 방식을 비교한다.
- **N+1 재현:** 일부러 ORM으로 N+1을 만들고, JOIN이나 IN 한 번으로 고친 뒤 비교한다.
- **쿼리 형태 비교:** 서브쿼리, JOIN, EXISTS를 비교하고, `COUNT(*)`가 비싼 이유를 확인한다.
- **도구:** slow query log와 `performance_schema`로 가장 느린 쿼리를 찾는다.
- **부하 측정:** k6나 autocannon으로 API의 p95 개선 전후를 측정한다. "대기 시간 단축" 사례의 근거가 된다.

### Day 5: 집계 테이블, 정합성, 동시성 (3번 모듈)
- **비교:** `daily_summaries`를 도입하기 전과 후의 조회 속도와 쓰기 비용
- **갱신 전략:** 애플리케이션 트랜잭션, 트리거, 배치 재계산을 장단점과 함께 비교한다.
- **lost update 재현:** SELECT 후 UPDATE하는 방식에서 동시 요청으로 값이 사라지는 걸 확인하고, `SET kcal = kcal + ?`나 `INSERT ... ON DUPLICATE KEY UPDATE`로 고친다.
- **락:** 격리 수준, gap lock, 데드락을 직접 재현하고 `SHOW ENGINE INNODB STATUS`로 읽는다.

### Day 6: 인덱스의 비용과 운영 (6번 모듈)
- **쓰기 비용 측정:** 인덱스를 0개, 3개, 6개 뒀을 때 INSERT 처리량을 비교한다. "인덱스 많으면 뭐가 안 좋아요?"에 수치로 답할 수 있다.
- **온라인 DDL:** 1,000만 건 테이블에 인덱스를 추가할 때 `ALGORITHM=INPLACE, LOCK=NONE`이 어떻게 동작하는지 확인하고, invisible index로 안전하게 인덱스를 제거하는 절차를 연습한다.
- **리마인더 대상 조회:** anti-join 방식을 비교하고, `SKIP LOCKED` 기반 발송 큐를 만든다.

### Day 7: 정리
- **README:** ERD, 워크로드, 설계 결정과 이유, 벤치마크 표를 담는다.
- **면접 질문에 답을 적어 보기**
  - 복합 인덱스 순서를 왜 이렇게 정했나요?
  - 옵티마이저가 인덱스를 타지 않는 경우는 언제인가요?
  - 비정규화는 언제 하나요? 하고 나서 정합성은 어떻게 지키나요?
  - 음식 영양정보가 수정되면 과거 기록은 어떻게 되나요?
  - OFFSET 페이지네이션은 왜 느려지나요?
- **이력서:** Side Projects에 수치를 담은 한 줄을 추가한다.

### 3일로 압축할 경우

| 일자 | 내용 |
|---|---|
| Day 1 | Day 1 + Day 2 (ERD와 대량 데이터) |
| Day 2 | Day 3 + Day 4 (인덱스와 쿼리 최적화, 측정) |
| Day 3 | Day 5의 lost update 부분과 README 정리 |

---

## 체크리스트

### Day 1: 요구사항을 ERD로 옮기기, 정규화
- [ ] 워크로드 Q1~Q4를 쿼리 형태로 적기
- [ ] 1NF~3NF, BCNF, 함수 종속 정리
- [ ] ERD 초안 그리기
- [ ] `DECISIONS.md` 만들고 설계 논점 5개에 대안과 선택 이유 적기
  - [ ] 영양소 저장 방식 (컬럼형과 행형)
  - [ ] 기록 시점 스냅샷
  - [ ] 날짜 기준 (`eaten_at`, `local_date`, timezone 변경)
  - [ ] `meal_items`의 `user_id` 중복 저장
  - [ ] 사용자 음식과 공공 음식 DB의 테이블 구성

### Day 2: 스키마 구현, 대량 데이터 생성, InnoDB 구조
- [ ] Docker로 MySQL 8 띄우고 `innodb_buffer_pool_size`를 256MB로 설정
- [ ] Node.js, TypeScript, Kysely(또는 mysql2) 프로젝트 세팅
- [ ] 스키마 DDL 작성하고 적용
- [ ] 사용자 10만 명, 식사 기록 약 1,000만 건 생성 (헤비 유저 10% 분포)
- [ ] `LOAD DATA`와 multi-row INSERT 속도 비교해서 기록
- [ ] 클러스터드 인덱스, 세컨더리 인덱스, 페이지, B+Tree 정리
- [ ] PK를 AUTO_INCREMENT, UUIDv4, UUIDv7로 바꿔 INSERT 속도와 인덱스 크기 측정

### Day 3: 인덱스 설계와 실행 계획 읽기
- [ ] `EXPLAIN`과 `EXPLAIN ANALYZE`의 `type`, `key`, `rows`, `filtered`, `Extra` 읽는 법 정리
- [ ] Q1~Q3 각각 가설 적고 인덱스 설계
- [ ] `(user_id, local_date)`와 `(local_date, user_id)` 순서 비교
- [ ] `meal_type`처럼 카디널리티 낮은 컬럼에 인덱스 걸어 보기
- [ ] ORDER BY를 인덱스로 해결하고 커버링 인덱스 적용
- [ ] `BENCHMARK.md` 만들고 "인덱스 없음 → A → B" 순서로 기록 (cold/warm 구분)

### Day 4: 쿼리 최적화
- [ ] `WHERE DATE(eaten_at) = ?`를 범위 조건으로 바꾸고 비교
- [ ] OFFSET 100000과 keyset 페이지네이션 비교
- [ ] N+1 재현하고 JOIN이나 IN 한 번으로 고친 뒤 비교
- [ ] 서브쿼리, JOIN, EXISTS 비교하고 `COUNT(*)` 비용 확인
- [ ] slow query log와 `performance_schema`로 가장 느린 쿼리 찾기
- [ ] k6나 autocannon으로 API p95 개선 전후 측정

### Day 5: 집계 테이블, 정합성, 동시성
- [ ] `daily_summaries` 도입 전후의 조회 속도와 쓰기 비용 비교
- [ ] 갱신 전략 3가지(애플리케이션 트랜잭션, 트리거, 배치 재계산) 장단점 정리
- [ ] SELECT 후 UPDATE 방식으로 lost update 재현
- [ ] `SET kcal = kcal + ?`나 `INSERT ... ON DUPLICATE KEY UPDATE`로 고치기
- [ ] 격리 수준, gap lock, 데드락 재현하고 `SHOW ENGINE INNODB STATUS` 읽기

### Day 6: 인덱스의 비용과 운영
- [ ] 인덱스 0개, 3개, 6개일 때 INSERT 처리량 비교
- [ ] 1,000만 건 테이블에 `ALGORITHM=INPLACE, LOCK=NONE`으로 인덱스 추가해 보기
- [ ] invisible index로 인덱스 안전하게 제거하는 절차 연습
- [ ] 리마인더 대상 조회를 `NOT EXISTS`와 `LEFT JOIN IS NULL`로 비교
- [ ] `SKIP LOCKED` 기반 발송 큐 만들기

### Day 7: 정리
- [ ] README에 ERD, 워크로드, 설계 결정과 이유, 벤치마크 표 담기
- [ ] 면접 질문 5개에 답 적기
  - [ ] 복합 인덱스 순서를 왜 이렇게 정했나요?
  - [ ] 옵티마이저가 인덱스를 타지 않는 경우는 언제인가요?
  - [ ] 비정규화는 언제 하나요? 하고 나서 정합성은 어떻게 지키나요?
  - [ ] 음식 영양정보가 수정되면 과거 기록은 어떻게 되나요?
  - [ ] OFFSET 페이지네이션은 왜 느려지나요?
- [ ] 이력서 Side Projects에 수치를 담은 한 줄 추가

---

## 진행 중 지킬 원칙

- **측정 전에 가설부터 적기:** "이 인덱스를 걸면 rows가 이만큼 줄 것이다"를 먼저 쓰고, 틀리면 틀린 이유를 기록한다. 면접에서 가장 좋은 이야깃거리가 된다.
- **같은 조건에서 두 번 측정하기:** 캐시가 빈 상태(cold)와 찬 상태(warm)를 구분해서 잰다.
- **AI로 생성한 쿼리도 EXPLAIN으로 직접 검증하기:** JD의 "제안된 코드를 이해·검증"과 자소서 내용에 맞는 태도다.
- **온라인 과제가 오면 과제가 먼저다:** 이 커리큘럼은 과제와 스택과 형태가 같아서, 중간에 멈추더라도 과제 준비로 이어진다.
