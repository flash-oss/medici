import { expect } from "chai";
import { handleVoidMemo } from "../src/helper/handleVoidMemo";

describe("handleVoidMemo", () => {
  const cases = [
    ["should passthrough reason", "reason", "memo", "reason"],
    [
      "should handle no specially tagged memo when no reason was provided",
      undefined,
      "memo",
      "[VOID] memo",
    ],
    ["should handle unvoiding", undefined, "[VOID] memo", "[UNVOID] memo"],
    ["should handle revoiding", undefined, "[UNVOID] memo", "[REVOID] memo"],
    [
      "should handle unvoiding a revoided memo",
      undefined,
      "[REVOID] memo",
      "[UNVOID] memo",
    ],
  ];

  for (let i = 0, il = cases.length; i < il; i++) {
    it(cases[i][0], () => {
      expect(handleVoidMemo(cases[i][1], cases[i][2])).to.be.equal(cases[i][3]);
    });
  }
});
