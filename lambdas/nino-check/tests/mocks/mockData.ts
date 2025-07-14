export const mockOtgToken = "gimme access";

export const mockPdvRes = {
  httpStatus: 200,
  errorBody: "",
  txn: "good",
};

export const mockPdvErrorRes = {
  httpStatus: 401,
  errorBody: {
    type: "matching_error",
    errorMessage: "CID returned no record",
  },
  txn: "good",
};

export const mockPdvDeceasedRes = {
  httpStatus: 424,
  errorBody: "Request to create account for a deceased user",
  txn: "good",
};

export const mockPdvInvalidCredsRes = {
  httpStatus: 400,
  errorBody: {
    type: "invalid_creds",
    errorMessage: "INVALID_CREDENTIALS",
  },
  txn: "good",
};
