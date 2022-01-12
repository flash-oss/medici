import { MediciError } from "./MediciError";

export class TransactionError extends MediciError {
  public code = 400;
  public total: number;

  constructor(message: string, total: number, code = 400) {
    super(message);
    this.total = total;
    this.code = code;
  }
}
