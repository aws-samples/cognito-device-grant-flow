# Detailled flow
> All the Client Applicaiton calls can be performed using Curl library, Postman client, or any HTTP request library or SDK available in the Client Applicaiton coding language.
> 
> Note that OAuth2 Clients can be:
> - Public, therefore the client only owns a `Client ID`. If so the client only has to provide the `Client ID` as parameter of the request.
> - Private, therefore the client owns a `Client ID` and a `Client Secret`. If so the client has to provide the `Client ID` as parameter of the request and the Base64 encoded `Client ID:Client Secret` as an `Authorization` Header
>
> All the following HTTP requests are made with the assumption the OAuth2 client is private.

![General Flow](../img/Grant_Device_flow_v1.jpg)

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

![End User UI screen capture](../img/enduser_ui.jpg)

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