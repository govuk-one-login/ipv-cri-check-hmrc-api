export function isRecordExpired(record: { expiryDate: number }) {
  // expiryDate is in Unix seconds, not milliseconds
  const now = Math.floor(Date.now() / 1000);
  return now > record.expiryDate;
}
