export const input = (nino?: string) => ({
  sessionId: "123456789",
  nino: nino || "AA000003D",
});

export const user = (stateMachineInput = input()) => ({
  nino: stateMachineInput.nino,
  dob: "1948-04-23",
  firstName: "Jim",
  lastName: "Ferguson",
});

export const isValidTimestamp = (timestamp: number) =>
  !isNaN(new Date(timestamp).getTime());
