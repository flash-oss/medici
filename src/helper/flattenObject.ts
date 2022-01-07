import { IAnyObject } from "../IAnyObject";

export function flattenObject(obj?: IAnyObject, parent?: string, res: IAnyObject = {}) {
  if (!obj) return {};
  for (const [key, value] of Object.entries(obj)) {
    const propName = parent ? parent + "." + key : key;
    if (typeof obj[key] === "object") {
      flattenObject(value, propName, res);
    } else {
      res[propName] = value;
    }
  }
  return res;
}
