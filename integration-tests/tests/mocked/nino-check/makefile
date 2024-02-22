STATE_MACHINE_NAME=nino_check
STATE_MACHINE_DEFINITION_FILE=file://../../../../step-functions/${STATE_MACHINE_NAME}.asl.json
STATE_MACHINE_ARN=arn:aws:states:local:123456789012:stateMachine:${STATE_MACHINE_NAME}
STATE_MACHINE_EXECUTION_ARN=arn:aws:states:local:123456789012:execution:${STATE_MACHINE_NAME}

run:
	docker compose up -d --force-recreate
create:
	aws stepfunctions create-state-machine \
	--endpoint-url http://localhost:8083 \
	--definition ${STATE_MACHINE_DEFINITION_FILE} \
	--name ${STATE_MACHINE_NAME} \
	--role-arn "arn:aws:iam::123456789012:role/DummyRole" \
	--no-cli-pager
happy1stTry:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8083 \
	--name happyPathExecution \
	--state-machine ${STATE_MACHINE_ARN}#HappyPathTestNoPreviousAttempt \
	--input '{ "sessionId": "12345", "nino": "AA000003D" }' \
	--no-cli-pager
happy2ndTry:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8083 \
	--name happyPathExecution \
	--state-machine ${STATE_MACHINE_ARN}#HappyPathTestOn2ndAttempt \
	--input '{ "sessionId": "12345", "nino": "AA000003D" }' \
	--no-cli-pager
deceased:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8083 \
	--name happyPathExecution \
	--state-machine ${STATE_MACHINE_ARN}#DeceasedTest \
	--input '{ "sessionId": "12345", "nino": "AA000003D" }' \
	--no-cli-pager
invalidSessionID:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8083 \
	--name happyPathExecution \
	--state-machine ${STATE_MACHINE_ARN}#InValidRequestSessionId \
	--input '{ "sessionId": "12345", "nino": "AA000003D" }' \
	--no-cli-pager
failMaxAttempts:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8083 \
	--name happyPathExecution \
	--state-machine ${STATE_MACHINE_ARN}#MaximumNumberOfAttemptsExceeded \
	--input '{ "sessionId": "12345", "nino": "AA000003D" }' \
	--no-cli-pager
userNotFoundNino:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8083 \
	--name happyPathExecution \
	--state-machine ${STATE_MACHINE_ARN}#UserNotFoundForGivenNino \
	--input '{ "sessionId": "12345", "nino": "AA000003D" }' \
	--no-cli-pager
HMRCAuthError:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8083 \
	--name happyPathExecution \
	--state-machine ${STATE_MACHINE_ARN}#HMRCAuthError \
	--input '{ "sessionId": "12345", "nino": "AA000003D" }' \
	--no-cli-pager
errorSavingNino:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8083 \
	--name happyPathExecution \
	--state-machine ${STATE_MACHINE_ARN}#ErrorSavingInNinoDB \
	--input '{ "sessionId": "12345", "nino": "AA000003D" }' \
	--no-cli-pager
matchingLambdaException:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8083 \
	--name happyPathExecution \
	--state-machine ${STATE_MACHINE_ARN}#MatchingLambdaException \
	--input '{ "sessionId": "12345", "nino": "AA000003D" }' \
	--no-cli-pager
hmrcError:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8083 \
	--name happyPathExecution \
	--state-machine ${STATE_MACHINE_ARN}#HMRCError \
	--input '{ "sessionId": "12345", "nino": "AA000003D" }' \
	--no-cli-pager
APIFailRetrySuccessTest:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8083 \
	--name happyPathExecution \
	--state-machine ${STATE_MACHINE_ARN}#APIFailRetrySuccessTest \
	--input '{ "sessionId": "12345", "nino": "AA000003D" }' \
	--no-cli-pager
APIFailRetryFailTest:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8083 \
	--name happyPathExecution \
	--state-machine ${STATE_MACHINE_ARN}#APIFailRetryFailTest \
	--input '{ "sessionId": "12345", "nino": "AA000003D" }' \
	--no-cli-pager
