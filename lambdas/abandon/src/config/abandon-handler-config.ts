export class AbandonHandlerConfig {
  readonly sessionTableName;
  readonly issuer;
  readonly eventBusName;
  readonly eventBusSource;

  constructor() {
    const sessionTableName = process.env.SESSION_TABLE_NAME;
    const issuer = process.env.ISSUER;
    const eventBusName = process.env.EVENT_BUS_NAME;
    const eventBusSource = process.env.EVENT_BUS_SOURCE;

    if (!sessionTableName) {
      throw new Error("SESSION_TABLE_NAME environment variable is required");
    }

    if (!issuer) {
      throw new Error("ISSUER environment variable is required");
    }

    if (!eventBusName) {
      throw new Error("EVENT_BUS_NAME environment variable is required");
    }

    if (!eventBusSource) {
      throw new Error("EVENT_BUS_SOURCE environment variable is required");
    }

    this.sessionTableName = sessionTableName;
    this.issuer = issuer;
    this.eventBusName = eventBusName;
    this.eventBusSource = eventBusSource;
  }
}
