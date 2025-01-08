export const ciPatterns = [
  {
    regex: /\\"reason\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\"reason\\": \\"***\\"',
  },
  {
    regex: /\\\\"reason\\\\":\s*\\\\"([^"]*)\\\\"/g,
    replacement: '\\\\"reason\\\\": \\\\"***\\\\"',
  },
  {
    regex: /\\\\\\"reason\\\\\\":\s*\\\\\\"([^"]*)\\\\\\"/g,
    replacement: '\\\\\\"reason\\\\\\": \\\\\\"***\\\\\\"',
  },
  {
    regex: /\\"ci\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\"ci\\": \\"***\\"',
  },
  {
    regex: /\\\\\\"ci\\\\\\":\s*\\\\\\"([^"]*)\\\\\\"/g,
    replacement: '\\\\\\"ci\\\\\\": \\\\\\"***\\\\\\"',
  },
  {
    regex: /\\\\\\"ci\\\\\\":\[\\\\\\"[^\\"]*\\\\\\"]/g,
    replacement: '\\\\\\"ci\\\\\\": [\\\\\\"***\\\\\\"]',
  },
  {
    regex: /\\"ci\\":\[\\"[^\\"]*\\"]/g,
    replacement: '\\"ci\\": [\\"***\\"]',
  },
  {
    regex: /\\"contraIndicationMapping\\"\s*:\s*\[[^\]]*]/g,
    replacement: '\\"contraindicationMapping\\": [\\"***\\"]',
  },
  {
    regex: /\\"contraindicationMappings\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\"contraindicationMappings\\": \\"***\\"',
  },
  {
    regex: /\\"contraindicatorReasonMappings\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\"contraindicatorReasonMappings\\": \\"***\\"',
  },
  {
    regex:
      /\\"Name\\":\s*\\"\/check-hmrc-cri-api\/contraindicationMappings\\",\s*\\"Value\\":\s*\\"([^"]*)\\/g,
    replacement:
      '\\"Name\\":\\"/check-hmrc-cri-api/contraindicationMappings\\",\\"Value\\":\\"***\\',
  },
];
