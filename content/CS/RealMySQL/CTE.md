---
title: CTE
draft: false
tags: 
date: 2025-05-17
---
# **💡 MySQL 8.0 신기능 CTE 알아보기**


MySQL 8.0부터 새롭게 도입된 **CTE(Common Table Expression)**는 복잡한 SQL을 더 명확하고 유연하게 작성할 수 있게 해주는 기능입니다. 
특히 가독성, 재사용성, 재귀 처리에서 강력한 장점을 가지고 있어 현대 SQL 작성에서 중요한 도구로 자리 잡고 있습니다. 

이 글에서는 CTE의 기본 문법부터 동작 원리, 주의사항까지 한눈에 정리해봅니다.

---

## **📌 1. CTE 기본 문법**

  

CTE는 WITH 절을 사용해 임시 결과셋을 정의하고, 이후 쿼리에서 마치 테이블처럼 사용할 수 있습니다.

```
WITH cte_name AS (
    SELECT ...
)
SELECT * FROM cte_name;
```

여러 개의 CTE도 동시에 정의할 수 있습니다:

```
WITH
cte1 AS (SELECT ...),
cte2 AS (SELECT ... FROM cte1)
SELECT * FROM cte2;
```

재귀 CTE는 WITH RECURSIVE로 정의합니다:

```
WITH RECURSIVE cte_name AS (
    -- anchor member
    SELECT ...
    UNION ALL
    -- recursive member
    SELECT ... FROM cte_name WHERE ...
)
SELECT * FROM cte_name;
```

  

---

## ✅ 2. CTE 예제

  

### 🎯 기본 CTE 사용

``` mysql
WITH recent_orders AS (
    SELECT id, customer_id, order_date
    FROM orders
    WHERE order_date >= '2025-01-01'
)
SELECT * FROM recent_orders WHERE customer_id = 101;
```

→ 조건을 분리해 가독성을 높이고, 재사용 가능하게 구성.

  

### 🔁 재귀 CTE 사용

``` mysql
WITH RECURSIVE employee_hierarchy AS (
    SELECT id, name, manager_id, 1 AS level
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    SELECT e.id, e.name, e.manager_id, h.level + 1
    FROM employees e
    JOIN employee_hierarchy h ON e.manager_id = h.id
)
SELECT * FROM employee_hierarchy;
```

→ 계층형 데이터를 재귀적으로 탐색하는 데 매우 유용합니다.

---

## ⚖️ 3. CTE vs SubQuery 비교

|**항목**|**CTE**|**서브쿼리**|
|---|---|---|
|가독성|✅ 높음 (이름 부여 가능)|❌ 중첩될수록 복잡|
|재사용성|✅ 가능 (같은 CTE 여러 번 참조)|❌ 불가|
|재귀 처리|✅ 지원 (RECURSIVE)|❌ 불가능|
|디버깅/유지보수|✅ 쉬움|❌ 어려움|
|성능|상황에 따라 다름|상황에 따라 다름|

예시: 같은 조건을 두 번 쓰는 서브쿼리보다, 한 번 정의한 CTE를 재활용하는 쪽이 더 효율적입니다.

---

## ⚙️ 4. CTE의 기능적 구현 원리

  

MySQL에서 CTE는 내부적으로 **뷰(view)**처럼 처리되며, 두 가지 방식으로 동작합니다.

  

### ✅ 일반 CTE

- 내부적으로 **inline view**로 변환되어 최적화됨
- 예:
``` mysql
WITH cte AS (SELECT * FROM orders WHERE total > 100)
SELECT * FROM cte WHERE status = 'PAID';
```
- → 내부적으로는 아래처럼 실행:
``` mysql
SELECT * FROM (
  SELECT * FROM orders WHERE total > 100
) AS cte WHERE status = 'PAID';
```

