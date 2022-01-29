import { expect } from "chai";
import { constructKey } from "../src/models/balance";

describe("constructKey", () => {
  it("should handle empty account and meta correctly", () => {
    const result = constructKey("MyBook");
    expect(result).to.be.equal("MyBook");
  });

  it("should handle empty meta correctly", () => {
    const result = constructKey("MyBook", "Account");
    expect(result).to.be.equal("MyBook;Account");
  });

  it("should handle meta correctly", () => {
    const resultkey = "MyBook;Account;clientId.$in.0:12345,clientId.$in.1:67890,currency:USD";
    const result = constructKey("MyBook", "Account", { currency: "USD", clientId: { $in: ["12345", "67890"] } });
    expect(result).to.be.equal(resultkey);

    const result1 = constructKey("MyBook", "Account", { clientId: { $in: ["12345", "67890"] }, currency: "USD" });
    expect(result1).to.be.equal(resultkey);
  });
});
