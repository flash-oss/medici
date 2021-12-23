import { Schema } from "mongoose";

export function extractObjectIdKeysFromSchema(schema: Schema) {
  const result: Set<string> = new Set();
  for (const [key, value] of Object.entries(schema.paths)) {
    if (value instanceof Schema.Types.ObjectId) {
      result.add(key);
    }
  }
  return result;
}