### 🔁 재귀 CTE
- **RECURSIVE** 키워드로 정의되며, 루프 기반의 재귀 처리 방식으로 실행됨
- 각 단계 결과를 누적하며 종료 조건을 충족할 때까지 반복
  

### **💡** 

### NOT MATERIALIZED

###  **힌트**
- CTE가 materialized (임시 테이블로 저장)되는 것을 방지
- 쿼리 성능 향상에 도움을 줄 수 있음 (단, 중복 참조 시 주의)

- 사용 예:
``` mysql
WITH cte AS NOT MATERIALIZED (
  SELECT * FROM orders WHERE total > 100
)
SELECT * FROM cte WHERE status = 'PAID';
```

---

## ⚠️ 5. CTE 사용 시 주의사항

1. **MySQL 8.0 이상**에서만 사용 가능
    
2. CTE는 반드시 SELECT, INSERT, UPDATE, DELETE 등의 쿼리 앞에 와야 함
    
3. RECURSIVE CTE는 **종료 조건**이 없으면 무한 루프 발생 가능
    
4. NOT MATERIALIZED는 제한이 있으며, 조건을 만족하지 않으면 무시되거나 오류 발생
    
5. CTE가 너무 복잡하면 오히려 **최적화가 비효율**적일 수 있음
    

---

## 🧠 마무리

CTE는 단순한 문법 설탕 이상의 강력한 기능을 제공합니다. 복잡한 SQL 쿼리를 더 구조적으로 구성하고, 유지보수를 쉽게 만들며, 특히 계층형 데이터 처리에서 재귀 CTE는 대체 불가능한 도구입니다.

다만 모든 상황에서 CTE가 더 나은 것은 아니므로, 쿼리 성능을 고려할 때는 EXPLAIN을 활용하여 실행 계획을 분석하는 것이 좋습니다.


---

# **⚙️ MySQL에서의 Materialized CTE — 기술적 상세 설명**

  

## **🧭 1. Materialization이란?**

  

**Materialization**은 CTE를 쿼리 실행 도중 **한 번 평가한 후 결과를 메모리 또는 임시 테이블에 저장**해두고, 이후 쿼리에서 이를 참조하는 방식입니다.

  

즉, CTE는 **“한 번 실행되고 그 결과를 재사용”**하는 구조로 동작합니다.

---

## **📦 2. Materialized CTE의 내부 처리 흐름**

  

### **✅ 일반 CTE (Materialized)**

```
WITH cte AS (
  SELECT * FROM orders WHERE total > 100
)
SELECT * FROM cte WHERE status = 'PAID';
```

MySQL은 위 쿼리를 실행할 때 다음처럼 동작합니다:

1. cte 내부 쿼리를 먼저 **한 번 실행**
    
2. 그 결과를 **Temporary Table (tmp table)**에 저장
    
3. 이후 SELECT * FROM cte에서는 그 **tmp table을 조회**
    

  

이때 tmp table은 기본적으로 **MEMORY 엔진**을 사용하지만, 크거나 정렬 조건 등이 있는 경우 **InnoDB 임시 테이블로 스왑**됩니다.

---

## **📊 3. 장단점 분석**

  

### **장점**

- CTE 결과를 **여러 번 참조해도 중복 계산 없음**
    
- 복잡한 서브쿼리를 **한 번만 평가**함
    
- 재귀 쿼리에서는 반드시 materialization 필요
    

  

### **단점**

- 임시 테이블 생성으로 인한 **디스크 I/O 비용**
    
- **필요 이상으로 큰 데이터셋을 미리 생성**하는 경우, 전체 쿼리 성능 저하
    
- WHERE, LIMIT 등이 후속 쿼리에 적용되어도 이미 materialized된 결과에는 적용 불가
    

---

## **🧪 4. Materialized vs Not Materialized 성능 비교**

```
WITH cte AS (
  SELECT * FROM large_table WHERE col_x = 'foo'
)
SELECT * FROM cte WHERE col_y = 'bar';
```

