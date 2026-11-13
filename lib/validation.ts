// zod schemas shared by forms (client) and server actions.
import { z } from "zod";
import { CODE_RE, normalizeCode } from "./codes";
import { isPlainDate } from "./dates";

export const pinSchema = z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits.");

export const memberNameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, "Enter a name.").max(20, "Names can be up to 20 characters."));

export const leagueNameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(
    z.string().min(1, "Enter a league name.").max(40, "League names can be up to 40 characters."),
  );

export const codeSchema = z
  .string()
  .transform(normalizeCode)
  .pipe(z.string().regex(CODE_RE, "Codes are 6 letters/numbers, like K7QX2M."));

export const plainDateSchema = z.string().refine(isPlainDate, "Invalid date.");
export const uuidSchema = z.uuid();

export const pointsTableSchema = z
  .array(z.number().int("Whole numbers only.").min(0, "No negatives.").max(1000))
  .min(1, "Enter at least one value.")
  .max(20, "Up to 20 places.")
  .refine(
    (a) => a.every((v, i) => i === 0 || v <= a[i - 1]),
    "Points can't go up for a lower place.",
  );

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color.");

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .transform((s) => (s === "" ? null : s))
  .refine(
    (s) => s === null || /^https?:\/\/\S+$/i.test(s),
    "Links must start with http:// or https://",
  )
  .nullable();

export const gameFieldsSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name.").max(40),
    entry_prompt: z.string().trim().min(1, "Tell players exactly what to enter.").max(300),
    entry_example: z.string().trim().max(60),
    input_type: z.enum(["integer", "decimal", "time"]),
    min: z.number().finite(),
    max: z.number().finite(),
    direction: z.enum(["lower_is_better", "higher_is_better"]),
    allow_fail: z.boolean(),
    color: hexColor,
    url: optionalUrl,
    unit_label: z
      .string()
      .trim()
      .max(12)
      .transform((s) => (s === "" ? null : s))
      .nullable(),
  })
  .refine((g) => g.min <= g.max, {
    message: "Min must be less than or equal to max.",
    path: ["max"],
  })
  .refine(
    (g) => g.input_type === "decimal" || (Number.isInteger(g.min) && Number.isInteger(g.max)),
    {
      message: "Whole numbers only for this input type.",
      path: ["min"],
    },
  );

export type GameFields = z.infer<typeof gameFieldsSchema>;

export const suggestionSchema = z.object({
  name: z.string().trim().min(1, "Enter the game's name.").max(40),
  url: optionalUrl,
  description: z.string().trim().max(500),
});

export function firstError(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Invalid input.";
}
