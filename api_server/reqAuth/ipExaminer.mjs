function generatePolicy(principalId, Effect, Resource) {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Action: 'execute-api:Invoke',
        Effect,
        Resource,
      }],
    },
  };
}

export const handler = async (event, context, callback) => {
  const whiteList = process.env.ALLOW_IP.split(',');
  const reqestIp = event.requestContext.identity.sourceIp;

  if (whiteList.includes(reqestIp)) {
    callback(null, generatePolicy('apiuser', 'Allow', event.methodArn));
  } else callback('Unauthorized');
}

