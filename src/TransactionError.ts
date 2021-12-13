export class TransactionError extends Error {
  public httpStatusCode = 400;
  public total: number;

  constructor(message: string, total: number, httpStatusCode = 400) {
    super(message);
    this.total = total;
    this.httpStatusCode = httpStatusCode;
  }
}
