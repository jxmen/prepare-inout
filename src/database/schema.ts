import { Kysely, sql } from 'kysely';
import type { DB } from './types.js';

// docs/ERD.md의 DDL과 동일하게 유지한다.
// IF NOT EXISTS라서 테이블이 이미 있으면 구조가 달라도 건너뛴다. 변경은 직접 ALTER 한다.
const DDL = [
  `CREATE TABLE IF NOT EXISTS member (
    id         VARCHAR(36)  NOT NULL,
    name       VARCHAR(255) NOT NULL,
    timezone   VARCHAR(64)  NOT NULL COMMENT 'IANA timezone (예: Asia/Seoul)',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME     NULL,
    PRIMARY KEY (id)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4`,

  `CREATE TABLE IF NOT EXISTS food (
    id          VARCHAR(36)  NOT NULL,
    name        VARCHAR(255) NOT NULL,
    carbs       FLOAT        NOT NULL,
    base_weight FLOAT        NOT NULL DEFAULT 100.0 COMMENT '기본 중량. 이 값에 따라 영양 정보도 달라진다.',
    protein     FLOAT        NOT NULL,
    fat         FLOAT        NOT NULL,
    kcal        FLOAT        NOT NULL COMMENT '탄단지 4/4/9로 계산하지 않고 별도로 받는다.',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4`,

  `CREATE TABLE IF NOT EXISTS meal_log (
    id         VARCHAR(36) NOT NULL,
    member_id  VARCHAR(36) NOT NULL,
    type       ENUM ('breakfast', 'lunch', 'dinner', 'snack') NOT NULL,
    date       DATE        NOT NULL COMMENT '식사 날짜 (예: 2026-09-27). member.timezone 기준으로 계산해 저장한다.',
    created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4`,

  `CREATE TABLE IF NOT EXISTS meal_items (
    id          VARCHAR(36) NOT NULL,
    meal_log_id VARCHAR(36) NOT NULL,
    food_id     VARCHAR(36) NOT NULL,
    food_weight FLOAT       NOT NULL COMMENT '음식 중량 g단위. 따로 입력하지 않을 시, food에 있는 값을 복사한다.',
    carbs       FLOAT       NOT NULL,
    protein     FLOAT       NOT NULL,
    fat         FLOAT       NOT NULL,
    kcal        FLOAT       NOT NULL,
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_meal_items_meal_log_food (meal_log_id, food_id)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4`,
];

export async function createTablesIfNotExist(db: Kysely<DB>) {
  for (const ddl of DDL) {
    await sql.raw(ddl).execute(db);
  }
}
