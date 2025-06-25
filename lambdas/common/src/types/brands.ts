export type Brand<T, N extends string> = T & {
  ___brand___: N;
};

export type UnixSecondsTimestamp = Brand<number, "UnixSecondsTimestamp">;

export type ISO8601DateString = Brand<string, "ISO8601DateString">;
