-- Spec 125: color and icon on stock categories and locations, sub-locations, stock/home icons in the shared catalog.

-- Icons (the catalog of spec 058; group HOME already exists, these are the stock/home additions).
INSERT INTO "category_icons" ("name", "label_pt", "label_en", "group_key", "keywords", "common", "sort") VALUES
  ('fridge', 'Geladeira', 'Fridge', 'HOME', ARRAY['geladeira', 'refrigerador', 'fridge', 'refrigerator', 'cozinha']::text[], false, 252),
  ('snowflake', 'Congelado', 'Frozen', 'HOME', ARRAY['freezer', 'congelado', 'gelo', 'frozen', 'snowflake', 'ice']::text[], false, 253),
  ('leaf', 'Folha', 'Leaf', 'HOME', ARRAY['hortifrúti', 'verdura', 'folha', 'produce', 'leaf', 'vegetable']::text[], false, 254),
  ('food-drumstick', 'Carne', 'Meat', 'HOME', ARRAY['carne', 'frango', 'coxa', 'meat', 'chicken', 'drumstick']::text[], false, 255),
  ('food-steak', 'Bife', 'Steak', 'HOME', ARRAY['bife', 'carne', 'churrasco', 'steak', 'beef']::text[], false, 256),
  ('cow', 'Vaca', 'Cow', 'HOME', ARRAY['vaca', 'leite', 'laticínios', 'cow', 'milk', 'dairy']::text[], false, 257),
  ('spray-bottle', 'Spray de limpeza', 'Cleaning spray', 'HOME', ARRAY['limpeza', 'spray', 'desinfetante', 'cleaning', 'spray bottle']::text[], false, 258),
  ('toothbrush', 'Escova de dentes', 'Toothbrush', 'HOME', ARRAY['higiene', 'escova', 'dente', 'toothbrush', 'hygiene']::text[], false, 259),
  ('garage', 'Garagem', 'Garage', 'HOME', ARRAY['garagem', 'carro', 'garage', 'parking']::text[], false, 260),
  ('toolbox', 'Caixa de ferramentas', 'Toolbox', 'HOME', ARRAY['ferramentas', 'caixa', 'toolbox', 'tools', 'conserto']::text[], false, 261),
  ('shower', 'Banheiro', 'Bathroom', 'HOME', ARRAY['banheiro', 'chuveiro', 'banho', 'bathroom', 'shower']::text[], false, 262),
  ('bottle-wine', 'Garrafa', 'Bottle', 'HOME', ARRAY['garrafa', 'vinho', 'bebida', 'bottle', 'wine', 'drink']::text[], false, 263),
  ('cup-water', 'Copo d''água', 'Glass of water', 'HOME', ARRAY['copo', 'água', 'bebida', 'glass', 'water']::text[], false, 264),
  ('package-variant-closed', 'Caixa fechada', 'Closed box', 'HOME', ARRAY['caixa', 'pacote', 'embalagem', 'box', 'package']::text[], false, 265)
ON CONFLICT ("name") DO NOTHING;

-- Columns (nullable first, so the backfill can run).
ALTER TABLE "stock_categories" ADD COLUMN "color" VARCHAR(7), ADD COLUMN "icon" VARCHAR(64);
ALTER TABLE "stock_locations" ADD COLUMN "color" VARCHAR(7), ADD COLUMN "icon" VARCHAR(64), ADD COLUMN "parent_id" TEXT;

