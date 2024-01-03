# Purpose
This repository is a demonstration on how to realize Device Grant flow ([RFC 8628](https://tools.ietf.org/html/rfc8628)) using Cognito, Lambda, and DynamoDB.

It is tied to an [AWS Blog Post](https://aws.amazon.com/blogs/security/implement-oauth-2-0-device-grant-flow-by-using-amazon-cognito-and-aws-lambda/)

# How does it work?
This new flow is implemented using:
 - AWS Lambda serverless functions to interact with the client application (aka the device) through an additional `/token` endpoint and the end user trough additional `/device` and `/callback` endpoints.
 - Amazon DynamoDB table to persist Authorization requests state and status.
 - Amazon Cognito to deliver the JWT tokens and to support the Authorization Code Grant flow with PKCE for end user authentication.

# How to deploy it?
You can choose to:
- [Deploy it through a CloudFormation Template](docs/CF-Template-deployment.md)
- [Deploy it manually](docs/Manual-deployment.md) using the code base of this repository

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
 Authorization: Basic QUlEÉEXAMPLEQTEVLRVkg
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
    "verification_uri_complete": "https://<FQDN of the ALB protected Lambda function>/device?code=ANPAJ2UCCR6DPCEXAMPLE&authorize=true",
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
 Authorization: Basic QUlEÉEXAMPLEQTEVLRVkg
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
{"id_token":"eyJraEXAMPLEHEADJTMjU2In0.eyJhdFEXAMPLEPAYLOADNvbSJ9.RfEzbli4EXAMPLESIG3M2Wr_Nf7BwuxdWg","access_token":"eyJraEXAMPLEHEAD2In0.eyJzEXAMPLEPAYLOADyJ9.eYEEXAMPLESIGKHLCPltw","refresh_token":"eyJjdHkiOiEXAMPLEREFRESHYdhpw","expires_in":3600}
```

The client application can now consume resources on behalf of the user thanks to the Access Token and can refresh the Access Token autonomously thanks to the Refresh Token.

# Can I have more details onto the flow?

[This page](docs/Detailled-flow.md) will describe the detailled flow implemented.

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
- PKCE in NodeJS: https://developers.onelogin.com/openid-connect/guides/auth-flow-pkce

# Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

# License

This library is licensed under the MIT-0 License. See the LICENSE file.

# Contributor

The provided solution recognized the following contributors:
- @LennartC 
