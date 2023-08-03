import { LambdaInterface } from "@aws-lambda-powertools/commons";

export class MatchingHandler implements LambdaInterface {

    public async handler(event: any, _context: unknown): Promise<any> {
        const url = event.apiURL.value;
        if(!event.userDetails.firstName) {
            throw new Error("firstName is missing")
        }
        const postBody = {
            "firstName": event.userDetails.firstName,
            "lastName": event.userDetails.lastName,
            "dateOfBirth": event.userDetails.dob,
            "nino": event.nino
        }
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": event.userAgent.value,
                "Authorization": "Bearer " + event.oAuthToken.value,
            },
            body: JSON.stringify(postBody),
        });
        return await response.json();
    }
}

const handlerClass = new MatchingHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
