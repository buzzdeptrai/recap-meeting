import { migration001 } from "./001_initial";
import { migration002 } from "./002_minutes";
import { migration003 } from "./003_search";
import { migration004 } from "./004_usage";
import { migration006 } from "./006_mark_label";
import { migration007 } from "./007_mark_updated_at";
import { migration008 } from "./008_auth";
import { migration009 } from "./009_list_indexes";
import { migration010 } from "./010_minutes_runs";
import { migration011 } from "./011_meeting_soft_delete";
import { migration012 } from "./012_minutes_translation";
import { migration013 } from "./013_meeting_notes";

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

/** Ordered list of all migrations. Append new ones; never edit an applied migration. */
export const migrations: readonly Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
  migration011,
  migration012,
  migration013,
];
