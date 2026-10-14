ALTER TABLE "fotos" ALTER COLUMN "dados" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fotos" ADD COLUMN "chave" text;