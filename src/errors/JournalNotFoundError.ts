export class JournalNotFoundError extends Error {
  public code = 403;

  constructor(message = "Journal could not be found.", code = 403) {
    super(message);
    this.code = code;
  }
}
