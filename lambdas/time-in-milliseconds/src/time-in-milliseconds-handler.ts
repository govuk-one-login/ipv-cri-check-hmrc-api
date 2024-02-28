export const lambdaHandler = async (event: {
  dateTime: string;
}): Promise<number> => new Date(event.dateTime).valueOf();
