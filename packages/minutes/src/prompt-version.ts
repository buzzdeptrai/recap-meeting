/**
 * Version of the prompt semantics in prompts.ts. Stored with every generated minutes so a newer
 * version marks old minutes stale ("prompt updated").
 *
 * MUST be bumped whenever prompts.ts changes meaning (rules, schema instructions, wording that
 * changes output). `test/prompt-version.test.ts` pins a hash of the prompt text and fails until
 * this constant and the pin are updated together.
 *
 * History: "2" = transcript injection tags + keep English terms in Vietnamese output.
 */
export const PROMPT_VERSION = "2";
