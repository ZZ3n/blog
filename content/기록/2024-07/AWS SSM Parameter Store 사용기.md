---
title: AWS SSM Parameter Store 사용기
draft: false
tags:
  - AWS
  - CodeDeploy
  - SSM
date: 2024-07-03
---

# 문제상황

*Github action -> S3 -> CodeDeploy -> EC2 플로우로 만들던 도중...*

계속된 시도에서 CodeDeploy에서 배포는 잘 되었다고 나오나,   
EC2에서 어플리케이션이 켜지자 마자 자꾸 꺼졌다.

로그를 확인해 보니 `application-dev.yaml`에 선언되어있는 환경변수들이 제대로 적용되고 있지 않았다.   

``` yaml
spring:  
  config:  
    activate:  
      on-profile: dev  
  application:  
    name: community-spring  
  datasource:  
    url: ${DB_URL}  
    username: ${DB_USER}  
    password: ${DB_PASSWORD}  
    driver-class-name: com.mysql.cj.jdbc.Driver  
springdoc:  
  default-produces-media-type: application/json  
storage:  
  # 모든 파일이 저장될 위치 ex. ${directory-path}/${image-path}/img.png
  directory-path: ${STORAGE_PATH}  
  # 실제 파일 위치나, 웹에서 접근할 때 접근 할 폴더 ex. ${directory-path}/${image-path}/img.png, localhost:8080/${url-prefix}/${image-path}/img.png  
  image-path: "/images"  
  # 웹에서 접근할 때 필요한 접두사 ex.localhost:8080/${url-prefix}/images/img.png  
  url-prefix: "/static"  
  # 임시 (배포 후 수정하기!)
  server-name: "http://cdn.dev.community"
```

위와 같이 선언되어 있었지만,
```
[org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean]:
 Factory method 'entityManagerFactory' threw exception with message:
 Driver com.mysql.cj.jdbc.Driver claims to not accept jdbcUrl, ${DB_URL}
```
아래 처럼 `DB_URL` 을 인식하지 못하고 있었다.

하지만 나는 `~/.bash_profile` 을 설정했는데...?
![[스크린샷 2024-07-03 22.58.18.png]]

# 문제점
문제는 CodeDeploy 는 `~/.bash_profile` 의 환경변수를 사용하지 않는다는 점이었다.      
appspec에 작성하는 법, spring property에 작성하는 법 등이 있었지만...

**클라우드의 답은 클라우드**에 있지 않을까?

## 돌파구?

[어떤 블로그](https://blog.zooneon.dev/aws-codedeploy-environment-variables/)에서 해결법을 제시해 주고 있었다. 방법은 간단했다.
1. SSM Parameter Store에 파라미터를 등록한다.
	- 기존에 있던 환경변수를 단순히 등록하면 된다.
2. SpringBoot 에 의존성(외부 라이브러리)를 추가한다.
	- SSM parameter store에서 가져와서 등록해주는 라이브러리인 것 같다.
3. EC2에 SSM을 가져올 수 있게 IAM 정책을 추가한다.
	- AmazonSSMReadOnlyAccess
	- 기존에 CodeDeploy 관련 역할이 있었기에 거기에 추가했다.
4. **완료!**

## 나는 맘에 들지 않아!
하지만 맘에 들지 않았다.   
맘에 들지 않는 포인트는 다음과 같았다.   
1. 환경변수를 추가하기 위해  다른 라이브러리 까지 끌어오고 싶지 않았다.
2. 생각보다 설정 값이 너무 많았다.

난 그저 3개의 환경변수를 가져오고 싶을 뿐인데... 🥲


# 해결법
## 그래서 넌 어떻게 할껀데?
문제는 하나다.
> CodeDeploy의 `ApplicationStart` 시점의 스크립트에서   
> 내가 설정한 환경 변수를 인식 할 수 있는가?   


[이 블로그](https://blog.zooneon.dev/aws-codedeploy-environment-variables/)에서는 런타임에 외부 라이브러리를 이용해서 variable을 설정했고,
나는 그냥 `ApplicationStart` Hook script 에서 해결 할 것이다.

## SSM Parameter Store 값 가져오기
> [!caution] 먼저 해야 할 일
> 1. Parameter Store에 값을 설정한다.
> 2. EC2에 SSM Param Store 값을 가져오기 위해 `AmazonSSMReadOnlyAcccess` 정책을 추가해야 한다.       
> 
> 위 두 과정은 설명하지 않겠다. [이 블로그](https://blog.zooneon.dev/aws-codedeploy-environment-variables/) 에도 잘 설명되어 있다.



AWS CLI를 사용해서 가져오면 된다.
명령어 부터 설명하자면
``` bash
# Parameter Store 에 HelloUser= HELLO 로 등록했다면...
aws ssm get-parameter --name HelloUser --query "Parameter.Value" --output text
# HELLO
```

- `aws ssm get-parameter`
	- SSM Parameter Store 에서 파라미터 값을 가져오는 AWS CLI 명령어  
- `--name HelloUser`
	* HelloUser부분에 Parameter Store 에서 등록한 이름을 작성한다.
- `--query "Parameter.Value"`
	* JSON 으로 되어있기 때문에 Parameter.Value 방식으로 접근한다.
	* 아래는 `--query` 옵션을 쓰지 않은 실행 예시이다. 
``` json
{
    "Parameter": {
        "Name": "HelloUser",
        "Type": "String",
        "Value": "HELLO",
        "Version": 1,
        "LastModifiedDate": "2024-07-03T12:31:03.780000+00:00",
        "ARN": "ARN이 있을 자리!",
        "DataType": "text"
    }
}
``` 
- `--output text`
	- output text 로 하지 않으면 따옴표(")에 감싸져서 나온다.
	- 이것 때매 40분 날렸다....

이 명령어를 ApplicationStart Hook script에 넣고 변수로 등록해주면 된다.

``` shell
# 위는 생략...
DB_URL=$(aws ssm get-parameter --name DB_URL --query "Parameter.Value" --output text)  
DB_USER=$(aws ssm get-parameter --name DB_USER --query "Parameter.Value" --output text)  
DB_PASSWORD=$(aws ssm get-parameter --name DB_PASSWORD --query "Parameter.Value" --output text)  

# 잘 나오는지 테스트
echo "[$NOW] DB 정보 : $DB_URL $DB_PASSWORD $DB_USER" >> $START_LOG  
  
echo "[$NOW] $SERVER_JAR 복사" >> $START_LOG  
cp $UPLOADED_JAR $SERVER_JAR  
  
echo "[$NOW] > $SERVER_JAR 실행" >> $START_LOG  
nohup java -jar -Dspring.profiles.active=dev \  
  -DDB_URL=$DB_URL -DDB_PASSWORD=$DB_PASSWORD -DDB_USER=$DB_USER \  
  $SERVER_JAR > $APP_LOG 2> $ERROR_LOG &
# ...아래는 생략
```

실행할 때 `-Dxxxx`로 추가해 준다.


# 아쉬운 점
추가해줬는데 왜 직접 `-Dxxxx`로 추가해줘야 하는지 모르겠다...