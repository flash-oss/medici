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
}
