# DECISIONS

## Day1

### 정규화 설명

- 1NF: 모든 컬럼 원자값
- 2NF: 부분 함수 종속 제거 ((X, Y)가 PK일때 X -> Z 제거, Z != Key)
- 3NF: 이행적 함수 종속 제거 ((X->Y->Z)일때 (X,Y), (Y,Z)로 분리. Y, Z != Key)
- BCNF: 모든 결정자가 후보키 - ((X, Y)가 PK일때 Z->X or Y 제거, Z != Key)

### Q1~Q4

Q1 - 특정 날짜 식단 합계

```sql
select sum(carbs), sum(protein), sum(fat), sum(kcal)
from meal_log
where member_id = 1 and date = '2026-09-26'
```

Q2 - 최근 30일 일별 칼로리 추이

```sql
select date, sum(kcal)
from meal_log
where member_id = 1
    and date beetween # 30일 이내
group by date
order by date desc
```

- 날짜별로 그룹핑하고 칼로리 모두 더해야 함

Q3 - 자주 먹은 음식 Top 10

```sql
select ml.name, count(ml.name) as cnt
from meal_log ml
where member_id = 1
left join meal_item mi on mi.item_id = ml.meal_item_id 
group by meal_item_id 
order by cnt desc limit 10
```

Q4 - 오늘 기록하지 않은 사용자 목록

```sql
select member_id, name
from member
where member_id not in (
    select member_id
    from meal_log
    where date = '2026-09-26'
    )
```

