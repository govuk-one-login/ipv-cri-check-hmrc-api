export type SignerPayLoad = {
  kid?: string;
  header: string;
  claimsSet: string;
};

export type SignerHeader = {
  kid?: string;
  type: string;
  alg: string;
};
