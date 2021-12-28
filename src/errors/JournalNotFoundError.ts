import { MediciError } from "./MediciError";

export class JournalNotFoundError extends MediciError {
  public code = 404;

  constructor(message = "Journal could not be found.", code = 403) {
    super(message);
    this.code = code;
  }
}
