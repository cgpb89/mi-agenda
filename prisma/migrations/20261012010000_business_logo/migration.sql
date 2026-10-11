-- Business logo for booking pages (Cloudinary reference, same shape as one
-- entry of `photos`). Shown only when the plan includes `brandColors`.
ALTER TABLE "app"."business_profiles" ADD COLUMN "logo" JSONB;

ALTER TABLE "app"."business_profiles"
  ADD CONSTRAINT "business_profiles_logo_object" CHECK ("logo" IS NULL OR jsonb_typeof("logo") = 'object');
