import { numberRE } from "./parseQuery";

export function parseDateField(value: any): Date {
  if (value instanceof Date) {
    return value;
  } else if (typeof value === "number") {
    return new Date(value);
  } else if (typeof value === "string" && numberRE.test(value)) {
    return new Date(parseInt(value));
  } else {
    return new Date(value);
  }
}
