import express, { Request, Response } from "express";
import { APIGatewayProxyEvent } from "aws-lambda";
import { LambdaInterface } from "@aws-lambda-powertools/commons";

export class LambdaServer {
  private readonly app: express.Application;
  private readonly port: number;
  private lambdaHandler: LambdaInterface;
  private server: any;

  constructor(port: number, lambdaHandler: LambdaInterface) {
    this.app = express();
    this.port = port;
    this.lambdaHandler = lambdaHandler;
    this.configureMiddleware();
    this.configureRoutes();
  }

  private configureMiddleware(): void {
    this.app.use(this.customBodyParser);
  }

  private customBodyParser(req: Request, res: Response, next: any): void {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      try {
        req.body = JSON.parse(data);
      } catch (err) {
        req.body = data;
      }
      next();
    });
  }

  private configureRoutes(): void {
    this.app.post("/", this.handleInvoke.bind(this));
  }

  private async handleInvoke(req: Request, res: Response): Promise<void> {
    const event: APIGatewayProxyEvent = {
      body: JSON.parse(JSON.stringify(req.body)),
      headers: req.headers as { [name: string]: string },
      multiValueHeaders: {},
      httpMethod: "POST",
      isBase64Encoded: false,
      path: req.path,
      queryStringParameters: req.query as { [name: string]: string },
      multiValueQueryStringParameters: {},
      pathParameters: {},
      stageVariables: {},
      requestContext: {
        accountId: "",
        apiId: "",
        authorizer: {},
        protocol: "",
        httpMethod: "",
        identity: {
          accessKey: null,
          accountId: null,
          apiKey: null,
          apiKeyId: null,
          caller: null,
          clientCert: null,
          cognitoAuthenticationProvider: null,
          cognitoAuthenticationType: null,
          cognitoIdentityId: null,
          cognitoIdentityPoolId: null,
          principalOrgId: null,
          sourceIp: "",
          user: null,
          userAgent: null,
          userArn: null,
        },
        path: "",
        stage: "",
        requestId: "",
        requestTimeEpoch: 0,
        resourceId: "",
        resourcePath: "",
      },
      resource: "",
    };

    try {
      const result = await this.lambdaHandler.handler(
        event as any,
        {} as any,
        {} as any
      );
      res.status(result.statusCode).header(result.headers).send(result.body);
    } catch (error: any) {
      res.status(500).send(error.toString());
    }
  }
  public async start(): Promise<void> {
    return new Promise<void>((resolve, _) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Server is running at http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.server) {
        this.server.close((err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}