- **Materialized**:
    
    - col_x = 'foo' 조건으로 CTE를 평가 → 임시 테이블 저장
        
    - 이후 col_y = 'bar'는 tmp table에 다시 filter
        
    
- **NOT MATERIALIZED**:
    
    - 전체 쿼리를 optimizer가 다시 구성하여 **col_x와 col_y를 한 번에 처리**
        
    - 쿼리 병합 및 최적화 가능성 ↑
        
    

  

→ NOT MATERIALIZED는 경우에 따라 **더 적은 I/O와 더 빠른 실행계획**을 만들 수 있음

---

## **🧰 5. EXPLAIN으로 Materialized 여부 확인하기**

```
EXPLAIN WITH cte AS (...) SELECT * FROM cte;
```

MySQL 8.0에서는 EXPLAIN FORMAT=JSON을 사용하면 더 자세한 정보를 볼 수 있습니다:

```
EXPLAIN FORMAT=JSON
WITH cte AS (
  SELECT * FROM orders WHERE total > 100
)
SELECT * FROM cte;
```

→ 결과 중 "materialized_from_subquery": true 또는 "using_temporary_table": true 여부를 확인할 수 있음

---

## **🧩 6. 강제 제어 힌트: MATERIALIZED / NOT MATERIALIZED**

  

MySQL 8.0.13+부터 CTE에 힌트를 줄 수 있습니다:

```
WITH cte_name AS MATERIALIZED (
  SELECT ...
)
```

```
WITH cte_name AS NOT MATERIALIZED (
  SELECT ...
)
```

### **❗주의**

- MATERIALIZED는 CTE가 여러 번 참조되거나 복잡한 경우 권장
    
- NOT MATERIALIZED는 **다음 조건을 만족해야만 적용**됨:
    
    - 단일 참조 (한 번만 사용)
        
    - 내부 쿼리에 ORDER BY, LIMIT, UNION, GROUP BY 등이 없어야 함
        
    - 재귀 CTE는 불가
        
    
- 조건 미충족 시 NOT MATERIALIZED는 무시됨 (경고 없이 적용 안 됨)
    

---

## **🧠 7. Materialized CTE가 필요한 실제 예시**

  

### **🎯 동일한 CTE를 여러 번 JOIN에 사용**

```
WITH filtered_users AS MATERIALIZED (
  SELECT * FROM users WHERE is_active = 1
)
SELECT u1.id, u2.id
FROM filtered_users u1
JOIN filtered_users u2 ON u1.referrer_id = u2.id;
```

→ filtered_users를 두 번 참조하므로, materialization을 통해 **중복 필터링을 방지**하고 성능 향상

---

## **🚨 8. Materialization이 성능에 미치는 영향 요약**

|**항목**|**영향**|
|---|---|
|결과 캐시|✅ 단일 실행 후 반복 사용 가능|
|디스크 사용|❌ 임시 테이블 생성 (메모리/디스크)|
|조인 최적화|❌ 불리할 수 있음 (옵티마이저 조합 제한됨)|
|실행 순서 제어|✅ 부분 쿼리 강제 평가 가능|

  

---

## **📘 마무리**

  

**CTE의 materialization**은 단순한 최적화 트릭이 아니라, **SQL 실행 계획 전체에 영향을 주는 핵심 메커니즘**입니다. 쿼리 성능 튜닝 시 CTE가 실제로 **언제 materialized되고 언제 inline되는지**를 정확히 이해하면, 불필요한 임시 테이블 생성이나 성능 저하를 방지할 수 있습니다.

  

복잡한 분석 쿼리나 다단계 필터링 쿼리를 작성할 때는 EXPLAIN FORMAT=JSON으로 실행 계획을 꼭 확인하고, 필요 시 MATERIALIZED, NOT MATERIALIZED 힌트를 통해 의도한 실행 흐름을 직접 제어하세요.
