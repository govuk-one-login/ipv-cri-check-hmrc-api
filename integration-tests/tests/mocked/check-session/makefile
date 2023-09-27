STATE_MACHINE_NAME=nino_check_session
STATE_MACHINE_DEFINITION_FILE=file://../../../../step-functions/${STATE_MACHINE_NAME}.asl.json
STATE_MACHINE_ARN=arn:aws:states:local:123456789012:stateMachine:${STATE_MACHINE_NAME}
STATE_MACHINE_EXECUTION_ARN=arn:aws:states:local:123456789012:execution:${STATE_MACHINE_NAME}

run:
	docker compose up -d --force-recreate
create:
	aws stepfunctions create-state-machine \
	--endpoint-url http://localhost:8084 \
	--definition ${STATE_MACHINE_DEFINITION_FILE} \
	--name ${STATE_MACHINE_NAME} \
	--role-arn "arn:aws:iam::123456789012:role/DummyRole" \
	--no-cli-pager
happy:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8084 \
	--name happyPathExecution \
	--state-machine ${STATE_MACHINE_ARN}#HappyPath \
	--input '{ "sessionId": "12345" }' \
	--no-cli-pager
NoSessionFound:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8084 \
	--name happyPathExecution \
	--state-machine ${STATE_MACHINE_ARN}#NoSessionFound \
	--input '{ "sessionId": "12345" }' \
	--no-cli-pager
SessionExpired:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8084 \
	--name happyPathExecution \
	--state-machine ${STATE_MACHINE_ARN}#SessionExpired \
	--input '{ "sessionId": "12345" }' \
	--no-cli-pager
NoSessionIdPresent:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8084 \
	--name happyPathExecution \
	--state-machine ${STATE_MACHINE_ARN}#HappyPath \
	--input '{ }' \
	--no-cli-pager
