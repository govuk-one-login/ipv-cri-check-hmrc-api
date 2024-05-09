#!/usr/bin/env bash
set -eu

lambda_function_name=$(aws cloudformation describe-stacks --stack-name ipv-cri-check-hmrc-smoke-tests --query "Stacks[0].Outputs[?OutputKey=='CanaryInvokerFunction'].OutputValue" --output text)
canary_names=("nino-happy" "nino-ci")

for canary_name in "${canary_names[@]}"; do
    payload="{ \"canaryName\": \"$canary_name\" }"
    encoded_payload=$(echo -n "$payload" | base64)

    if ! aws lambda invoke \
        --function-name "$lambda_function_name" \
        --payload "$encoded_payload" \
        output.txt; then
        echo "Lambda invocation failed for $canary_name"
        exit 1
    fi

    if grep -q "errorMessage" output.txt; then
        echo "Lambda function returned an error for $canary_name"
        cat output.txt
        exit 1
    fi

    echo "Output for $canary_name:"
    cat output.txt
    echo ""
done
