ALTER TABLE "tasks" ADD COLUMN "title_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "description_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "source_locale" varchar(8) DEFAULT 'en' NOT NULL;--> statement-breakpoint
UPDATE "tasks"
SET
  "source_locale" = CASE
    WHEN "language_tag" = 'zh' THEN 'zh'
    ELSE 'en'
  END,
  "title_i18n" = jsonb_build_object(
    CASE
      WHEN "language_tag" = 'zh' THEN 'zh'
      ELSE 'en'
    END,
    "title"
  ),
  "description_i18n" = CASE
    WHEN coalesce(trim("description"), '') = '' THEN '{}'::jsonb
    ELSE jsonb_build_object(
      CASE
        WHEN "language_tag" = 'zh' THEN 'zh'
        ELSE 'en'
      END,
      "description"
    )
  END;--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "language_tag";
