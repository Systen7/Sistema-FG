CREATE TYPE "public"."situacao_documento" AS ENUM('autorizado', 'encerrado', 'cancelado', 'sem_protocolo');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('cte', 'mdfe');--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"viagem_id" integer,
	"tipo" "tipo_documento" NOT NULL,
	"chave" text NOT NULL,
	"numero" integer NOT NULL,
	"serie" integer NOT NULL,
	"emitido_em" timestamp with time zone NOT NULL,
	"situacao" "situacao_documento" NOT NULL,
	"protocolo" text,
	"emitente" text,
	"remetente" text,
	"destinatario" text,
	"origem" text,
	"destino" text,
	"produto" text,
	"peso_kg" numeric(10, 2),
	"valor" integer,
	"placa" text,
	"chaves_cte" jsonb,
	"encerrado_em" timestamp with time zone,
	"xml" text NOT NULL,
	"pdf_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documentos_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_viagem_id_viagens_id_fk" FOREIGN KEY ("viagem_id") REFERENCES "public"."viagens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_pdf_id_fotos_id_fk" FOREIGN KEY ("pdf_id") REFERENCES "public"."fotos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documentos_viagem_idx" ON "documentos" USING btree ("viagem_id");