export const otherPatterns = [
  {
    regex: /\\"user_id\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\"user_id\\": \\"***\\"',
  },
  {
    regex: /\\\\"user_id\\\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\\\\\"user_id\\\\\\": \\"***\\"',
  },
  {
    regex: /\\\\\\"user_id\\\\\\":\\\\\\"([^"]*)\\\\\\"/g,
    replacement: '\\\\\\"user_id\\\\\\": \\\\\\"***\\\\\\"',
  },
  {
    regex: /\\\\"subject\\\\":\{\\\\"S\\\\":\\\\"([^"]*)\\\\"/g,
    replacement: '\\\\\\"subject\\\\": \\\\\\"***\\\\\\"',
  },
  {
    regex: /\\"subject\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\"subject\\": \\"***\\"',
  },
  {
    regex: /\\"subject\\":{\\"S\\": "\\"([^"]*)\\"}/g,
    replacement: '\\"subject\\":{\\"S\\": \\"***\\"}',
  },
  {
    regex: /\\"subject\\":\{\\"S\\":\\"([^"]*)\\"/g,
    replacement: '\\"subject\\":{\\"S\\":\\"***\\"',
  },
  {
    regex: /\\"token\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\"token\\": \\"***\\"',
  },
];
