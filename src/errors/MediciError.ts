export class MediciError extends Error {
  public code = 500;

  constructor(message: string, code = 500) {
    super(message);
    this.code = code;
  }
}
