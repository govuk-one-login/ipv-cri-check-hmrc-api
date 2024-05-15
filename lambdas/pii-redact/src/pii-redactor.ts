const personalNumberRegex = /\\"personalNumber\\":\s*\\"([^"]*)\\"/g;
const ninoRegex = /\\"nino\\":\s*\\"([^"]*)\\"/g;
const ipAddressRegex = /\\"ip_address\\":\s*\\"([^"]*)\\"/g;
const userIdRegex = /\\"user_id\\":\s*\\"([^"]*)\\"/g;
const firstNameRegex = /\\"firstName\\":\s*\\"([^"]*)\\"/g;
const lastNameRegex = /\\"lastName\\":\s*\\"([^"]*)\\"/g;
const birthDatesRegex =
  /\\"birthDates\\"\s*:\s*\{\s*\\"L\\"\s*:\s*\[\s*\{\s*\\"M\\"\s*:\s*\{\s*\\"value\\"\s*:\s*\{\s*\\"S\\"\s*:\s*\\"(\d{4}-\d{2}-\d{2})\\".*]\s*}/g;

const birthDateRegex = /\\"birthDate\\":\[{\\"value\\":\\"([^"]*)\\"}]/g;

const subjectRegex = /\\"subject\\":\s*\\"([^"]*)\\"/g;
const tokenRegex = /\\"token\\":\s*\\"([^"]*)\\"/g;
const dateOfBirthRegex = /\\"dateOfBirth\\":\s*\\"([^"]*)\\"/g;

const buildingNameRegex =
  /\\"buildingName\\"\s*:\s*{\s*\\"S\\"\s*:\s*\\"([^"]*)\\"/g;
const addressLocalityRegex =
  /\\"addressLocality\\"\s*:\s*{\s*\\"S\\"\s*:\s*\\"([^"]*)\\"/g;
const buildingNumberRegex =
  /\\"buildingNumber\\"\s*:\s*{\s*\\"S\\"\s*:\s*\\"([^"]*)\\"/g;
const postalCodeRegex =
  /\\"postalCode\\"\s*:\s*{\s*\\"S\\"\s*:\s*\\"([^"]*)\\"/g;
const streetNameRegex =
  /\\"streetName\\"\s*:\s*{\s*\\"S\\"\s*:\s*\\"([^"]*)\\"/g;

const givenNameRegex =
  /\\"type\\":{\\"S\\":\\"GivenName\\"},\s*\\"value\\":{\\"S\\":\\"([^"]*)\\"/g;
const familyNameRegex =
  /\\"type\\":{\\"S\\":\\"FamilyName\\"},\s*\\"value\\":{\\"S\\":\\"([^"]*)\\"/g;

const familyName2Regex =
  /\\"type\\":\s*\\"FamilyName\\",\s*\\"value\\":\\"([^"]*)\\"/g;

const givenName2Regex =
  /\\"type\\":\s*\\"GivenName\\",\s*\\"value\\":\\"([^"]*)\\"/g;

export const redactPII = (message: string) => {
  return message
    .replaceAll(userIdRegex, '"user_id": "***"')
    .replaceAll(dateOfBirthRegex, '"dateOfBirth": "***"')
    .replaceAll(firstNameRegex, '"firstName": "***"')
    .replaceAll(lastNameRegex, '"lastName": "***"')
    .replaceAll(birthDatesRegex, '"birthDates": "***"')
    .replaceAll(buildingNameRegex, '"buildingName": { "S": "***"')
    .replaceAll(addressLocalityRegex, '"addressLocality": { "S": "***"')
    .replaceAll(buildingNumberRegex, '"buildingNumber": { "S": "***"')
    .replaceAll(postalCodeRegex, '"postalCode": { "S": "***"')
    .replaceAll(streetNameRegex, '"streetName": { "S": "***"')
    .replaceAll(subjectRegex, '"subject": "***"')
    .replaceAll(
      givenNameRegex,
      '"type": { "S": "GivenName" }, "value": { "S": "***"'
    )
    .replaceAll(
      familyNameRegex,
      '"type": { "S": "FamilyName" }, "value": { "S": "***"'
    )
    .replaceAll(ninoRegex, '"nino": "***"')
    .replaceAll(ipAddressRegex, '"ip_address": "***"')
    .replaceAll(personalNumberRegex, '"personalNumber": "***"')
    .replaceAll(familyName2Regex, '"type": "FamilyName", "value": "***"')
    .replaceAll(givenName2Regex, '"type": "GivenName", "value": "***"')
    .replaceAll(birthDateRegex, '"birthDate":[{"value":"***"}]')
    .replaceAll(tokenRegex, '"token": "***"');
};
