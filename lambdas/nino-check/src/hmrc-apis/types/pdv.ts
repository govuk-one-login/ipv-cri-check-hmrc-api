export type PdvApiInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nino: string;
};

export type PdvApiResponseBody = {
  firstName: string;
  lastName: string;
  nino: string;
  dateOfBirth: string;
};

export type PdvApiErrorBody = {
  errors: string;
};

export type PdvInvalidAuthBody = {
  code: "INVALID_CREDENTIALS";
  message: string;
};

export type PdvFunctionOutput = {
  httpStatus: number;
  body: string;
  parsedBody?: PdvApiResponseBody | PdvApiErrorBody | PdvInvalidAuthBody;
  txn: string;
};

export type PdvConfig = { apiUrl: string; userAgent: string };
