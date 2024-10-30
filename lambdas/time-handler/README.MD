# Using TimeHandler to return epoch time values

## Overview

AWS Step Functions often require time values in epoch format, such as
the current time in seconds or milliseconds, or a future time representing an expiry.
The TimeHandler lambda simplifies generating these epoch time values.

### Description

The TimeHandler accepts an event object with a required value `govJourneyId`
(an OET requirement for all Check HMRC Lambdas), and optional `ttlValue` and `ttlUnit` parameters.
It returns an object with the following epoch values:

- seconds: Current time in seconds.
- milliseconds: Current time in milliseconds.
- expiry: Expiry time based on the ttlValue and ttlUnit inputs (defaults to the current time if not provided).

### Usage: Generating the Current Epoch Time

To obtain the current epoch time, simply call `TimeHandler` with an event containing only the `govJourneyId`. This will return an object with the `seconds`, `milliseconds`, and `expiry` values, where expiry equals the current time in seconds since `ttlValue` and `ttlUnit` are omitted.
The `ttlValue` defaults to `0` and the `ttlUnit` default to `seconds` when not specified.

```
const result = await timeHandler.handler({ govJourneyId }, {} as Context)
```

This usage is ideal when you need the current epoch time in either `seconds` or `milliseconds`,
e.g., to mark the start time of a task.

### Usage: Generating an Epoch Expiry

To set a specific `expiry` time, provide `ttlValue` and `ttlUnit`.
For example, to get an expiry `10 seconds` from now:

```
   const result = await timeHandler.handler(
          {
            govJourneyId,
            ttlValue: 10,
            ttlUnit: "seconds",
          } as TimeEvent,
          {} as Context
        );
```

Or to get an expiry `2 hours` from now:

```
   const result = await timeHandler.handler(
          {
            govJourneyId,
            ttlValue: 2,
            ttlUnit: "hours",
          } as TimeEvent,
          {} as Context
        );
```

Negative `ttlValue` values produce an `expiry` time in the past.
Supported `ttlUnit` options include `seconds`, `minutes`, `hours`, `days`, `months`, and `years`.
The function always returns the current epoch in `seconds`, `milliseconds`,
and an `expiry` based on ttlValue and ttlUnit.
