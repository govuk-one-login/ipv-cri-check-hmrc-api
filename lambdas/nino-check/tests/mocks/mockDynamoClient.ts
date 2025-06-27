export const mockDynamoClient = {
  send: jest.fn(),
};

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => mockDynamoClient),
}));
