---
title: Spring Profiles
draft: false
tags: 
date: 2024-06-21
---
# 배포 환경

### Local
각자 개발자 PC마다 설치된 서버 환경을 뜻한다.

### Develop
- 여기서부터 여러명이 접속할 수 있다.
- dev 환경에서는 형상 관리 시스템의 코드를 배포하여, 간단히 기능 위주의 검증을 진행한다.
- 보통 작은 단위로 구축한다.

### Staging
- 운영환경과 거의 동일환 환경을 만들어 둔다.
- Production으로 이전하기 전에, 여러가지 비 기능적인 부분을 검증한다.

### Production
- 실제 서비스를 위한 운영환경.

# 스프링 프로필

spring profile 을 통해서 여러가지 환경을 구분하고,

특정 환경에서만 작동하는 bean, 특정 환경에서만 적용되는 설정 등을 만들수 있다.

## 기본 사용법

```yaml
spring:
	profiles:
    default: local
```
**로컬 환경**

```yaml
# application-local.yaml
spring:
  config:
    activate:
      on-profile: dev
  application:
    name: community-spring
  datasource:
    url: jdbc:mysql://localhost:3306/community
    username: ${DB_USER}
    password: ${DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver
  data:
    redis:
      host: localhost
      port: 6379
```
**Dev 환경**

```yaml
# application-dev.yaml
spring:
  config:
    activate:
      on-profile: dev
  application:
    name: community-spring
  datasource:
    url: jdbc:mysql://commiunty-dev-rds.xxxxxxx.amazonaws.com
    username: ${DB_USER}
    password: ${DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver
  data:
	  redis:
		  host: community-dev-cache.xxxxxxxx.amazonaws.com
		  port: 6379
```

- 로컬에서는 개발자의 PC를 혼자 사용하기 때문에, localhost를 사용했다.
- Dev에서는 DEV 서버 환경에서 사용하는 redis 주소, db 주소가 사용되었다.
- **🙋‍♂️** DB_USER, DB_PASSWORD는 왜 바뀌지 않았나요?
	- `${DB_USER}`는 호스트(컴퓨터,서버)의 환경 변수, 또는 다른 profile의 값을 가져오는 것이다.
	- 즉 환경 변수 중 DB_USER, 다른 프로필 속 선언된 DB_USER의 값을 사용한다.	

		|no|Priority|Property|   
		|---|---|---|
		|1|High|devtools 활성 상태일 때 $HOME/.config/spring-boot 디렉토리 내 devtools 전역 설정|
		|2||@TestPropertySource|
		|3||@SpringBootTest와 함께 사용된 properties|
		|4||Command Line Arguments|
		|5||SPRING_APPLICATION_JSON(환경 변수 또는 시스템 변수에 포함된 인라인 JSON)|
		|6||ServletConfig 초기화를 위한 매개변수|
		|7||ServletContext 초기화를 위한 매개변수|
		|8||JNDI attributes(java:comp/env)|
		|9||자바 시스템 변수(System.getProperties())|
		|10||OS 환경 변수|
		|11||application.properties 파일|
		|12||@Configuration 클래스|
		|13|Low|기본 속성(SpringApplication.setDefaultProperties)|

```yaml
# application.yaml
spring:
  config:
    activate:
      on-profile: dev
...
---
spring:
  config:
    activate:
      on-profile: dev
...
```

위처럼 같은 파일에 운용할 수도 있다.


# 좀 더 나아가서…

### 그룹화

```yaml
spring:
  profiles:
    active: local # local profile로 설정
    group:
      local: # local = common + local
        - common
      prod: # prod = common + prod
        - common  
---
spring:
  config:
    activate:
      on-profile: common   # application-common.yml 과 동일한 역할
---
spring:
  config:
    activate:
      on-profile: local
---
spring:
  config:
    activate:
      on-profile: prod
```

`spring.profiles.group` 를 이용해서 몇 가지의 profile을 묶어서 사용할 수 있다.

### 중요한 점!

```yaml
spring:
	profiles:
    active: local # local profile로 설정
    group:
      local: # local = common + local
        - common
      prod: # prod = common + prod
        - common  
---
spring:
  config:
    activate:
      on-profile: common   # application-common.yml 과 동일한 역할
my:
	name: zz3n # 이 property는 무효화된다.
---
spring:
  config:
    activate:
      on-profile: local
my:
	name: chen # 이 property가 사용된다.
```
같이 적용될 경우에 아래의 정보가 위의 정보를 덮어쓴다!
(항상 덮어쓰기가 된다. 앞 < 뒤, 위 < 아래 )

# **🙋‍♂️ 그래서 배포할 때 어떻게 해야되는 거죠?**
라고 질문할 수 있다.
1. 공통적인 property와, 다른 property를 묶어서 운영환경별로 application-xxx.yaml을 만든다.
2. 분리한 이후 민감정보를 VCS에 올라가지 않도록 처리한다.
    - application-prod.yaml 같은 존재 자체가 불안한 yaml 녀석들은 VCS 외적으로 관리한다.
    - 특정 환경을 배포할 때,
3. DB 주소, DB user 정보 같은 민감정보들은 환경변수로 제공하거나, 실행시 변수로 제공한다.
	- 모든 클라우드 서버는 초기 값을 설정할 수 있는 방법들이 있다. (예시 > aws ec2 - user data)


### **🙋‍♂️** 실행 시 변수는 어떻게 넘기는거죠?
```bash
./gradlew clean build -Dorg.gradle.jvmargs="-Xmx4g -ea"
```

위처럼 -D 옵션을 이용해서 변수를 넘기면, 사용할 수 있다.
예를 들어, 위의 yaml 속의 `${DB_USER}`를 아래와 같이 넘길 수 있다.

```bash
./gradlew bootRun -DDB_USER=root
```

아니면 IDE에서 제공하는 것을 사용해도 좋다. (원리는 같다!)

# Spring dotenv

[GitHub - paulschwarz/spring-dotenv: Provides a Dotenv property source for Spring](https://github.com/paulschwarz/spring-dotenv)

Spring dotenv를 사용하면

환경변수에 앞서서 property를 선언할 수 있다.

`.env` 파일에 선언하여, `${DB_USER}` 같은 값을 채울 수 있다.