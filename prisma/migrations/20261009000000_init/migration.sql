-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "app";

-- CreateEnum
CREATE TYPE "app"."UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "app"."PlatformRole" AS ENUM ('NONE', 'ADMIN');

-- CreateEnum
CREATE TYPE "app"."TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CHURNED');

-- CreateEnum
CREATE TYPE "app"."Plan" AS ENUM ('TRIAL', 'STARTER', 'GROWTH', 'BUSINESS');

-- CreateEnum
CREATE TYPE "app"."BusinessCategory" AS ENUM ('BARBER', 'WELLNESS', 'CONSULT', 'FITNESS', 'SERVICES');

-- CreateEnum
CREATE TYPE "app"."BookingTemplate" AS ENUM ('BARBER', 'WELLNESS', 'CONSULT', 'FITNESS', 'SERVICES');

-- CreateEnum
CREATE TYPE "app"."PageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "app"."MembershipRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "app"."MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "app"."ServiceDays" AS ENUM ('ALL', 'WEEKDAYS', 'SATURDAYS');

-- CreateEnum
CREATE TYPE "app"."ExceptionType" AS ENUM ('CLOSED', 'CUSTOM_HOURS', 'BLOCK');

-- CreateEnum
CREATE TYPE "app"."AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "app"."AppointmentSource" AS ENUM ('ONLINE', 'PHONE', 'WALK_IN');

-- CreateEnum
CREATE TYPE "app"."CancelledBy" AS ENUM ('CUSTOMER', 'BUSINESS');

-- CreateEnum
CREATE TYPE "app"."PaymentKind" AS ENUM ('PAYMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "app"."PaymentMethod" AS ENUM ('CASH', 'CARD', 'OTHER');

-- CreateTable
CREATE TABLE "app"."users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "app"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "platform_role" "app"."PlatformRole" NOT NULL DEFAULT 'NONE',
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "user_agent" VARCHAR(256),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(48) NOT NULL,
    "status" "app"."TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "plan" "app"."Plan" NOT NULL DEFAULT 'TRIAL',
    "category" "app"."BusinessCategory" NOT NULL DEFAULT 'SERVICES',
    "timezone" VARCHAR(64) NOT NULL,
    "locale" VARCHAR(16) NOT NULL DEFAULT 'en-US',
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "country" CHAR(2) NOT NULL DEFAULT 'US',
    "suspended_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "app"."MembershipRole" NOT NULL,
    "status" "app"."MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."invitations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "role" "app"."MembershipRole" NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "invited_by_user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."business_profiles" (
    "tenant_id" UUID NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "tagline" VARCHAR(160),
    "description" VARCHAR(1000),
    "phone" VARCHAR(40),
    "email" VARCHAR(254),
    "address" VARCHAR(240),
    "hours_note" VARCHAR(240),
    "template" "app"."BookingTemplate" NOT NULL DEFAULT 'SERVICES',
    "page_status" "app"."PageStatus" NOT NULL DEFAULT 'DRAFT',
    "page_content" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "business_profiles_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "app"."booking_policies" (
    "tenant_id" UUID NOT NULL,
    "max_active_appointments_per_phone" INTEGER NOT NULL DEFAULT 2,
    "slot_interval_min" INTEGER NOT NULL DEFAULT 30,
    "min_notice_min" INTEGER NOT NULL DEFAULT 60,
    "max_advance_days" INTEGER NOT NULL DEFAULT 60,
    "cancellation_window_min" INTEGER NOT NULL DEFAULT 240,
    "require_email" BOOLEAN NOT NULL DEFAULT true,
    "auto_confirm" BOOLEAN NOT NULL DEFAULT true,
    "policy_text" VARCHAR(600),
    "updated_by_user_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "booking_policies_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "app"."services" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300),
    "duration_min" INTEGER NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "buffer_before_min" INTEGER NOT NULL DEFAULT 0,
    "buffer_after_min" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_online" BOOLEAN NOT NULL DEFAULT true,
    "available_on" "app"."ServiceDays" NOT NULL DEFAULT 'ALL',
    "max_advance_days" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."staff" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "display_name" VARCHAR(80) NOT NULL,
    "title" VARCHAR(80),
    "bio" VARCHAR(300),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."staff_services" (
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,

    CONSTRAINT "staff_services_pkey" PRIMARY KEY ("staff_id","service_id")
);

