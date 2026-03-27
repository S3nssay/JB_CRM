CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"inquiry_type" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"property_address" text,
	"postcode" text,
	"property_type" text,
	"bedrooms" integer,
	"message" text,
	"timeframe" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "london_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"postcode" text NOT NULL,
	"description" text NOT NULL,
	"investment_perspective" text NOT NULL,
	"market_analysis" text NOT NULL,
	"positive_aspects" text[] NOT NULL,
	"negative_aspects" text[] NOT NULL,
	"average_price" integer,
	"price_growth_percentage" numeric,
	"nearest_tube_station" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"price" integer NOT NULL,
	"price_qualifier" text,
	"property_type" text NOT NULL,
	"bedrooms" integer NOT NULL,
	"bathrooms" integer NOT NULL,
	"receptions" integer,
	"square_footage" integer,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"postcode" text NOT NULL,
	"area_id" integer NOT NULL,
	"tenure" text NOT NULL,
	"council_tax_band" text,
	"energy_rating" text,
	"year_built" integer,
	"features" text[],
	"amenities" text[],
	"images" text[],
	"floor_plan" text,
	"viewing_arrangements" text,
	"agent_contact" text,
	"rent_period" text,
	"furnished" text,
	"available_from" timestamp,
	"minimum_tenancy" integer,
	"deposit" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_inquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"inquiry_type" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"message" text,
	"preferred_viewing_times" text,
	"financial_position" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "valuations" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer NOT NULL,
	"property_address" text NOT NULL,
	"postcode" text NOT NULL,
	"property_type" text NOT NULL,
	"bedrooms" integer NOT NULL,
	"estimated_value" integer,
	"valuation_range" text,
	"comparable_properties" json,
	"market_conditions" text,
	"recommendations" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"valuation_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "email_idx" ON "users" USING btree ("email");