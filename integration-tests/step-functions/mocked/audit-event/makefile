STATE_MACHINE_NAME=audit_event
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
	--name happy \
	--state-machine ${STATE_MACHINE_ARN}#Happy \
	--input '{ "detail-type": "END", "source": "review-hc.localdev.account.gov.uk", "detail": { "auditPrefix": "IPV_HMRC_RECORD_CHECK_CRI", "user": { "govuk_signin_journey_id": "252561a2-c6ef-47e7-87ab-93891a2a6a41", "user_id": "test", "persistent_session_id": "156714ef-f9df-48c2-ada8-540e7bce44f7", "session_id": "issue-credential-happy-publish", "ip_address": "00.100.8.20" }, "issuer": "https://review-hc.dev.account.gov.uk" } }' \
	--no-cli-pager
NoSessionFound:
	aws stepfunctions start-execution \
	--endpoint http://localhost:8084 \
	--name NoSessionFound \
	--state-machine ${STATE_MACHINE_ARN}#NoSessionFound \
	--input '{ "sessionId": "12345" }' \
	--no-cli-pager
