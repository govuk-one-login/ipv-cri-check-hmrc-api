# di-ipv-cri-check-hmrc-api

HMRC Check Credential Issuer API

## Integration Tests

There are 3 types of Integration Tests:

### AWS

These tests run against the real state machine deployed in AWS.
To run these tests the following environment variables are needed:

- STACK_NAME
- AWS_REGION
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_SESSION_TOKEN

Temporary credentials can be found by going to the [AWS start page](https://uk-digital-identity.awsapps.com/start#/), selecting the account and clicking
"Command line or programmatic access"

To run the tests: `npm run test:aws`

### Mocked

These tests run locally on your system. To run: `npm run test:mocked`

### MAKE

These are the equivalent of the Mocked tests however they use MAKE to run.
The MAKE tests are useful for debugging the mocked tests or for extending the tests.

Steps:

1. `make run` to create the Docker container
2. `make create` to create the mocked state machine in the Docker container
3. `make <test>` e.g. `make happy1stTry`
