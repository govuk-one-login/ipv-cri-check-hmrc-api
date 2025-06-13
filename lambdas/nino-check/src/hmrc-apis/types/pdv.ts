export type PdvApiInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nino: string;
};

export type PdvApiResponseBody = {
  id: string;
  validationStatus: "success" | "failure";
  personalDetails: {
    firstName: string;
    lastName: string;
    nino: string;
    dateOfBirth: string;
  };
};

export type PdvApiErrorBody = {
  errors: string[];
};

export type PdvInvalidAuthBody = {
  code: "INVALID_CREDENTIALS";
};

export type PdvFunctionOutput = {
  httpStatus: number;
  body: string;
  parsedBody?: PdvApiResponseBody | PdvApiErrorBody | PdvInvalidAuthBody;
  txn: string;
};
