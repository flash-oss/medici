import { expect } from "chai";
import { Schema } from "mongoose";
import { extractObjectIdKeysFromSchema } from "../src/helper/extractObjectIdKeysFromSchema";

describe("extractObjectIdKeysFromSchema", () => {
  it("should get an array of the ObjectId-fields", () => {
    const testSchema = new Schema({
      _journal: Schema.Types.ObjectId,
      test: String,
    });

    const result = extractObjectIdKeysFromSchema(testSchema);
    expect(result.size).be.equal(2);
    expect(result.has("_id")).to.be.true;
    expect(result.has("_journal")).to.be.true;
    expect(result.has("test")).to.be.false;
  });
});
