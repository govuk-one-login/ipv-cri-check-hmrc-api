export type SignerPayLoad = {
  kid?: string;
  header: string;
  claimsSet: string;
  govJourneyId: string;
};

export type SignerHeader = {
  kid: string;
  typ: string;
  alg: string;
};
