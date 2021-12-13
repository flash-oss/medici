import { ObjectId } from "mongodb";
import { Book } from "../Book";
import { isValidTransactionKey } from "../models/transactions";

interface IParseQuery {
	account?: string | string[];
	_journal?: any;
	start_date?: string;
	end_date?: string;
	[key: string]: any;
}

/**
 * Turn query into an object readable by MongoDB.
 *
 * @param query {{account: {acct, subacct, subsubacct}, start_date, month_date, meta}}
 * @returns {Object}
 */
export function parseQuery(query: IParseQuery, book: Pick<Book, "name">): { [key: string]: any; } {
	let account, end_date, start_date;
	const parsed: { [key: string]: any } = {};
	if ((account = query.account)) {
		let accounts, i;
		if (account instanceof Array) {
			const $or = [];
			for (const acct of account) {
				accounts = acct.split(":");
				const match: { [key: string]: any } = {};
				for (i = 0; i < accounts.length; i++) {
					match[`account_path.${i}`] = accounts[i];
				}
				$or.push(match);
			}
			parsed["$or"] = $or;
		} else {
			accounts = account.split(":");
			for (i = 0; i < accounts.length; i++) {
				parsed[`account_path.${i}`] = accounts[i];
			}
		}
		delete query.account;
	}

	if (query._journal) {
		parsed["_journal"] = query._journal;
	}

	if (query.start_date && query.end_date) {
		start_date = new Date(query.start_date);
		end_date = new Date(query.end_date);
		parsed["datetime"] = {
			$gte: start_date,
			$lte: end_date
		};
		delete query.start_date;
		delete query.end_date;
	} else if (query.start_date) {
		parsed["datetime"] = { $gte: new Date(parseInt(query.start_date)) };
		delete query.start_date;
	} else if (query.end_date) {
		parsed["datetime"] = { $lte: new Date(parseInt(query.end_date)) };
		delete query.end_date;
	}

	for (const key in query) {
		let val = query[key];
		if (isValidTransactionKey(key)) {
			// If it starts with a _ assume it's a reference
			if (key.substring(0, 1) === "_" && val instanceof String) {
				val = new ObjectId(val as string);
			}
			parsed[key] = val;
		} else {
			// Assume *_id is an OID
			if (key.indexOf("_id") !== -1) {
				val = new ObjectId(val);
			}

			parsed[`meta.${key}`] = val;
		}
	}

	parsed.book = book.name;

	parsed.approved = true;

	return parsed;
}