# Purpose
This repository is demonstration on how to realize Device Grant flow ([RFC 8628](https://tools.ietf.org/html/rfc8628)) using Cognito, Lambda, and DynamoDB.

# How does it work?
This new flow is implemented using:
 - AWS Lambda serverless functions to interact with the client application (aka the device) through an additional `/token` endpoint and the end user trough additional `/device` and `/callback` endpoints.
 - Amazon DynamoDB table to persist Authorization requests state and status.
 - Amazon Cognito to deliver the JWT tokens and to support the Authorization Code Grant flow with PKCE for end user authentication.

# How to deploy it?
## CloudFormation template
The implementation requires 3 steps:
1.	Defining the public Fully Qualified Domain Name for AWS ALB public endpoint and obtaining a X.509 associated to it
2.	Deploying the provided AWS CloudFormation Template
3.	Configuring the DNS to point to the AWS ALB public endpoint for the public Fully Qualified Domain Name

### Choosing a DNS name and storing certificate for it in AWS certificate Manager
Your Lambda function endpoints will need to be publicly resolvable when exposed by AWS ALB through a HTTPS/443 Listener. In order to be able to configure the AWS ALB component:
 - Choose a Fully Qualified DNS Name in a DNS zone you own;
 - Generate the associated X.509 certificate and private key:
  - Directly within AWS Certificate Manager;
  - Alternatively, at least, imported them in AWS Certificate Manager.
- Copy the ARN of this certificate in AWS Certificate Manager.
For more information on “How to request a public certificate”, please refer to the [guide for AWS Certificate Manager](https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html).

Once imported in ACM:
1.	From the ACM console: 
![Certificate Manager Console](img/Certificate-Manager-Console.png)
2. Click on the ► icon next to your certificate:
![Locating Certificate](img/ACM-Locating-certificate.png)
3. Copy the associated ARN in a text file:
![Certificate ARN](img/Certificate-ARN.png)

### Deploying the solution using a CloudFormation Template
To configure the workshop you will need to deploy the master workshop template.
> Before you deploy the CloudFormation template feel free to view it [here](CFT/CFT-DeviceGrantFlowDemo-latest.yml)

It is best to deploy in `us-east-1` using Cloud Formation.

During the configuration, you will be asked to:
- Provide a name for the stack
- Provide the ARN of the certificate created/imported in AWS Certificate Manager at the previous step
- Provide a valid email address you own for the Cognito User’s initial password to be sent to you;
- Provide the FQDN you choose and that is associated to the certificate created/imported in AWS Certificate Manager at the previous step
![CloudFormation Parameters](img/CF-Parameters.png)

- Once configured, click on “Next” two times. Finally, on the “Review” page tick the box that authorizes CloudFormation to create IAM resources for the stack:
![CloudFormation acknowledgment](img/CF-ack.png)

- Deploy the stack by clicking on “Create stack”.
- The Deployment of the CloudFormation stack will take several minutes. Wait for the result to be “CREATE_COMPLETE”.
![CloudFormation Complete](img/CF-complete.png)

### Finalizing the configuration
Once everything is set up, you have to finalize the configuration by ensuring the DNS name for the zone your own is pointing to the ALB DNS by creating an appropriate CNAME entry in your DNS system of choice.

1. From the CloudFormation console:

![CF-console](img/CF-console.png)
2. Locate your stack and click on it:

![CF-Stack](img/CF-Stack.png)
3. Click on the Outputs tab:

![CF-Out](img/CF-Out.png)
4. Copy the value for the Key ALBCNAMEForDNSConfiguration:

![CF-Out-DNS](img/CF-Out-DNS.png)
5. Configure a CNAME DNS entry into your DNS Hosted zone based on this value:

> For more information on how to create a CNAME entry to AWS ALB in DNS a DNS zone, please refer to the [guide for Amazon Route 53](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html).

6. Please note the other values in the Output tab, they will serve you for the next section:

|  |  |
| ---- | ---- |
| DeviceCognitoClientClientID | App Client ID to be use by the simulated Device to interact with the authorization server |
| DeviceCognitoClientClientSecret | App Client Secret to be use by simulated Device to interact with the authorization server |
| TestEndPointForDevice | HTTPS Endpoint for the simulated DEVICE to make their requests |
| TestEndPointForUser | HTTPS Endpoint for the USER to make their requests |
| UserPassword | Password for the Test Cognito User |
| UserUserName | Username for the Test Cognito User |

## Manual Deployment
 - Create a DynamoDB table where:
   - The key of the schema will be the device code
   - One global secondary index will index the user code
   - One global secondary index will index the state of the OAuth2 Authorization Code grant flow request/response
 - Create a new Cognito User Pool
   - Create an Authentication Domain
 - Create a new Lambda function (NodeJS based, tested with nodejs10.x)
   - Deploy the files in this repository
 - Associate an IAM Execution role that allows:
   - Basic Lambda Execution permissions
   - Access to the DynamoDB table for Read, Update, and Delete operations
   - Access to the Cognito User Pool as Power User
 - Create thirteen environment variable:
   - `CODE_EXPIRATION` that represents the lifetime in seconds of the codes generated
   - `CODE_VERIFICATION_URI` that references the URI where the end user should authorize or deny the authorization request using the user code
   - `CUP_DOMAIN` that references the Cognito User Pool prefixed domain name
   - `CUP_ID` that references the Cognito User Pool ID
   - `CUP_REGION` that references the Cognito User Pool region
   - `DEVICE_CODE_FORMAT` that represents the format for the device code (for example: `#aA` where `#` represents numbers, `a` lowercase letters, `A` uppercase letters, and `!` special characters)
   - `DEVICE_CODE_LENGTH` that represents the device code length
   - `DYNAMODB_AUTHZ_STATE_INDEX` that references the name of the global secondary index will index the state of the OAuth2 Authorization Code grant flow request/response in the DynamoDB table
   - `DYNAMODB_TABLE` that references the DynamoDB table
   - `DYNAMODB_USERCODE_INDEX` that references the name of the global secondary index will index the user code in the DynamoDB table
   - `POLLING_INTERVAL` that represents the minimum time in seconds between two polling from the client application
   - `USER_CODE_FORMAT` that represents the format for the user code (for example: `#aA` where `#` represents numbers, `a` lowercase letters, `b` lowercase letters without vowels,`A` uppercase letters, `B` uppercase letters without vowels, and `!` special characters)
   - `USER_CODE_LENGTH` that represents the user code length
   - `RESULT_TOKEN_SET` that represents the structure of the Token Set to be returned to the Device. String can only include `ID`,`ACCESS`, and `REFRESH` values separated with `+`
 - Create one ALB instance
 - Create or import in ACM one certificate and its private key that can be used to protect the HTTPS listener of the ALB instance
   - Configure your DNS to ensure a proper routing to the DNS name that is part of the certificate to the ALB instance
   - This DNS name should be in line with what configured in the Lambda function's `CODE_VERIFICATION_URI` environment variable
 - Create two client app credetials in Cognito User Pool with Secret:
   - One for an ALB instance with a callback URL as described in [ALB documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-authenticate-users.html)
   - One for the client application with a call URL pointing to the same FQDN as in he Lambda function's `CODE_VERIFICATION_URI` environment variable but on the `/callback` endpoint
 - Create Target Group in EC2 that will target the Lambda function created previously
 - Configure the ALB instance with the following listeners:
   - Listener on Port `80` and protocol `HTTP` doing a default redicrect rule to the HTTPS/443 endpoint
   - Listener on Port `443` and protocol `HTTPS` using the certificate created or imported into ACM previously and with:
     - A default fixed `503` response rule
     - A number `1` rule matching `Path` of `/device`:
       - Authenticating with the Cognito User Pool created previously and using the appropriate Client Application credentials
       - Forward to the Target Group created previously
     - A number `2` rule matching `Path` of `/token` or `/callback`:
       - Forward to the Target Group created previously

# How to use it?

> All the Client Application calls can be performed using Curl library, Postman client, or any HTTP request library or SDK available in the Client Application coding language.
> 
> Note that OAuth2 Clients can be:
> - Public, therefore the client only owns a `Client ID`. If so the client only has to provide the `Client ID` as parameter of the request.
> - Private, therefore the client owns a `Client ID` and a `Client Secret`. If so the client has to provide the `Client ID` as parameter of the request and the Base64 encoded `Client ID:Client Secret` as an `Authorization` Header
>
> All the following Client Application HTTPS requests are made with the assumption it is a private OAuth2 client.

While this project lets you decide how the user will ask the Client Application to start the Authorization request and will be presented with the User Code and URI for it to be verified, you can emulate the Client Application behavior by generating the following HTTPS ‘POST’ request to the ALB protected Lambda function `/token` endpoint with the appropriate HTTP Authorization header:

```
 POST /token?client_id=AIDACKCEVSQ6C2EXAMPLE HTTP/1.1
 User-Agent: Mozilla/4.0 (compatible; MSIE5.01; Windows NT)
 Host: <FQDN of the ALB protected Lambda function>
 Accept: */*
 Accept-Encoding: gzip, deflate
 Connection: Keep-Alive
 Authorization: Basic QUlEQUNLQ0VWU1E2QzJFWEFNUExFOndKYWxyWFV0bkZFTUkvSzdNREVORy9iUHhSZmlDWUVYQU1QTEVLRVkg
```

The Client Application will then be returned with a JSON message:

```
Server: awselb/2.0
Date: Tue, 06 Apr 2021 19:57:31 GMT
Content-Type: application/json
Content-Length: 33
Connection: keep-alive
cache-control: no-store
{
    "device_code": "APKAEIBAERJR2EXAMPLE",
    "user_code": "ANPAJ2UCCR6DPCEXAMPLE",
    "verification_uri": "https://<FQDN of the ALB protected Lambda function>/device",
    "verification_uri_complete": "https://<FQDN of the ALB protected Lambda function>/device?code=<User Code>&authorize=true",
    "interval": <Echo of POLLING_INTERVAL environment variable>,
    "expires_in": <Echo of CODE_EXPIRATION environment variable>
}
```

To act as the user, you need to open a browser and to navigate to the `verification_uri` provided by the Client application.
As this URI is protected by Cognito, you will have to authenticate with the Cognito User created previously.
Note, this segment relying on Amazon Cognito, all the following situations can be handled:
 - If the users are already authenticated, they can benefit from automatic Single Sign-On.
 - If External IdP authentication is activated, they can use their social or Enterprise login.
 - If Advanced Security Feature are activated, they can benefit from Multi-Factor authentication
Once authenticated, you will be presented with the following UI where `$Username`will be the username of the Cognito user authenticated:
 
![End User UI screen capture](img/enduser_UI.jpg)

You will have to fill in the User Code provided by the Client application as the previous step, then click on `Authorize`.

![End User UI successful capture](img/enduser_success.jpg)
 
While you can emulate the Client App regularly checking for the Authorization Request status with the following HTTPS ‘POST’ request to the ALB protected Lambda function `/token` endpoint with the appropriate HTTP Authorization header:

```
 POST /token?client_id=AIDACKCEVSQ6C2EXAMPLE&device_code=APKAEIBAERJR2EXAMPLE&grant_type=urn:ietf:params:oauth:grant-type:device_code HTTP/1.1
 User-Agent: Mozilla/4.0 (compatible; MSIE5.01; Windows NT)
 Host: <FQDN of the ALB protected Lambda function>
 Accept: */*
 Accept-Encoding: gzip, deflate
 Connection: Keep-Alive
 Authorization: Basic QUlEQUNLQ0VWU1E2QzJFWEFNUExFOndKYWxyWFV0bkZFTUkvSzdNREVORy9iUHhSZmlDWUVYQU1QTEVLRVkg
```

Until the Authorization Request has been approved, the Client Application will be returned with `authorization_pending`, `slow_down` if the polling is too frequent, or `expired` is the maximum lifetime of the code has been reached. For example:

```
HTTP/1.1 400 Bad Request
Server: awselb/2.0
Date: Tue, 06 Apr 2021 20:57:31 GMT
Content-Type: application/json
Content-Length: 33
Connection: keep-alive
cache-control: no-store
{"error":"authorization_pending"}
```

Once approved, the Client Application will be returned with JWT tokens:

```
HTTP/1.1 200 OK
Server: awselb/2.0
Date: Tue, 06 Apr 2021 21:41:50 GMT
Content-Type: application/json
Content-Length: 3501
Connection: keep-alive
cache-control: no-store
{"id_token":"eyJraWQiOiIrUE00eDUwYjBnTUlLdVNnSVZhKzZqZndjazRCbmcrSkVOTlNrN2NxNEl3PSIsImFsZyI6IlJTMjU2In0.eyJhdF9oYXNoIjoia0N3U2NXVF9VXzF1WVRvdElJUE5vdyIsInN1YiI6ImM1MThjNzg0LWJlYWQtNDUyMy05OWQ2LTU5YjYwY2ZjNmI0YiIsImF1ZCI6IjZnbGdrc2V2MWlwdTAIDACKCEVSQ6C2EXAMPLEcm5hbWUiOiJ0ZXN0X3N0YXR1cyIsInBob25lX251bWJlciI6IisxNTE0Nzc4NTU2NSIsImV4cCI6MTYxNzczODExMCwiaWF0IjoxNjE3NzM0NTEwLCJlbWFpbCI6ImplZmZzZWNAYW1hem9uLmNvbSJ9.RfEzbli4kgdBK7-1RLRJAEHo5o75g7EKiKyNJzxDGmacBcPYu6mZdF8PaqJ-ae0YSNfXsQlHRsRcCRn8fr7wlFi8OzruL8HKY34Kgm2qfcA7VbG6xYDFOxNLhYSKL5Otbx6933M2Wr_Nf7BwuxdWg","access_token":"eyJraWQiOiJGVHVFNG51MmxaS2ZSY2g5QmttUGgxZzdkeTVXREJYNUhPd1BiNXNrZ3k4PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJjNTE4Yzc4NC1iZWFkLTQ1MjMtOTlkNi01OWI2MGNmYzZiNGIiLCJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJzY29wZSI6Im9wZW5pZCIsImF1dGhfdGlje7MtGbClwBF/2Zp9Utk/h3yCo8nvbEXAMPLEKEY6IjIzMzc4ZTE5LTZmZTItNDU4Mi04N2YzLTNhOGY0NDc0YmE4YyIsImNsaWVudF9pZCI6IjZnbGdrc2V2MWlwdTZkb2Y4cTBtZ2VsZGp1IiwidXNlcm5hbWUiOiJ0ZXN0X3N0YXR1cyJ9.eYEs-zaPdHzrsZet_gC1REeK6Ybmz-AmvpA526sqZY-0w7KBF5f4kL1nQCZuHzYJdGRF_S6uDVWgbdqOc2uWwyKdVfORBbCB51cgcUE3KJnZlazn7og-mtIK9rRSzad7apYhQeuefnMCXtl0h4mcUvSyzuNv6hrp3cllNOYa77oLo3X4jxIa3P4vVvRP1NG3tRENrslsc-Kr3xG23FueZW-z2Su6eRjiCmKgL2vCxUqGneyD5q8CBtG-CaJmmmqpp6KHLCPltw","refresh_token":"eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ.KUPenGprPRxuv4ETVvxxfnsIbGkifpc8mUVOq4X0qR42UMg-DCZedSePcWb6kG1dbHhzbTC7HlaAkKhVHkf0YyZIjBxK5JQv1OdKpcFolK6VzcHrOyYijSPJCsWy9EDMT2xi0wQ7MEOirrUpGE_2I2dRIRJIfpHA75W1NqYc30EUH-rouqw_9WXeK3n2SWsRved8TNK-JVw1JSc3VeuyVdjXu_KSvcJLQ_hKxwJ5-7LjUVDA2sAdBTvHIAPKAEIBAERJR2EXAMPLELqBRjd3kyRBb3iW7ZEuxJhKTEVf60EqFiJi28z6XOkWNe3eXmYqBBFaXNTcUDDZry47_bWxVS71jGJi1CCcWkCYkRFz1wWPEclHfNWHlQVNsBAiC8hA95CQTVl7FiucE4KZBUFrGUw7-CEHoZbJyPzVaCigR-5BXi9ELo7cRUsvRPGr0XMBDgYnBQysA_grAnMlyqoht68JOVc_drfxV0bASRBREc07APvMPs1Mc6XiQfU7apy4XxB7iY5_oW5Umt-ZxAVbm-co.pjPDkHlhEfcAI7KdCYdhpw","expires_in":3600}
```

The client application can now consume resources on behalf of the user thanks to the Access Token and can refresh the Access Token autonomously thanks to the Refresh Token.

# Can I have more details onto the flow?

> All the Client Applicaiton calls can be performed using Curl library, Postman client, or any HTTP request library or SDK available in the Client Applicaiton coding language.
> 
> Note that OAuth2 Clients can be:
> - Public, therefore the client only owns a `Client ID`. If so the client only has to provide the `Client ID` as parameter of the request.
> - Private, therefore the client owns a `Client ID` and a `Client Secret`. If so the client has to provide the `Client ID` as parameter of the request and the Base64 encoded `Client ID:Client Secret` as an `Authorization` Header
>
> All the following HTTP requests are made with the assumption the OAuth2 client is private.

![General Flow](img/Grant_Device_flow.jpg)

 1.a - [Outside of the scope of this PoC] The user interacts with the client application to check if it is already is enrolled.

 1.b - [Outside of the scope of this PoC] To establish a status, the client application checks if it is in possession of a set of JWT tokens (ID, Access, and Refresh).
> This flow assume that client application is not already enrolled and therefore not in possession of a set of JWT Tokens
 
 2.a - The Client Application does a `POST` to the ALB protected Lambda function `/token` endpoint:
```
 POST /token?client_id=AIDACKCEVSQ6C2EXAMPLE HTTP/1.1
 User-Agent: Mozilla/4.0 (compatible; MSIE5.01; Windows NT)
 Host: <FQDN of the ALB protected Lambda function>
 Accept: */*
 Accept-Encoding: gzip, deflate
 Connection: Keep-Alive
 Authorization: Basic QUlEQUNLQ0VWU1E2QzJFWEFNUExFOndKYWxyWFV0bkZFTUkvSzdNREVORy9iUHhSZmlDWUVYQU1QTEVLRVkg
```
 3.a - If valid, the Lambda function generates some device code and user code,
 
 3.b - The Lambda function creates an entry in the DynamoDB table
 
 3.c - The Lambda function returns a JSON message to the client application:
```
{
    "device_code": "APKAEIBAERJR2EXAMPLE",
    "user_code": "ANPAJ2UCCR6DPCEXAMPLE",
    "verification_uri": "https://<FQDN of the ALB protected Lambda function>/device",
    "verification_uri_complete": "https://<FQDN of the ALB protected Lambda function>/device?code=<User Code>&authorize=true",
    "interval": <Echo of POLLING_INTERVAL environment variable>,
    "expires_in": <Echo of CODE_EXPIRATION environment variable>
}
```
 4.a - [Outside of the scope of this PoC] The client application stores the `device_code` internally
 
 4.b - [Outside of the scope of this PoC] The client application displays to the user the `user_code` (and if necessary the `verification_uri`)

 5.a -  The client application regularly checks if the Authorization request has been accepted by the user by doing a `POST` to the ALB protected Lambda function `/token` endpoint:
```
 POST /token?client_id=AIDACKCEVSQ6C2EXAMPLE&device_code=APKAEIBAERJR2EXAMPLE&grant_type=urn:ietf:params:oauth:grant-type:device_code HTTP/1.1
 User-Agent: Mozilla/4.0 (compatible; MSIE5.01; Windows NT)
 Host: <FQDN of the ALB protected Lambda function>
 Accept: */*
 Accept-Encoding: gzip, deflate
 Connection: Keep-Alive
 Authorization: Basic QUlEQUNLQ0VWU1E2QzJFWEFNUExFOndKYWxyWFV0bkZFTUkvSzdNREVORy9iUHhSZmlDWUVYQU1QTEVLRVkg
```
5.b -  Then the Lambda function will return, until the Authorization request has been accepted or denied by the user, a JSON message with `authorization_pending` if the request is still valid, `expired` otherwise. For example:
```
HTTP/1.1 400 Bad Request
Server: awselb/2.0
Date: Tue, 06 Apr 2021 20:57:31 GMT
Content-Type: application/json
Content-Length: 33
Connection: keep-alive
cache-control: no-store
{"error":"authorization_pending"}
```
> Note that if the client application is checking too quiclky the status of the Authorization request, it might receive a `slow_down` JSON message

 6.a - The user will open a browser and navigate to the `verification_uri`

> Note that the `verification_uri` can be customized with a Mobile Appplication handler like `myapp://`, a QRCode, or anything fitting the user context for a better experience

7.a -  The `verification_uri`, being protected by Cognito User Pool, will require that the user 
 authenticates.

7.b - The user authenticates through the Cognito User Pool

> As this segment relies on Amazon Cognito, all the following situations can be handled:
> - If the users are already authenticated, they can benefit from automatic Single Sign-On.
> - If External IdP authentication is activated, they can use their social or Enterprise login.
> - If Advanced Security Feature are activated, they can benefit from Multi-Factor authentication

7.c - The Cognito User Pool returns an Authorization code to the ALB protected Lambda function

7.d - The ALB protected Lambda function exchanges the Authorization Code for JWT tokens

8.a -  Once authenticated, the user will be able to fill in the `user_code` provided by the client application and to choose to Authorize or Deny the Authorization request.

![End User UI screen capture](img/enduser_ui.jpg)

> The rest of the flow will take the assumption the user authorized the Authorization request

9.a - The Lambda function will trigger an Authorization Code grant flow with PKCE request to the Cognito User Pool on behalf of the client application for the user

9.b - The user is authenticated seamlessly through the Cognito User Pool cause a session already exists

10.a - The user is redirected to the Lambda function `callback` endpoint with an Authorization Code

10.b -  The Lambda function will store the Authorization Code, the user Action (Authorized), as long as the username taking the Action (Authorized) within the Authorization request in the DynamoDB table

11.a -  The next time the client application checks if the Authorization request has been accepted by the user by doing a `POST` to the ALB protected Lambda function `/token` endpoint:

```
 POST /token?client_id=AIDACKCEVSQ6C2EXAMPLE&device_code=APKAEIBAERJR2EXAMPLE&grant_type=urn:ietf:params:oauth:grant-type:device_code HTTP/1.1
 User-Agent: Mozilla/4.0 (compatible; MSIE5.01; Windows NT)
 Host: <FQDN of the ALB protected Lambda function>
 Accept: */*
 Accept-Encoding: gzip, deflate
 Connection: Keep-Alive
 Authorization: Basic QUlEQUNLQ0VWU1E2QzJFWEFNUExFOndKYWxyWFV0bkZFTUkvSzdNREVORy9iUHhSZmlDWUVYQU1QTEVLRVkg
```

11.b - Cause the Authorization Request has been 'Authorized', the Lambda function retrieves the Authorization Code stored within the Authorization request in the DynamoDB table

11.c - The Lambda function will use the client application credentials Authorization header and the Authorization Code to to call the Cognito User Pool and forward the result JWT tokens:

```
HTTP/1.1 200 OK
Server: awselb/2.0
Date: Tue, 06 Apr 2021 18:41:50 GMT
Content-Type: application/json
Content-Length: 3501
Connection: keep-alive
cache-control: no-store
{"id_token":"eyJraWQiOiIrUE00eDUwYjBnTUlLdVNnSVZhKzZqZndjazRCbmcrSkVOTlNrN2NxNEl3PSIsImFsZyI6IlJTMjU2In0.eyJhdF9oYXNoIjoia0N3U2NXVF9VXzF1WVRvdElJUE5vdyIsInN1YiI6ImM1MThjNzg0LWJlYWQtNDUyMy05OWQ2LTU5YjYwY2ZjNmI0YiIsImF1ZCI6IjZnbGdrc2V2MWlwdTAIDACKCEVSQ6C2EXAMPLEcm5hbWUiOiJ0ZXN0X3N0YXR1cyIsInBob25lX251bWJlciI6IisxNTE0Nzc4NTU2NSIsImV4cCI6MTYxNzczODExMCwiaWF0IjoxNjE3NzM0NTEwLCJlbWFpbCI6ImplZmZzZWNAYW1hem9uLmNvbSJ9.RfEzbli4kgdBK7-1RLRJAEHo5o75g7EKiKyNJzxDGmacBcPYu6mZdF8PaqJ-ae0YSNfXsQlHRsRcCRn8fr7wlFi8OzruL8HKY34Kgm2qfcA7VbG6xYDFOxNLhYSKL5Otbx6933M2Wr_Nf7BwuxdWg","access_token":"eyJraWQiOiJGVHVFNG51MmxaS2ZSY2g5QmttUGgxZzdkeTVXREJYNUhPd1BiNXNrZ3k4PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJjNTE4Yzc4NC1iZWFkLTQ1MjMtOTlkNi01OWI2MGNmYzZiNGIiLCJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJzY29wZSI6Im9wZW5pZCIsImF1dGhfdGlje7MtGbClwBF/2Zp9Utk/h3yCo8nvbEXAMPLEKEY 6IjIzMzc4ZTE5LTZmZTItNDU4Mi04N2YzLTNhOGY0NDc0YmE4YyIsImNsaWVudF9pZCI6IjZnbGdrc2V2MWlwdTZkb2Y4cTBtZ2VsZGp1IiwidXNlcm5hbWUiOiJ0ZXN0X3N0YXR1cyJ9.eYEs-zaPdHzrsZet_gC1REeK6Ybmz-AmvpA526sqZY-0w7KBF5f4kL1nQCZuHzYJdGRF_S6uDVWgbdqOc2uWwyKdVfORBbCB51cgcUE3KJnZlazn7og-mtIK9rRSzad7apYhQeuefnMCXtl0h4mcUvSyzuNv6hrp3cllNOYa77oLo3X4jxIa3P4vVvRP1NG3tRENrslsc-Kr3xG23FueZW-z2Su6eRjiCmKgL2vCxUqGneyD5q8CBtG-CaJmmmqpp6KHLCPltw","refresh_token":"eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ.KUPenGprPRxuv4ETVvxxfnsIbGkifpc8mUVOq4X0qR42UMg-DCZedSePcWb6kG1dbHhzbTC7HlaAkKhVHkf0YyZIjBxK5JQv1OdKpcFolK6VzcHrOyYijSPJCsWy9EDMT2xi0wQ7MEOirrUpGE_2I2dRIRJIfpHA75W1NqYc30EUH-rouqw_9WXeK3n2SWsRved8TNK-JVw1JSc3VeuyVdjXu_KSvcJLQ_hKxwJ5-7LjUVDA2sAdBTvHIAPKAEIBAERJR2EXAMPLELqBRjd3kyRBb3iW7ZEuxJhKTEVf60EqFiJi28z6XOkWNe3eXmYqBBFaXNTcUDDZry47_bWxVS71jGJi1CCcWkCYkRFz1wWPEclHfNWHlQVNsBAiC8hA95CQTVl7FiucE4KZBUFrGUw7-CEHoZbJyPzVaCigR-5BXi9ELo7cRUsvRPGr0XMBDgYnBQysA_grAnMlyqoht68JOVc_drfxV0bASRBREc07APvMPs1Mc6XiQfU7apy4XxB7iY5_oW5Umt-ZxAVbm-co.pjPDkHlhEfcAI7KdCYdhpw","expires_in":3600}
```

12.a - The Lambda function returns the JWT Tokens JSON object to the Client Application

12.b - [Outside of the scope of this PoC] The client application can now consumme resources on behalf of the user thanks to the Access Token and can refresh the Access Token autonomously thanks to the Refresh Token.

# What would have happened if the user has denied the Authorization request at Step 8.a?

The Lambda function will have only updated the Authorization request status to `denied` in the DynamoDB table without triggering any Authorization Code grant flow with PKCE request.

The next time the client application checks if the Authorization request has been accepted by the user by doing a `POST` to the ALB protected Lambda function `/token` endpoint, it will have received the `denied` status as part of a JSON message:

```
HTTP/1.1 400 Bad Request
Server: awselb/2.0
Date: Tue, 06 Apr 2021 20:57:31 GMT
Content-Type: application/json
Content-Length: 33
Connection: keep-alive
cache-control: no-store
{"error":"authorization_pending"}
```

# How to go further?

This project is delivered with a default configuration. You can change the Lambda function environment variables to customize the experience provided by this Blog Post, for example:

| Name | Function | Default value | Type |
| ---- | ---- | ---- | ---- |
| CODE_EXPIRATION | Represents the lifetime of the codes generated | 1800 | Seconds |
| DEVICE_CODE_FORMAT | Represents the format for the device code | #aA | String where: `#` represents numbers, `a` lowercase letters, `A` uppercase letters, `!` special characters |
| DEVICE_CODE_LENGTH | Represents the device code length | 64 | Number |
| POLLING_INTERVAL | Represents the minimum time in seconds between two polling from the client application | 5 | Seconds |
| USER_CODE_FORMAT | Represents the format for the user code | #B | String where: `#` represents numbers, `a` lowercase letters, `b` lowercase letters without vowels, `A` uppercase letters, `B` uppercase letters without vowels, `!` special characters |
| USER_CODE_LENGTH | Represents the user code length | 8 | Number |
| RESULT_TOKEN_SET | Represents what should be returned in the Token Set to the Client Application | `ACCESS+REFRESH` | String including only `ID`,`ACCESS`, and `REFRESH` values separated with `+` |

To change those values:
1.	From the Lambda console:

![Lambda-Console](img/Lambda-Console.png)

2.	Select DeviceGrant-token function:

![Lambda-Function](img/Lambda-Function.png)

3.	Go to the Configuration tab:

![Lambda-Configuration](img/Lambda-Configuration.png)

4.	Select the Environment variables tab, then click Edit to change the values you want:

![Lambda-Variables](img/Lambda-Variables.png)

5.	Generate new codes as the Device and see how the experience changes

# Additional references

- Device Grant Flow: https://www.oauth.com/oauth2-servers/device-flow/
- Cognito Endpoints: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-userpools-server-contract-reference.html
- Domain name for authentication : https://<domain_name>.auth.<region>.amazoncognito.com
- PKCE in NodeJS: https://developers.onelogin.com/openid-connect/guides/auth-flow-pkce

# Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

# License

This library is licensed under the MIT-0 License. See the LICENSE file.