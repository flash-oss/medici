import { MediciError } from "./MediciError";

export class BookConstructorError extends MediciError {
  public code = 400;

  constructor(message: string, code = 400) {
    super(message);
    this.code = code;
  }
}
