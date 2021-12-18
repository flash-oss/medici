import { Schema } from "mongoose";

export function extractObjectIdKeysFromSchema(schema: Schema) {
  const keys = Object.keys(schema.paths);
  const result: Set<string> = new Set();
  for (let i = 0, il = keys.length; i < il; i++) {
    if (schema.paths[keys[i]] instanceof Schema.Types.ObjectId) {
      result.add(keys[i]);
    }
  }
  return result;
}
