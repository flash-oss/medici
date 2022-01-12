import { IAnyObject } from "../IAnyObject";

export function flattenObject(obj?: IAnyObject, parent?: string, deep = false, res: IAnyObject = {}) {
  if (!obj) return {};
  for (const [key, value] of Object.entries(obj)) {
    const propName = parent ? parent + "." + key : key;
    if (deep && typeof obj[key] === "object") {
      flattenObject(value, propName, deep, res);
    } else {
      res[propName] = value;
    }
  }
  return res;
}
