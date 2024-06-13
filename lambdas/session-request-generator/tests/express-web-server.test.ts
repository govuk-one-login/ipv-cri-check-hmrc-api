import { LambdaServer } from "../src/express-web-server";
import { SessionRequestGenerator } from "../src/session-request-generator";

jest.setTimeout(60_0000);

describe("express-web-server", () => {
  let server: LambdaServer;

  beforeAll(async () => {
    const handler = new SessionRequestGenerator();
    server = new LambdaServer(8080, handler);
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("should run the server", async () => {
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        console.log("Async operation completed");
        resolve();
      }, 60_0000);
    });
    console.log("Test completed");
  });
});
