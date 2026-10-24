import type { GlossaryLang, GlossaryTerm, RepoContext, TermVariant } from "../types";

interface TermRow {
  id: string;
  term: string;
  lang: string;
  translation: string | null;
  do_not_translate: number;
  priority: number;
  created_at: string;
}

interface VariantRow {
  id: string;
  term_id: string;
  variant: string;
}

export interface CreateTermInput {
  term: string;
  lang: GlossaryLang;
  translation?: string | null;
  doNotTranslate?: boolean;
  priority?: number;
  variants?: string[];
}

export type UpdateTermInput = Partial<Omit<CreateTermInput, "variants">>;

const toVariant = (row: VariantRow): TermVariant => ({
  id: row.id,
  termId: row.term_id,
  variant: row.variant,
});

function toTerm(row: TermRow, variants: TermVariant[]): GlossaryTerm {
  return {
    id: row.id,
    term: row.term,
    lang: row.lang as GlossaryLang,
    translation: row.translation,
    doNotTranslate: row.do_not_translate === 1,
    priority: row.priority,
    createdAt: row.created_at,
    variants,
  };
}

function groupVariants(rows: VariantRow[]): Map<string, TermVariant[]> {
  const byTerm = new Map<string, TermVariant[]>();
  for (const row of rows) {
    const list = byTerm.get(row.term_id) ?? [];
    list.push(toVariant(row));
    byTerm.set(row.term_id, list);
  }
  return byTerm;
}

function getTerm({ db }: RepoContext, id: string): GlossaryTerm | undefined {
  const row = db.prepare<[string], TermRow>("SELECT * FROM glossary_terms WHERE id = ?").get(id);
  if (!row) return undefined;
  const variants = db
    .prepare<[string], VariantRow>("SELECT * FROM term_variants WHERE term_id = ? ORDER BY rowid")
    .all(id);
  return toTerm(row, variants.map(toVariant));
}

/** All terms, highest priority first, each with its variants. */
function listTerms({ db }: RepoContext, lang?: GlossaryLang): GlossaryTerm[] {
  const where = lang ? "WHERE lang = @lang" : "";
  const rows = db
    .prepare<{ lang?: string }, TermRow>(
      `SELECT * FROM glossary_terms ${where} ORDER BY priority DESC, term COLLATE NOCASE`,
    )
    .all(lang ? { lang } : {});
  const variants = groupVariants(
    db.prepare<[], VariantRow>("SELECT * FROM term_variants ORDER BY rowid").all(),
  );
  return rows.map((row) => toTerm(row, variants.get(row.id) ?? []));
}

function addVariant({ db, newId }: RepoContext, termId: string, variant: string): TermVariant {
  const id = newId();
  db.prepare("INSERT INTO term_variants (id, term_id, variant) VALUES (?, ?, ?)").run(
    id,
    termId,
    variant,
  );
  return { id, termId, variant };
}

function createTerm(ctx: RepoContext, input: CreateTermInput): GlossaryTerm {
  const id = ctx.newId();
  ctx.db
    .prepare(
      `INSERT INTO glossary_terms (id, term, lang, translation, do_not_translate, priority, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.term,
      input.lang,
      input.translation ?? null,
      input.doNotTranslate ? 1 : 0,
      input.priority ?? 0,
      ctx.now(),
    );
  for (const variant of input.variants ?? []) addVariant(ctx, id, variant);
  return getTerm(ctx, id) as GlossaryTerm;
}

function updateTerm(ctx: RepoContext, id: string, patch: UpdateTermInput) {
  const current = getTerm(ctx, id);
  if (!current) return undefined;
  const next = { ...current, ...patch };
  ctx.db
    .prepare(
      `UPDATE glossary_terms SET term = ?, lang = ?, translation = ?, do_not_translate = ?,
         priority = ? WHERE id = ?`,
    )
    .run(
      next.term,
      next.lang,
      next.translation ?? null,
      next.doNotTranslate ? 1 : 0,
      next.priority,
      id,
    );
  return getTerm(ctx, id);
}

function deleteById({ db }: RepoContext, table: "glossary_terms" | "term_variants", id: string) {
  return db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id).changes > 0;
}

export function createGlossaryRepository(ctx: RepoContext) {
  return {
    /** Inserts the term and its variants atomically. */
    create: ctx.db.transaction((input: CreateTermInput) => createTerm(ctx, input)),
    get: (id: string) => getTerm(ctx, id),
    list: (lang?: GlossaryLang) => listTerms(ctx, lang),
    update: (id: string, patch: UpdateTermInput) => updateTerm(ctx, id, patch),
    remove: (id: string) => deleteById(ctx, "glossary_terms", id),
    addVariant: (termId: string, variant: string) => addVariant(ctx, termId, variant),
    removeVariant: (variantId: string) => deleteById(ctx, "term_variants", variantId),
  };
}

export type GlossaryRepository = ReturnType<typeof createGlossaryRepository>;
