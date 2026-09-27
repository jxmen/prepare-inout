# DECISIONS

## Day1

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

