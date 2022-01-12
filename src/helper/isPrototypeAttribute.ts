const reservedWords: Set<string> = new Set([
  "__proto__",
  "__defineGetter__",
  "__lookupGetter__",
  "__defineSetter__",
  "__lookupSetter__",
  "constructor",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toString",
  "toLocaleString",
  "valueOf",
]);

/**
 * Check if a key is a reserved word to avoid any prototype-pollution.
 */
export function isPrototypeAttribute(value: string): boolean {
  return reservedWords.has(value);
}
