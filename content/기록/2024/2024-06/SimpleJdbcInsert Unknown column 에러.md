---
title: SimpleJdbcInsert Unknown column 에러
draft: false
tags:
  - Java
  - Spring
date: 2024-06-09
---
# 문제 상황
``` Java
@Override  
public User save(User user) {  
    if (user.isNew()) {  
        SimpleJdbcInsert simpleJdbcInsert = new SimpleJdbcInsert(jdbcTemplate.getJdbcTemplate())  
                .withTableName("User")  
                .usingGeneratedKeyColumns("id");  
  
        Number id = simpleJdbcInsert.executeAndReturnKey(new BeanPropertySqlParameterSource(user));  
        user.updateId((Long) id);  
        return user;  
    }  
    String updateSQL = """  
            UPDATE User  
            SET profile_image = :profile_image,  
                email         = :email,  
                password      = :password,  
                nickname      = :nickname,  
                created_at    = :created_at,  
                updated_at    = :updated_at,  
                deleted_at    = :deleted_at  
            WHERE id = :id  
            """;  
    jdbcTemplate.update(updateSQL, new BeanPropertySqlParameterSource(user));  
    return user;  
}
```
위의 코드를 실행 시켰을 때, 아래의 오류가 발생했다.        

> java.sql.SQLSyntaxErrorException: Unknown column 'file_id' in 'field list'

하지만, 코드 어디에도 `file_id`라는 글자는 찾을 수 없었다. (DB에도, java 코드에도 없다.)         

그래서 오류를 하나씩 거슬러 올라가기로 했다.       
>o.s.jdbc.core.simple.SimpleJdbcInsert    :         
>The following parameters are used for call INSERT INTO User (file_id, email, password, name, birthday, sub_email, phone, role, authorities, student_number, student_year, professor_major_id, employee_number, division, is_expired, status, created_at, modified_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) with:  \[null, org.springframework.jdbc.core.SqlParameterValue@6db75156, org.springframework.jdbc.core.SqlParameterValue@131c8f5e, null, null, null, null, null, null, null, null, null, null, null, null, null, org.springframework.jdbc.core.SqlParameterValue@2c045cfd, null]   

`SimpleJdbcInsert` 에서 Insert 로그를 보내줬는데, 내용이 너무 길다.        
내 테이블은 고작 컬럼이 8개 뿐인데,      

더 위로 올라가니 답이 있었다.       

>o.s.j.c.metadata.TableMetaDataProvider   : Retrieving meta-data for yonsei/root@localhost/user

`yonsei/root@localhost/user`라고 되어 있다.         
내가 사용하고자 하는 DB(`community`)가 아닌 다른 DB(`yonsei`)를 가리키고 있었다.


# 원인
오류는 내 mysql 의 `community/user` 가 아닌, `yonsei/user` 를 가리키고 있어서 발생했다.

SimpleJdbcInsert -> AbstractJdbcInsert
- checkCompile()
	- compileInternal()
		- this.tableMetaDataContext.processMetaData(~,~,~)
		- 여기서 tableMetaDataContext는 TableMetaDataContext.class이다.
			- TableMetaDataFactory.createMetaDataProvider(dataSource, this)
			- 내부 알고리즘에 의해 GenericTableMetaDataProvider로 생성된다.
			- **오류가 있다고 생각하는 부분은 TableMetaDataContext이다.**
			- 이는 몇 가지의 로직을 포함하는 record 성격의 클래스이다.
			- mysql에 나가는 INSERT문 생성 책임을 지고 있다.

우선 코드를 뒤져보니, `TableMetaData`가 잘못 설정되는 것으로 보인다.       
`SimpleJdbcInsert`가 작동할 때, `withCatalog`를 쓰지 않은 것이 잘못이었다.    
(이래서 setter 초기화는 쓰면 안된다.) 

그래서 `SimpleJdbcInsert` 의 기본 catalog 값을 찾으려고 했지만 찾지 못했다.        
기본적으로 MySQL JDBC driver에서 정해주는 거라고 추측할 뿐이다...        
(지정된 table 이름으로 여러개의 테이블이 있으면 먼저 생성된 테이블의 metadata를 가져오는게 아닐까?)      

# 해결
두 개의 해결 방법 중에 1개를 선택했다.
1. `SimpleJdbcInsert`가 아니라 `JDBCClient`를 이용한다.
2. `SimpleJdbcInsert`를 사용할 때, `withCatalog(String name)` 을 사용해서 초기화한다.

setter 초기화는 내 스타일이 아니라서 JDBCClient를 이용했다.