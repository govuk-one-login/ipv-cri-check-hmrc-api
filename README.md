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

## Canaries
When deploying using sam deploy, canary deployment strategy will be used which is set in LambdaDeploymentPreference and StepFunctionsDeploymentPreference in template.yaml file.

When deploying using the pipeline, canary deployment strategy set in the pipeline will be used and override the default set in template.yaml.

Canary deployments will cause a rollback if any canary alarms associated with a lambda or step-functions are triggered and a slack notification will be sent to #di-orange-warnings-non-prod or #di-orange-warning-alerts-prod.

To skip canaries such as when releasing urgent changes to production, set the last commit message to contain either of these phrases: [skip canary], [canary skip], or [no canary] as specified in the [Canary Escape Hatch guide](https://govukverify.atlassian.net/wiki/spaces/PLAT/pages/3836051600/Rollback+Recovery+Guidance#Escape-Hatch%3A-how-to-skip-canary-deployments-when-needed).
`git commit -m "some message [skip canary]"`

Note: To update LambdaDeploymentPreference or StepFunctionsDeploymentPreference, update the LambdaCanaryDeployment or StepFunctionsDeploymentPreference pipeline parameter in the [identity-common-infra repository](https://github.com/govuk-one-login/identity-common-infra/tree/main/terraform/orange/hmrc-check). To update the LambdaDeploymentPreference or StepFunctionsDeploymentPreference for a stack in dev using sam deploy, parameter override needs to be set in the [deploy script](./deploy.sh):

`--parameter-overrides LambdaDeploymentPreference=<define-strategy> \`
`--parameter-overrides StepFunctionsDeploymentPreference=<define-strategy> \`
