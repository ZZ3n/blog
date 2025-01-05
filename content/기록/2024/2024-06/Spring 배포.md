---
title: 배포! Github action + AWS Codedeploy
draft: true
tags: 
date: 2024-06-23
---
# 1. EC2 세팅
```bash
sudo yum update
sudo yum install -y java-17-amazon-corretto-headless
sudo yum install -y ruby
sudo yum install -y wget
cd /home/ec2-user
wget https://aws-codedeploy-ap-northeast-2.s3.ap-northeast-2.amazonaws.com/latest/install
chmod +x ./install
sudo ./install auto
systemctl status codedeploy-agent

```

# 2. IAM 설정
### EC2 에 부착
- AmazonEC2RoleforAWSCodeDeploy
### IAM User For Github Action
- AmazonS3FullAccess
- AWSCodeDeployFullAccess
