export type UserInfoEvent = {
  userInfoEvent: {
    Items: [
      {
        names: {
          L: [
            {
              M: {
                nameParts: {
                  L: [
                    {
                      M: {
                        type: {
                          S: string;
                        };
                        value: {
                          S: string;
                        };
                      };
                    },
                  ];
                };
              };
            },
          ];
        };
        birthDates: {
          L: [
            {
              M: {
                value: {
                  S: string;
                };
              };
            },
          ];
        };
      },
    ];
  };
  nino: string;
  govJourneyId: string;
};

export const mockUserInfoEventItem = {
  userInfoEvent: {
    Items: [
      {
        names: {
          L: [
            {
              M: {
                nameParts: {
                  L: [
                    { M: { type: { S: "GivenName" }, value: { S: "Rishi" } } },
                    {
                      M: { type: { S: "FamilyName" }, value: { S: "Johnson" } },
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    ],
  },
  nino: "BB000001D",
};

export const mockUserInfoEventItemWithBirthDates = {
  userInfoEvent: {
    Items: [
      {
        names: {
          L: [
            {
              M: {
                nameParts: {
                  L: [
                    { M: { type: { S: "GivenName" }, value: { S: "Rishi" } } },
                    {
                      M: { type: { S: "FamilyName" }, value: { S: "Johnson" } },
                    },
                  ],
                },
              },
            },
          ],
        },
        birthDates: {
          L: [
            { M: { value: { S: "2000-01-01" } } },
            { M: { value: { S: "1990-05-15" } } },
          ],
        },
      },
    ],
  },
  nino: "BB000001D",
};
