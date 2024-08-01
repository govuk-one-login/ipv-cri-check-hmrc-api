export const personalNumberPatterns = [
  {
    regex: /\\"personalNumber\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\"personalNumber\\": \\"***\\"',
  },
  {
    regex: /\\\\"personalNumber\\\\":\\\\"([^"]*)\\\\"/g,
    replacement: '\\\\"personalNumber\\\\":\\\\"***\\\\"',
  },
  {
    regex: /\\\\\\"personalNumber\\\\\\":\\\\\\"([^"]*)\\\\\\"/g,
    replacement: '\\\\\\"personalNumber\\\\\\":\\\\\\"***\\\\\\"',
  },
  {
    regex: /\\"nino\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\"nino\\": \\"***\\"',
  },
  {
    regex: /\\\\"nino\\\\":\s*\\\\"([^"]*)\\\\"/g,
    replacement: '\\\\"nino\\\\": \\\\"***\\\\"',
  },
  {
    regex: /\\\\\\"nino\\\\\\":\\\\\\"([^"]*)\\\\\\"/g,
    replacement: '\\\\\\"nino\\\\\\": \\\\\\"***\\\\\\"',
  },
  {
    regex: /"nino":{"S": "\\"([^"]*)\\"}/g,
    replacement: '"nino":{"S": \\"***\\"}',
  },
  {
    regex: /\\"nino\\":{\\"S\\":"\\"([^"]*)\\"}/g,
    replacement: '\\"nino\\":{\\"S\\":\\"***\\"}',
  },
  {
    regex: /\\"nino\\":\{\\"S\\":\\"([^"]*)\\"}/g,
    replacement: '\\"nino\\":{\\"S\\":\\"***\\"}',
  },
];
