export const dobPatterns = [
  {
    regex: /\\"dob\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\"dob\\": \\"***\\"',
  },
  {
    regex:
      /\\"birthDates\\"\s*:\s*\{\s*\\"L\\"\s*:\s*\[\s*\{\s*\\"M\\"\s*:\s*\{\s*\\"value\\"\s*:\s*\{\s*\\"S\\"\s*:\s*\\"(\d{4}-\d{2}-\d{2})\\".*]\s*}/g,
    replacement: '\\"birthDates\\": \\"***\\"',
  },
  {
    regex: /\\"birthDate\\":\[{\\"value\\":\\"([^"]*)\\"}]/g,
    replacement: '\\"birthDate\\":[{\\"value\\":\\"***\\"}]',
  },
  {
    regex:
      /\\\\\\"birthDate\\\\\\":\[\{\\\\\\"value\\\\\\":\\\\\\"([^"]*)\\\\\\"}/g,
    replacement:
      '\\\\\\"birthDate\\\\\\":[{\\\\\\"value\\\\\\":\\\\\\"***\\\\\\"}]',
  },
  {
    regex: /\\"dateOfBirth\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\"dateOfBirth\\": \\"***\\"',
  },
];
