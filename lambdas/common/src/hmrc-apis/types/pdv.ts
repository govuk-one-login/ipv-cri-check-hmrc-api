export type PdvApiInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nino: string;
};

export type PdvApiErrorJSON = {
  type: string,
  errorMessage: string
}

export type PdvApiErrorBody = PdvApiErrorJSON | string;

export type ParsedPdvMatchResponse = {
  httpStatus: number;
  errorBody: PdvApiErrorBody
  txn: string;
};

export type PdvConfig = { apiUrl: string; };
