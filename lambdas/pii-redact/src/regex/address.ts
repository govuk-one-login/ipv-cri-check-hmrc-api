export const addressPatterns = [
  {
    regex: /\\"buildingName\\"\s*:\s*{\s*\\"S\\"\s*:\s*\\"([^"]*)\\"/g,
    replacement: '\\"buildingName\\": { \\"S\\": \\"***\\"',
  },
  {
    regex: /\\"addressLocality\\"\s*:\s*{\s*\\"S\\"\s*:\s*\\"([^"]*)\\"/g,
    replacement: '\\"addressLocality\\": { \\"S\\": \\"***\\"',
  },
  {
    regex: /\\"buildingNumber\\"\s*:\s*{\s*\\"S\\"\s*:\s*\\"([^"]*)\\"/g,
    replacement: '\\"buildingNumber\\": { \\"S\\": \\"***\\"',
  },
  {
    regex: /\\"postalCode\\"\s*:\s*{\s*\\"S\\"\s*:\s*\\"([^"]*)\\"/g,
    replacement: '\\"postalCode\\": { \\"S\\": \\"***\\"',
  },
  {
    regex: /\\"streetName\\"\s*:\s*{\s*\\"S\\"\s*:\s*\\"([^"]*)\\"/g,
    replacement: '\\"streetName\\": { \\"S\\": \\"***\\"',
  },
];
