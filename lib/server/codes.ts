import "server-only";
import { randomInt } from "node:crypto";
import { CODE_ALPHABET } from "@/lib/codes";

export function generateCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}
