-- In-app guided tour progress per user: { "<tourId>": { "step": n, "done": bool } }.
ALTER TABLE "app"."users" ADD COLUMN "tour_progress" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "app"."users"
  ADD CONSTRAINT "users_tour_progress_object" CHECK (jsonb_typeof("tour_progress") = 'object');
