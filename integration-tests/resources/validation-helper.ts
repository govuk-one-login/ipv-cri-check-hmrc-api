import { Message } from "@aws-sdk/client-sqs";
import Ajv from "ajv";
import * as IPV_HMRC_RECORD_CHECK_CRI_START from "./schemas/IPV_HMRC_RECORD_CHECK_CRI_START.json";

const ajv = new Ajv({ strictTuples: false });
ajv.addSchema(
  IPV_HMRC_RECORD_CHECK_CRI_START,
  "IPV_HMRC_RECORD_CHECK_CRI_START"
);

export const isAuditEventValid = (
  eventName: string,
  schemaName: string,
  allEvents: Message[]
): boolean | Promise<unknown> => {
  const eventToTest = allEvents.find((event) => {
    if (event.Body) {
      const parsedBody = JSON.parse(event.Body);
      return parsedBody.event_name === eventName;
    }
  });

  if (eventToTest?.Body) {
    const validate = ajv.getSchema(schemaName);
    if (validate) {
      return validate(JSON.parse(eventToTest.Body));
    } else {
      throw new Error(`Could not find schema ${schemaName}`);
    }
  } else {
    return false;
  }
};
