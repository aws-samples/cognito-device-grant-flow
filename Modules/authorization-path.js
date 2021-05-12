//Reference to Commnon library
const common = require( __dirname + '/common.js');
//Reference to Crypto library for PKCE challenge
const crypto = require('crypto');

//Function that processes "Authorize" by an authenticated end user for a valid user code
//  client_id:      Client ID of the client application that initiated the Authorization request
//  device_code:    Primary key of the "Authorized" Authorization request in the DynamoDB table
//  callback:       Callback function to return the message
//  dynamodb:       Pointer to the DynamoDB SDK request handler
function processAllow(client_id, device_code, callback, dynamodb) {
    
    //Generating a code verifier and challenge for the PKCE protection of the OAuth2 flow
    var code_verifier = common.randomString(32, 'aA#');
    var hash = crypto.createHash('sha256').update(code_verifier).digest();
    var code_challenge = common.base6UurlEncode(hash);

    //Generating a random state for preventing against CSRF attacks
    var state = common.randomString(32, 'aA#');
    
    //Updating the Authorization request with PKCE code verifier and State
    var DynamoDBParams = {
        ExpressionAttributeNames: {
            "#AuthZ_State": "AuthZ_State",
            "#AuthZ_Verif": "AuthZ_Verifier_code",
        },
        ExpressionAttributeValues: {
            ":authz_state": {
                S: state
            },
            ":authz_verif": {
                S: code_verifier
            }
        }, 
        Key: {
            "Device_code": {
                S: device_code
            }
        },
        ReturnValues: "ALL_NEW", 
        TableName: process.env.DYNAMODB_TABLE,
        UpdateExpression: "SET #AuthZ_State = :authz_state, #AuthZ_Verif = :authz_verif"
    };
    dynamodb.updateItem(DynamoDBParams, function(err, data) {
        if (err) {
            //There was an error updating the Authorization request
            console.log("Unable to set Authorization State and Verifier Code for Device Code = " + device_code);
            common.returnHTMLError(400, "<H1>Error, can't update status</H1>", callback);
        }
        else {
            //Update was successful so triggering a standard Authorization Code Grant flow with PKCE to Cognito using the inial Client Application's Client ID
            var response = {
                statusCode: 302,
                headers: {"location": "https://" + process.env.CUP_DOMAIN + ".auth." + process.env.CUP_REGION + ".amazoncognito.com/oauth2/authorize?response_type=code&client_id=" + client_id + "&redirect_uri=" + encodeURIComponent("https://" + process.env.CODE_VERIFICATION_URI + "/callback") + "&state=" + state + "&scope=" + data.Attributes.Scope.S + "&code_challenge_method=S256&code_challenge=" + code_challenge + "&identity_provider=COGNITO"},
            };
            callback(null, response);
        }
    });
}

module.exports = Object.assign({ processAllow });