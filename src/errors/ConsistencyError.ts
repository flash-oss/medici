import { MediciError } from "./MediciError";

export class ConsistencyError extends MediciError {
  public code = 400;

  constructor(message = "medici ledge consistency harmed", code = 400) {
    super(message);
    this.code = code;
  }
}
