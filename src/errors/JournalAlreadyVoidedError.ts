import { MediciError } from "./MediciError";

export class JournalAlreadyVoidedError extends MediciError {
  public code = 400;

  constructor(message = "Journal already voided.", code = 400) {
    super(message);
    this.code = code;
  }
}
