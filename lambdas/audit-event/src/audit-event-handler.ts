import { LambdaInterface } from "@aws-lambda-powertools/commons";
import {
  AuditEvent,
  AuditEventContext,
  AuditEventSession,
  AuditEventType,
  AuditRequestEvent,
} from "./types/audit-event";
import { PersonIdentity } from "./types/person-identity";
import { SessionItem } from "./types/session-item";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { CriAuditConfig } from "./types/cri-audit-config";
import { fromEnv } from "@aws-sdk/credential-providers";

export class AuditEventHandler implements LambdaInterface {
  public async handler(
    event: AuditRequestEvent,
    _context: unknown
  ): Promise<unknown> {
    try {
      console.log(`Request Event: ${JSON.stringify(event)}`);
      await this.sendAuditEvent(event.eventType, event.auditEventContext);
      // metrics.addDimension("issuer", sessionRequestSummary.clientId);
      // metrics.addMetric(SESSION_CREATED_METRIC, MetricUnits.Count, 1);

      return {
        statusCode: 201,
        body: JSON.stringify({
          session_id: event.auditEventContext.sessionItem.sessionId,
        }),
      };
    } catch (err: unknown) {
      //metrics.addMetric(SESSION_CREATED_METRIC, MetricUnits.Count, 0);
      console.error(`Session Lambda error occurred ${JSON.stringify(err)}`);

      throw error;
    }
  }

  private auditConfig?: CriAuditConfig;

  constructor(private readonly sqsClient: SQSClient) {}

  public async sendAuditEvent(
    eventType: AuditEventType,
    context: AuditEventContext
  ) {
    this.auditConfig ??= this.getAuditConfig();
    const auditEvent = this.createAuditEvent(eventType, context);
    await this.sendAuditEventToQueue(auditEvent);
  }

  public getAuditConfig(): CriAuditConfig {
    const auditEventNamePrefix = process.env.SQS_AUDIT_EVENT_PREFIX;
    const queueUrl = process.env.SQS_AUDIT_EVENT_QUEUE_URL;
    if (!auditEventNamePrefix || !queueUrl) {
      throw new Error("Missing required environment variables");
    }
    return { auditEventNamePrefix, queueUrl } as CriAuditConfig;
  }

  private createAuditEvent(
    eventType: AuditEventType,
    context: AuditEventContext
  ): AuditEvent {
    if (!eventType) {
      throw new Error("Audit event type not specified");
    }
    const auditEventUser = this.createAuditEventUser(
      context.sessionItem,
      context.clientIpAddress
    );
    return {
      component_id: context?.sessionItem.issuer as string,
      event_name: `${this?.auditConfig?.auditEventNamePrefix}_${eventType}`,
      extensions: context?.extensions,
      restricted: context?.personIdentity,
      timestamp: Math.floor(Date.now() / 1000),
      user: auditEventUser,
    };
  }

  private createAuditEventUser(
    sessionItem: AuditEventSession,
    clientIpAddress?: string
  ) {
    const { clientSessionId, persistentSessionId, sessionId, subject } =
      sessionItem;
    return {
      govuk_signin_journey_id: clientSessionId,
      ip_address: clientIpAddress,
      persistent_session_id: persistentSessionId,
      session_id: sessionId,
      user_id: subject,
    };
  }

  private async sendAuditEventToQueue(auditEvent?: AuditEvent) {
    const sendMsgCommand = new SendMessageCommand({
      MessageBody: JSON.stringify(auditEvent),
      QueueUrl: this?.auditConfig?.queueUrl,
    });
    await this.sqsClient.send(sendMsgCommand);
  }

  public createAuditEventContext(
    sessionItem: SessionItem,
    extensions?: Record<string, unknown>,
    personIdentity?: PersonIdentity
  ): AuditEventContext {
    const {
      sessionId,
      subject,
      persistentSessionId,
      clientSessionId,
      clientIpAddress,
    } = sessionItem;
    const context: AuditEventContext = {
      sessionItem: { sessionId, subject, persistentSessionId, clientSessionId },
      clientIpAddress,
      extensions,
      personIdentity,
    };
    return context;
  }
}

const handlerClass = new AuditEventHandler(
  new SQSClient({ region: "eu-west-2", credentials: fromEnv() })
);
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
