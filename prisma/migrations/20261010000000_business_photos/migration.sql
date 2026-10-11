-- Booking-page photos (Cloudinary references), at most 3 per business.
ALTER TABLE "app"."business_profiles" ADD COLUMN "photos" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "app"."business_profiles"
  ADD CONSTRAINT "business_profiles_photos_max" CHECK (
    jsonb_typeof("photos") = 'array' AND jsonb_array_length("photos") <= 3
  );