-- CreateTable
CREATE TABLE "app"."availability_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID,
    "day_of_week" INTEGER NOT NULL,
    "start_min" INTEGER NOT NULL,
    "end_min" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."availability_exceptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID,
    "type" "app"."ExceptionType" NOT NULL,
    "date" DATE NOT NULL,
    "end_date" DATE,
    "start_min" INTEGER,
    "end_min" INTEGER,
    "reason" VARCHAR(120),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."customers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phone_e164" VARCHAR(16),
    "email" VARCHAR(254),
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."appointments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ref_number" SERIAL NOT NULL,
    "customer_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "block_start_at" TIMESTAMPTZ(3) NOT NULL,
    "block_end_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "app"."AppointmentStatus" NOT NULL,
    "source" "app"."AppointmentSource" NOT NULL,
    "service_name_snapshot" VARCHAR(80) NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "quoted_price_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "contact_name" VARCHAR(120) NOT NULL,
    "contact_email" VARCHAR(254),
    "customer_note" VARCHAR(500),
    "internal_note" VARCHAR(1000),
    "manage_token_hash" VARCHAR(64),
    "idempotency_key" VARCHAR(64),
    "created_by_user_id" UUID,
    "confirmed_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "no_show_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_by" "app"."CancelledBy",
    "cancel_reason" VARCHAR(200),
    "reschedule_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."payment_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "kind" "app"."PaymentKind" NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "method" "app"."PaymentMethod" NOT NULL,
    "note" VARCHAR(200),
    "recorded_by_user_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_user_id" UUID,
    "void_reason" VARCHAR(200),

    CONSTRAINT "payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "actor_user_id" UUID,
    "actor_type" VARCHAR(16) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "target_type" VARCHAR(32),
    "target_id" VARCHAR(64),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."feature_flags" (
    "key" VARCHAR(48) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "note" VARCHAR(120),
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "app"."rate_limit_buckets" (
    "key" VARCHAR(64) NOT NULL,
    "window_start" TIMESTAMPTZ(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key","window_start")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "app"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "app"."sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "app"."sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "app"."sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "app"."password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "app"."password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "app"."tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "app"."tenants"("status");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "app"."memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_user_id_key" ON "app"."memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "app"."invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_tenant_id_idx" ON "app"."invitations"("tenant_id");

-- CreateIndex
CREATE INDEX "services_tenant_id_is_active_idx" ON "app"."services"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "services_tenant_id_id_key" ON "app"."services"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "staff_tenant_id_is_active_idx" ON "app"."staff"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "staff_tenant_id_id_key" ON "app"."staff"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_tenant_id_user_id_key" ON "app"."staff"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "staff_services_tenant_id_service_id_idx" ON "app"."staff_services"("tenant_id", "service_id");

-- CreateIndex
CREATE INDEX "availability_rules_tenant_id_staff_id_day_of_week_idx" ON "app"."availability_rules"("tenant_id", "staff_id", "day_of_week");

-- CreateIndex
CREATE INDEX "availability_exceptions_tenant_id_date_idx" ON "app"."availability_exceptions"("tenant_id", "date");

-- CreateIndex
CREATE INDEX "customers_tenant_id_name_idx" ON "app"."customers"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_id_key" ON "app"."customers"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_phone_e164_key" ON "app"."customers"("tenant_id", "phone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_ref_number_key" ON "app"."appointments"("ref_number");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_manage_token_hash_key" ON "app"."appointments"("manage_token_hash");

-- CreateIndex
CREATE INDEX "appointments_tenant_id_start_at_idx" ON "app"."appointments"("tenant_id", "start_at");

-- CreateIndex
CREATE INDEX "appointments_tenant_id_staff_id_start_at_idx" ON "app"."appointments"("tenant_id", "staff_id", "start_at");

-- CreateIndex
CREATE INDEX "appointments_tenant_id_customer_id_start_at_idx" ON "app"."appointments"("tenant_id", "customer_id", "start_at");

-- CreateIndex
CREATE INDEX "appointments_tenant_id_status_start_at_idx" ON "app"."appointments"("tenant_id", "status", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_tenant_id_id_key" ON "app"."appointments"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_tenant_id_idempotency_key_key" ON "app"."appointments"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "payment_records_tenant_id_recorded_at_idx" ON "app"."payment_records"("tenant_id", "recorded_at");

-- CreateIndex
CREATE INDEX "payment_records_tenant_id_appointment_id_idx" ON "app"."payment_records"("tenant_id", "appointment_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "app"."audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "app"."audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "app"."rate_limit_buckets"("expires_at");

-- AddForeignKey
ALTER TABLE "app"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "app"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."invitations" ADD CONSTRAINT "invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "app"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."invitations" ADD CONSTRAINT "invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."business_profiles" ADD CONSTRAINT "business_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "app"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."booking_policies" ADD CONSTRAINT "booking_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "app"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."booking_policies" ADD CONSTRAINT "booking_policies_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "app"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."services" ADD CONSTRAINT "services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "app"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."staff" ADD CONSTRAINT "staff_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "app"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."staff_services" ADD CONSTRAINT "staff_services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "app"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."staff_services" ADD CONSTRAINT "staff_services_tenant_id_staff_id_fkey" FOREIGN KEY ("tenant_id", "staff_id") REFERENCES "app"."staff"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."staff_services" ADD CONSTRAINT "staff_services_tenant_id_service_id_fkey" FOREIGN KEY ("tenant_id", "service_id") REFERENCES "app"."services"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."availability_rules" ADD CONSTRAINT "availability_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "app"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."availability_rules" ADD CONSTRAINT "availability_rules_tenant_id_staff_id_fkey" FOREIGN KEY ("tenant_id", "staff_id") REFERENCES "app"."staff"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."availability_exceptions" ADD CONSTRAINT "availability_exceptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "app"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."availability_exceptions" ADD CONSTRAINT "availability_exceptions_tenant_id_staff_id_fkey" FOREIGN KEY ("tenant_id", "staff_id") REFERENCES "app"."staff"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "app"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."appointments" ADD CONSTRAINT "appointments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "app"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."appointments" ADD CONSTRAINT "appointments_tenant_id_customer_id_fkey" FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "app"."customers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."appointments" ADD CONSTRAINT "appointments_tenant_id_service_id_fkey" FOREIGN KEY ("tenant_id", "service_id") REFERENCES "app"."services"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."appointments" ADD CONSTRAINT "appointments_tenant_id_staff_id_fkey" FOREIGN KEY ("tenant_id", "staff_id") REFERENCES "app"."staff"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."payment_records" ADD CONSTRAINT "payment_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "app"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."payment_records" ADD CONSTRAINT "payment_records_tenant_id_appointment_id_fkey" FOREIGN KEY ("tenant_id", "appointment_id") REFERENCES "app"."appointments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."payment_records" ADD CONSTRAINT "payment_records_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."payment_records" ADD CONSTRAINT "payment_records_voided_by_user_id_fkey" FOREIGN KEY ("voided_by_user_id") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "app"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
