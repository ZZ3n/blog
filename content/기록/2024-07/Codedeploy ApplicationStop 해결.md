---
title: Codedeploy applicationStop 해결하기
draft: false
tags:
  - AWS
  - CodeDeploy
date: 2024-07-03
---
# 문제 상황
Github-action 과 AWS CodeDeploy 를 이용해서       
Spring application 을 EC2 에 배포하는 과정 중        
       
배포 후 서버를 키는 start 스크립트는 성공했으나,        
다음 회차의 배포에서 실패했다.
![[Pasted image 20240703185522.png]]
이유를 알아보니...

# 문제
ApplicationStop 단계에서 실패했다고 한다.   
CodeDeploy 의 배포 라이프사이클은 다음과 같다.   

> [!caution] 조금씩 다르다!
> 블루/그린인지, AutoScaling을 하고 있는지에 따라서 조금씩 다르다.    
> 내 경우에는 LB를 쓰지 않는, in-place 배포 상황이다.     
> 자세한 사항은 [여기](https://docs.aws.amazon.com/ko_kr/codedeploy/latest/userguide/reference-appspec-file-structure-hooks.html)를 참조하자      

![[Pasted image 20240703185740.png]]

문제가 된 부분은 ApplicationStop 부분이다.
## ApplicationStop?
공식 문서에 따르면 ApplicatioStop 수명 주기 이벤트는...
> 
> 애플리케이션을 안전하게 종료하거나 배포 준비 중에 현재 설치된 패키지를 제거하도록 스크립트를 지정할 수 있습니다.      
> 
> 이 배포 수명 주기 이벤트에 사용된 AppSpec 파일 및 스크립트는       
> 이전에 성공적으로 배포된 애플리케이션 수정 버전에서 가져온 것입니다.
> 
> **배포하기 전에는 인스턴스에 AppSpec 파일이 존재하지 않습니다.**     
> 
> 이러한 이유로, 인스턴스에 처음으로 배포할 때는 `ApplicationStop` 후크가 실행되지 않습니다.       
> **인스턴스에 두 번째로 배포할 때는 `ApplicationStop` 후크를 사용할 수 있습니다.** 

1. 이전에 실행했던 애플리케이션의 종속성을 제거하거나, 애플리케이션을 안전하게 종료한다.
2. 첫번째 배포에서는 실행되지 않는다.
	- 첫번째 실행에는 당연히 *"이전에 실행했던 애플리케이션"* 이 없기 때문이다.
	- 두번째 실행에서는 이전에 성공적으로 배포됬었던 스크립트, 어플리케이션을 이용한다.

## 그래서 내 문제는?
첫번째 배포 성공할 때, 사실 성공하지 못했다.   
CodeDeploy 상으로는 성공이 찍혔지만, Application(SpringBoot 서버)가 DB 설정 문제로 종료되었기 때문이다.

그래서 EC2에 올라온 파일들을 전부 삭제했는데 그것이 원인이 되었다.


# 해결법
위에서 첨부한 링크인 [여기](https://docs.aws.amazon.com/ko_kr/codedeploy/latest/userguide/reference-appspec-file-structure-hooks.html)에 써 있다.
> 마지막으로 성공적으로 배포된 애플리케이션 수정 버전의 위치를 확인하기 위해 CodeDeploy 에이전트는   
>  `deployment-group-id_last_successful_install` 파일에 나열된 위치를 조회합니다.    
>
>  이 파일의 위치는 다음과 같습니다.   
>     
> Amazon Linux, Ubuntu Server 및 RHEL Amazon EC2의    
> `/opt/codedeploy-agent/deployment-root/deployment-instructions` 폴더
>
> `ApplicationStop` 배포 수명 주기 이벤트 중 실패하는 배포 문제를 해결하려면    
> [실패 ApplicationStop 또는 배포 수명 주기 이벤트 문제 해결 BeforeBlockTraffic AfterBlockTraffic](https://docs.aws.amazon.com/ko_kr/codedeploy/latest/userguide/troubleshooting-deployments.html#troubleshooting-deployments-lifecycle-event-failures)    
> 단원을 참조하세요.

역시 AWS 는 나름 친절하다.   
바로 링크를 타고 들어가 보면...

> [!info] ApplicationStop 무시하기
> 실패한 마지막 배포에서 성공적으로 실행되지 않은 스크립트가 실패의 원인인 경우 배포를 만들고, ApplicationStop BeforeBlockTraffic, AfterBlockTraffic 실패를 무시하도록 지정하십시오. 이렇게 하는 방법은 두 가지입니다.
>
>
 > - CodeDeploy 콘솔을 사용하여 배포를 생성합니다.    
 >   **배포 생성** 페이지의 **ApplicationStop 수명 주기 이벤트 실패에서**    
 >   인스턴스의 수명 **주기 이벤트가 실패할 경우 인스턴스에 대한 배포에 실패하지 않음을** 선택합니다.
> - AWS CLI 를 사용하여 **[create-deployment](https://docs.aws.amazon.com/cli/latest/reference/deploy/create-deployment.html)** 명령을 호출하고    
>   `--ignore-application-stop-failures` 옵션을 포함하십시오.     
>   
> 그러면 애플리케이션 수정을 다시 배포하는 경우 이러한 3가지 수명 주기 이벤트 중 하나가 실패하더라도   
> 배포는 계속 진행됩니다. 새 수정에 이러한 수명 주기 이벤트에 대한 수정된 스크립트가 포함되어 있으면    
> 이러한 수정 사항을 적용하지 않아도 향후 배포에 성공할 수 있습니다.

콘솔을 이용하는 방법, CLI를 이용하는 방법 두 가지를 제시해 준다.

콘솔을 이용해서 해결 해 보자.

## 콘솔을 이용해서 해결하기
### 배포 복사
CodeDeploy 에서 마지막 실패한 배포로 들어가서,
![[Pasted image 20240703192555.png]]
우측상단에 있는 **배포 복사**를 클릭한다.

### 추가 배포 동작 설정
복사한 배포로 배포를 생성하는 화면에서     
**추가 배포 동작 설정 - 인스턴스에서 이 수명 주기 이벤트가 실패하는 경우 해당 인스턴스에 대한 배포에 실패 안 함**   
선택한다.   
![[Pasted image 20240703192646.png]]

배포를 생성하면 바로 새 배포가 진행된다.

# 결론
ApplicationStop으로 인한 CodeDeploy 문제는 해결했다.
![[Pasted image 20240703193128.png]]

**하지만!** EC2에서 어플리케이션이 실패했다... 😂

**그러나!** 간단한 DB URL 설정 문제였다! 
(db 주소만 쓰고 앞에 `jdbc:mysql://`를 안 붙였다... 🫠)

**해결!**