import { personalNumberPatterns } from "./regex/personal-number";
import { ipAddressPatterns } from "./regex/ip-address";
import { namePatterns } from "./regex/name-pattern";
import { dobPatterns } from "./regex/date-of-birth";
import { addressPatterns } from "./regex/address";
import { ciPatterns } from "./regex/contra-indicator";
import { otherPatterns } from "./regex/uncategorised-patterns";

export const defaultPatterns = [
  ...personalNumberPatterns,
  ...ipAddressPatterns,
  ...namePatterns,
  ...dobPatterns,
  ...addressPatterns,
  ...ciPatterns,
  ...otherPatterns,
];

export function redactPII(message: string): string;

export function redactPII(
  message: string,
  patterns: { regex: RegExp; replacement: string }[],
  includeDefault?: boolean
): string;

export function redactPII(
  message: string,
  patterns?: { regex: RegExp; replacement: string }[],
  includeDefault: boolean = true
): string {
  if (!patterns) {
    patterns = defaultPatterns;
  }
  if (includeDefault) {
    patterns = patterns.concat(defaultPatterns);
  }
  return patterns.reduce((redactedMessage, pattern) => {
    return redactedMessage.replaceAll(pattern.regex, pattern.replacement);
  }, message);
}
