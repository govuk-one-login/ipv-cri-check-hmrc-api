export const namePatterns = [
  {
    regex: /\\"firstName\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\"firstName\\": \\"***\\"',
  },
  {
    regex: /\\"lastName\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\"lastName\\": \\"***\\"',
  },
  {
    regex:
      /\\"type\\":{\\"S\\":\\"GivenName\\"},\s*\\"value\\":{\\"S\\":\\"([^"]*)\\"/g,
    replacement:
      '\\"type\\": {\\"S\\": \\"GivenName\\"}, \\"value\\": {\\"S\\": \\"***\\"}',
  },
  {
    regex:
      /\\"type\\":{\\"S\\":\\"FamilyName\\"},\s*\\"value\\":{\\"S\\":\\"([^"]*)\\"/g,
    replacement:
      '\\"type\\": {\\"S\\": \\"FamilyName\\"}, \\"value\\": {\\"***\\"}',
  },
  {
    regex: /\\"type\\":\s*\\"FamilyName\\",\s*\\"value\\":\\"([^"]*)\\"/g,
    replacement: '\\"type\\": \\"FamilyName\\", \\"value\\": \\"***\\"',
  },
  {
    regex: /\\"type\\":\s*\\"GivenName\\",\s*\\"value\\":\\"([^"]*)\\"/g,
    replacement: '\\"type\\": \\"GivenName\\", \\"value\\": \\"***\\"',
  },
  {
    regex: /\\\\\\"GivenName\\\\\\",\\\\\\"value\\\\\\":\\\\\\"([^"]*)\\\\\\"/g,
    replacement:
      '\\\\\\"GivenName\\\\\\",\\\\\\"value\\\\\\":\\\\\\"***\\\\\\"',
  },
  {
    regex:
      /\\\\\\"FamilyName\\\\\\",\\\\\\"value\\\\\\":\\\\\\"([^"]*)\\\\\\"/g,
    replacement:
      '\\\\\\"FamilyName\\\\\\",\\\\\\"value\\\\\\":\\\\\\"***\\\\\\"',
  },
];
