-- Spec 043: tags (single-scope or ALL), their scopes and the links to transactions and recurrences.
CREATE TABLE "financial_tags" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "owner" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "all_scopes" BOOLEAN NOT NULL DEFAULT false,
    "creator_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial_tag_scopes" (
    "id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "owner" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,

    CONSTRAINT "financial_tag_scopes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial_transaction_tags" (
    "transaction_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "financial_transaction_tags_pkey" PRIMARY KEY ("transaction_id","tag_id")
);

CREATE TABLE "financial_recurrence_tags" (
    "recurrence_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "financial_recurrence_tags_pkey" PRIMARY KEY ("recurrence_id","tag_id")
);

CREATE INDEX "financial_tags_owner_owner_id_idx" ON "financial_tags"("owner", "owner_id");
CREATE INDEX "financial_tag_scopes_owner_owner_id_idx" ON "financial_tag_scopes"("owner", "owner_id");
CREATE UNIQUE INDEX "financial_tag_scopes_tag_id_owner_owner_id_key" ON "financial_tag_scopes"("tag_id", "owner", "owner_id");
CREATE INDEX "financial_transaction_tags_tag_id_idx" ON "financial_transaction_tags"("tag_id");
CREATE INDEX "financial_recurrence_tags_tag_id_idx" ON "financial_recurrence_tags"("tag_id");

-- The name rule of a single-scope tag (ALL tags are checked in the use cases).
CREATE UNIQUE INDEX "financial_tags_scope_name_key" ON "financial_tags"("owner", "owner_id", lower("name")) WHERE "all_scopes" = false;

ALTER TABLE "financial_tag_scopes" ADD CONSTRAINT "financial_tag_scopes_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "financial_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_transaction_tags" ADD CONSTRAINT "financial_transaction_tags_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "financial_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_transaction_tags" ADD CONSTRAINT "financial_transaction_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "financial_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_recurrence_tags" ADD CONSTRAINT "financial_recurrence_tags_recurrence_id_fkey" FOREIGN KEY ("recurrence_id") REFERENCES "financial_recurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_recurrence_tags" ADD CONSTRAINT "financial_recurrence_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "financial_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