-- Backfill (FR 25): a name that matches a suggestion (trimmed, lowercased, accents removed, pt-BR or en-US) takes its
-- color and icon.
CREATE TEMP TABLE "stock_catalog_suggestion_appearance" (
  "kind" text NOT NULL, "name" text NOT NULL, "color" text NOT NULL, "icon" text NOT NULL
) ON COMMIT DROP;
INSERT INTO "stock_catalog_suggestion_appearance" ("kind", "name", "color", "icon") VALUES
  ('category', 'mercearia', '#F59E0B', 'cart'), ('category', 'groceries', '#F59E0B', 'cart'),
  ('category', 'hortifruti', '#22C55E', 'leaf'), ('category', 'produce', '#22C55E', 'leaf'),
  ('category', 'laticinios', '#60A5FA', 'cup'), ('category', 'dairy', '#60A5FA', 'cup'),
  ('category', 'carnes', '#EF4444', 'food-drumstick'), ('category', 'meat', '#EF4444', 'food-drumstick'),
  ('category', 'bebidas', '#3B82F6', 'bottle-soda'), ('category', 'drinks', '#3B82F6', 'bottle-soda'),
  ('category', 'limpeza', '#14B8A6', 'spray-bottle'), ('category', 'cleaning', '#14B8A6', 'spray-bottle'),
  ('category', 'higiene', '#8B5CF6', 'toothbrush'), ('category', 'hygiene', '#8B5CF6', 'toothbrush'),
  ('category', 'farmacia', '#EC4899', 'pill'), ('category', 'pharmacy', '#EC4899', 'pill'),
  ('category', 'casa/ferramentas', '#8A8F98', 'hammer-wrench'), ('category', 'home/tools', '#8A8F98', 'hammer-wrench'),
  ('location', 'despensa', '#F59E0B', 'archive'), ('location', 'pantry', '#F59E0B', 'archive'),
  ('location', 'geladeira', '#3B82F6', 'fridge'), ('location', 'fridge', '#3B82F6', 'fridge'),
  ('location', 'freezer', '#60A5FA', 'snowflake'),
  ('location', 'area de servico', '#14B8A6', 'washing-machine'), ('location', 'laundry', '#14B8A6', 'washing-machine'),
  ('location', 'garagem', '#8A8F98', 'garage'), ('location', 'garage', '#8A8F98', 'garage');

UPDATE "stock_categories" c SET "color" = s."color", "icon" = s."icon"
FROM "stock_catalog_suggestion_appearance" s
WHERE s."kind" = 'category' AND s."name" = lower(unaccent(btrim(c."name")));
UPDATE "stock_locations" l SET "color" = s."color", "icon" = s."icon"
FROM "stock_catalog_suggestion_appearance" s
WHERE s."kind" = 'location' AND s."name" = lower(unaccent(btrim(l."name")));

-- Children of a matched parent take its icon and color (two passes cover the three levels of categories).
UPDATE "stock_categories" c SET "color" = p."color", "icon" = p."icon"
FROM "stock_categories" p WHERE c."parent_id" = p."id" AND c."color" IS NULL AND p."color" IS NOT NULL;
UPDATE "stock_categories" c SET "color" = p."color", "icon" = p."icon"
FROM "stock_categories" p WHERE c."parent_id" = p."id" AND c."color" IS NULL AND p."color" IS NOT NULL;

-- Everything else gets the neutral pair (FR 13).
UPDATE "stock_categories" SET "color" = '#8A8F98', "icon" = 'package-variant' WHERE "color" IS NULL;
UPDATE "stock_locations" SET "color" = '#8A8F98', "icon" = 'package-variant' WHERE "color" IS NULL;

ALTER TABLE "stock_categories" ALTER COLUMN "color" SET NOT NULL, ALTER COLUMN "icon" SET NOT NULL;
ALTER TABLE "stock_locations" ALTER COLUMN "color" SET NOT NULL, ALTER COLUMN "icon" SET NOT NULL;
ALTER TABLE "stock_categories" ADD CONSTRAINT "stock_categories_color_check" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_color_check" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$');

-- Sub-locations: the name is unique among siblings (same shape as categories).
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "stock_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX "stock_locations_name_key";
CREATE UNIQUE INDEX "stock_locations_name_key" ON "stock_locations"("owner", "owner_id", COALESCE("parent_id", ''), lower("name"));
