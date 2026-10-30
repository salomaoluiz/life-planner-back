// Prints the SQL of the category icons migration (spec 058) from prisma/data/category-icons.json.
// Usage: node scripts/build-category-icons-migration.mjs > prisma/migrations/20261030000100_category_icons/migration.sql
import { readFileSync } from 'node:fs';

const icons = JSON.parse(
  readFileSync(new URL('../prisma/data/category-icons.json', import.meta.url), 'utf8'),
);

const text = (value) => `'${value.replaceAll("'", "''")}'`;
const array = (values) => `ARRAY[${values.map(text).join(', ')}]::text[]`;

const rows = icons.map(
  (icon) =>
    `  (${text(icon.name)}, ${text(icon.labelPt)}, ${text(icon.labelEn)}, ${text(icon.group)}, ${array(icon.keywords)}, ${icon.common}, ${icon.sort})`,
);

process.stdout
  .write(`-- Spec 058: curated icon catalog with accent-insensitive full-text search (pt + en).
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Generated columns need immutable functions: thin wrappers over the stable built-ins.
CREATE OR REPLACE FUNCTION immutable_unaccent(input text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent', input) $$;

CREATE OR REPLACE FUNCTION immutable_array_to_string(input text[], separator text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT array_to_string(input, separator) $$;

CREATE TABLE "category_icons" (
  "name" text NOT NULL,
  "label_pt" text NOT NULL,
  "label_en" text NOT NULL,
  "group_key" text NOT NULL,
  "keywords" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "common" boolean NOT NULL DEFAULT false,
  "sort" integer NOT NULL,
  "search_text" text GENERATED ALWAYS AS (
    lower(immutable_unaccent("label_pt" || ' ' || "label_en" || ' ' || immutable_array_to_string("keywords", ' ')))
  ) STORED,
  "search" tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', immutable_unaccent("label_pt" || ' ' || "label_en" || ' ' || immutable_array_to_string("keywords", ' ')))
  ) STORED,
  CONSTRAINT "category_icons_pkey" PRIMARY KEY ("name")
);

CREATE INDEX "category_icons_search_idx" ON "category_icons" USING GIN ("search");
CREATE INDEX "category_icons_search_text_trgm_idx" ON "category_icons" USING GIN ("search_text" gin_trgm_ops);

INSERT INTO "category_icons" ("name", "label_pt", "label_en", "group_key", "keywords", "common", "sort") VALUES
${rows.join(',\n')};
`);
