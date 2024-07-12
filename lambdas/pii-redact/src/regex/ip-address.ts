export const ipAddressPatterns = [
  {
    regex:
      /((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)/g,
    replacement: "***",
  },
  {
    regex: /\\"X-Forwarded-For\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\"X-Forwarded-For\\": \\"***\\"',
  },
  {
    regex: /\\"clientIpAddress\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\"clientIpAddress\\": \\"***\\"',
  },
  {
    regex: /\\"clientIpAddress\\":{\\"S\\":"\\"([^"]*)\\"}/g,
    replacement: '\\"nino\\":{\\"S\\":\\"***\\"}',
  },
  {
    regex: /\\"clientIpAddress\\":\{\\"S\\":\\"([^"]*)\\"}/g,
    replacement: '\\"clientIpAddress\\":{\\"S\\":\\"***\\"}',
  },
  {
    regex: /\\"ip_address\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\"ip_address\\": \\"***\\"',
  },
  {
    regex: /\\\\"ip_address\\\\":\s*\\"([^"]*)\\"/g,
    replacement: '\\\\\\"ip_address\\\\\\": \\"***\\"',
  },
  {
    regex: /"ip":\s*"([^"]*)"/g,
    replacement: '"ip": "***"',
  },
];
