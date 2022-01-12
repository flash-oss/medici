/* eslint @typescript-eslint/no-non-null-assertion: off */
import { expect } from "chai";
import { parseDateField } from "../src/helper/parse/parseDateField";
import * as moment from "moment";
import { DateTime } from "luxon";

describe("parseDateField", () => {
  it("should passthrough Date-Objects", () => {
    const date = new Date();
    const parsedDate = parseDateField(date);

    expect(parsedDate).to.be.instanceOf(Date);
    expect(parsedDate).to.be.equal(date);
  });

  it("should handle numbers as unix timestamps", () => {
    const parsedDate = parseDateField(50)!;

    expect(parsedDate).to.be.instanceOf(Date);
    expect(parsedDate.getTime()).to.be.equal(50);
  });

  it("should handle strings of numbers as unix timestamps", () => {
    const parsedDate = parseDateField("50")!;

    expect(parsedDate).to.be.instanceOf(Date);
    expect(parsedDate.getTime()).to.be.equal(50);
  });

  it("should handle strings which are not pure numbers gracefully", () => {
    const date = new Date(1639577227000);
    const parsedDate = parseDateField(date.toUTCString())!;

    expect(parsedDate).to.be.instanceOf(Date);
    expect(parsedDate.getTime()).to.be.equal(date.getTime());
  });

  it("should handle moment.js, luxon and similar libraries", () => {
    const m = moment();
    const parsedDate1 = parseDateField(m)!;

    expect(parsedDate1).to.be.instanceOf(Date);
    // Unfortunately, automatic conversion from moment looses milliseconds.
    // We should consider throwing exceptions in the next big breaking release.
    expect(Math.floor(parsedDate1.getTime() / 1000)).to.be.equal(m.unix());

    const l = DateTime.now();
    const parsedDate2 = parseDateField(l)!;

    expect(parsedDate2).to.be.instanceOf(Date);
    // Unfortunately, automatic conversion from moment looses milliseconds.
    // We should consider throwing exceptions in the next big breaking release.
    expect(Math.floor(parsedDate2.getTime() / 1000)).to.be.equal(Math.floor(l.toSeconds()));
  });

  it("should return undefined if it is not parsable", () => {
    const date = true;
    const parsedDate = parseDateField(date);

    expect(parsedDate).to.be.undefined;
  });
});
