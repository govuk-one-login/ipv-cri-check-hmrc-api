# di-ipv-cri-check-hmrc-api

HMRC Check Credential Issuer API

## Integration Tests

There are 3 types of Integration Tests: Mocked, AWS and API Gateway

### Step Function AWS

These tests run against the real state machine deployed in AWS.
To run these tests the following environment variables are needed:

- STACK_NAME
- AWS_REGION
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_SESSION_TOKEN

Temporary credentials can be found by going to the [AWS start page](https://uk-digital-identity.awsapps.com/start#/), selecting the account and clicking
"Command line or programmatic access"

To run the tests against a stack deployed in AWS, authenticate to the correct account and run

`STACK_NAME=<stack-name> npm run test:sfn:aws --workspace integration-tests`

_You can omit the `--workspace` parameter if the current working directory is `integration-tests`._

### Step Function Mocked

In mocked tests, all AWS service integrations are mocked, and only the step function path flow is checked to verify all
the paths through step function states. Tasks and mocked service integrations are wired to return the expected responses.

These tests run locally on your system and need the Docker agent to be running in the background before the execution begins.

To run the mocked step function tests run
`npm run test:sfn:mocked --workspace integration-tests`

_You can omit the `--workspace` parameter if the current working directory is `integration-tests`._

### API Gateway
These tests run against API Gateway in AWS.
To run these tests the following environment variables are needed:

- STACK_NAME
- AWS_REGION
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_SESSION_TOKEN

Temporary credentials can be found by going to the [AWS start page](https://uk-digital-identity.awsapps.com/start#/), selecting the account and clicking
`Access Keys` and clicking the copy next to `Option 1: Set AWS environment variables` to authenticate the correct account.


Then run the command:

`AWS_PROFILE=YourProfileName npm run test:api --workspace integration-tests`

This will run all tests in the `api-gateway` directory.
or to run e2e api tests, use the following command

`AWS_PROFILE=YourProfileName npm run test:api:e2e --workspace integration-tests`

Where `YourProfileName` is your aws sso profile, created against the Check Hmrc CRI AWS Account

### MAKE

These are the equivalent of the Mocked tests however they use MAKE to run.
The MAKE tests are useful for debugging the mocked tests or for extending the tests.

Steps:

1. `make run` to create the Docker container
2. `make create` to create the mocked state machine in the Docker container
3. `make <test>` e.g. `make happy1stTry`
