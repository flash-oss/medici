export class InvalidAccountPathLengthError extends Error {
  public code = 400;

  constructor(message: string, code = 400) {
    super(message);
    this.code = code;
  }
}
