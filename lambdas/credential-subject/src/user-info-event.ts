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
                    }
                  ];
                };
              };
            }
          ];
        };
        nino: {
          S: string;
        };
      }
    ];
  };
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
        nino: {
          S: "BB000001D",
        },
      },
    ],
  },
};
