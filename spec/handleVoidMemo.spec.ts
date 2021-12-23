/* eslint sonarjs/no-duplicate-string: off, @typescript-eslint/no-non-null-assertion: off, security/detect-object-injection: off */
import { expect } from "chai";
import { handleVoidMemo } from "../src/helper/handleVoidMemo";

describe("handleVoidMemo", () => {
  const cases = [
    ["should passthrough reason", "reason", "memo", "reason"],
    ["should handle no specially tagged memo when no reason was provided", undefined, "memo", "[VOID] memo"],
    ["should handle unvoiding", undefined, "[VOID] memo", "[UNVOID] memo"],
    ["should handle revoiding", undefined, "[UNVOID] memo", "[REVOID] memo"],
    ["should handle unvoiding a revoided memo", undefined, "[REVOID] memo", "[UNVOID] memo"],
    ["should handle no reason and no memo", undefined, undefined, "[VOID]"],
  ];

  for (const c of cases) {
    it(c[0]!, () => {
      expect(handleVoidMemo(c[1], c[2])).to.be.equal(c[3]);
    });
  }
});
