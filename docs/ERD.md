# ERD

- 사용자가 food를 생성하거나, 다른 사용자가 만든 걸 중량을 추가해 사용할 수 있다.
- pk 값은 id를 쓰며, UUID 값으로 사용한다.
- created_at, updated_at은 모든 테이블에 기본적으로 적용한다. 여기서는 따로 명시하지 않는다.
- [ ] 사용자 timezone 어떻게 처리할지 고민 필요
- [ ] 한 끼니에 같은 음식 2번 혀용할 것인가? (아침에 닭가슴살 100g, 닭가슴살 50g)


### member

사용자 정보, timezone 세팅 등.

- id(string)
- name(string)
- timezone
- deleted(boolean)

### food

음식 정보. (예: 닭가슴살), 탄단지/칼로리 포함

- id(string)
- name(string)
- carbs(float)
- base_weight(float=100.0)
  - 기본 중량. 이 값에 따라 영양 정보도 달라진다.
- protein(float)
- fat(float)
- kcal(float)
  - 탄단지 4/4/9로 계산하지 않고 별도로 받는다.

### meal_log

- id(string)
- member_id(string)
- type(enum=breakfast,lunch,dinner,snack)
- date?
  - 특정 날짜 (2026-09-27).
  - timezone 어떻게 할건지 정책 필요

### meal_items

meal_log와 food를 N:M 관계로 잇는 연결 테이블이자, 중량, 탄단지/칼로리 스냅샷

- id(string)
- meal_log_id(string)
- food_id
- food_weight(float)
  - 음식 중량 g단위
  - 따로 입력하지 않을 시, food에 있는 값을 복사한다.
- carbs
- protein
- fat
- kcal