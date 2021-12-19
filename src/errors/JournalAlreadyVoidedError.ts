export class JournalAlreadyVoidedError extends Error {
  public code = 400;

  constructor(message = "Journal already voided.", code = 400) {
    super(message);
    this.code = code;
  }
}
