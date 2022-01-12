const numberRE = /^\d+$/;

export function parseDateField(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return value;
  } else if (typeof value === "number") {
    return new Date(value);
  } else if (typeof value === "string" && numberRE.test(value)) {
    return new Date(parseInt(value));
  } else if (typeof value === "string") {
    return new Date(value);
  }

  // Using JS type auto conversion. This code can lose milliseconds. By design.
  // Consider throwing exception in the next breaking release.
  const parsed = Date.parse(value as string);
  if (parsed) return new Date(parsed);
}

export type IDateFilter = {
  $gte?: Date;
  $lte?: Date;
};

export function parseDateQuery(start_date: unknown, end_date: unknown): IDateFilter {
  const datetime: IDateFilter = {};

  if (start_date) {
    datetime.$gte = parseDateField(start_date);
  }
  if (end_date) {
    datetime.$lte = parseDateField(end_date);
  }

  return datetime;
}
