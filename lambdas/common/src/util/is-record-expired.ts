export function isRecordExpired(record: { expiryDate: number }) {
  const now = Math.floor(Date.now() / 1000);
  return now > record.expiryDate;
}
