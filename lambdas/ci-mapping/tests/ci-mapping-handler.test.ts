import { CiMappingHandler } from "../src/ci-mapping-handler";
import { Context } from "aws-lambda";

describe("ci-mapping-handler", () => {
  it("should print Hello, World!", async () => {
    const ciMappingHandler = new CiMappingHandler();
    const result = await ciMappingHandler.handler({}, {} as Context);
    expect(result).toStrictEqual("Hello, World!");
  });
});
