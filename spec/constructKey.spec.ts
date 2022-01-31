import { expect } from "chai";
import { constructKey, hashKey } from "../src/models/balance";

describe("constructKey", () => {
  it("should handle empty account and meta", () => {
    const result = constructKey("MyBook");
    expect(result).to.be.equal(hashKey("MyBook"));
  });

  it("should handle empty meta", () => {
    const result = constructKey("MyBook", "Account");
    expect(result).to.be.equal(hashKey("MyBook;Account"));
  });

  it("should handle meta with same keys but different order", () => {
    const resultKey = hashKey("MyBook;Account;clientId.$in.0:12345,clientId.$in.1:67890,currency:USD");

    const result1 = constructKey("MyBook", "Account", { currency: "USD", clientId: { $in: ["12345", "67890"] } });
    expect(result1).to.be.equal(resultKey);

    const result2 = constructKey("MyBook", "Account", { clientId: { $in: ["12345", "67890"] }, currency: "USD" });
    expect(result2).to.be.equal(resultKey);

    expect(result1).to.equal(result2);
  });
});
