-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "ai_session_id" UUID NOT NULL,
    "sender" VARCHAR(50),
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "guest_session_id" VARCHAR(255),
    "topic" VARCHAR(255),
    "summary" TEXT,
    "final_recommendation" JSONB,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "ai_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(255),
    "entity_name" VARCHAR(255),
    "entity_id" UUID,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" VARCHAR(100),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biometric_capture_items" (
    "id" UUID NOT NULL,
    "capture_session_id" UUID NOT NULL,
    "capture_type" VARCHAR(100),
    "raw_file_url" VARCHAR(500),
    "processed_file_url" VARCHAR(500),
    "svg_url" VARCHAR(500),
    "metadata" JSONB,
    "quality_score" DECIMAL(5,2),
    "upload_source" VARCHAR(50),
    "status" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "biometric_capture_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biometric_capture_sessions" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "engraving_id" UUID,
    "customer_id" UUID,
    "guest_customer_id" UUID,
    "staff_id" UUID,
    "device_id" UUID,
    "status" VARCHAR(100),
    "quality_score" DECIMAL(5,2),
    "staff_note" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "biometric_capture_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_themes" (
    "id" UUID NOT NULL,
    "theme_code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "default_bg_url" VARCHAR(500),
    "style_config" JSONB,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "card_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_drafts" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "guest_session_id" VARCHAR(255),
    "product_id" UUID,
    "ai_session_id" UUID,
    "selected_user_ring_size_id" UUID,
    "design_code" VARCHAR(50),
    "design_source" VARCHAR(100),
    "ring_style" VARCHAR(100),
    "ring_shape" VARCHAR(100),
    "ring_size" VARCHAR(50),
    "selected_material_id" UUID,
    "selected_gemstone_id" UUID,
    "customization_config" JSONB,
    "estimated_price" DECIMAL(18,2),
    "expires_at" TIMESTAMPTZ(6),
    "status" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "design_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_health_logs" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "cpu_usage" DECIMAL(5,2),
    "memory_usage" DECIMAL(5,2),
    "battery_level" DECIMAL(5,2),
    "error_message" TEXT,
    "logged_at" TIMESTAMPTZ(6),

    CONSTRAINT "device_health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engraving_biometrics" (
    "id" UUID NOT NULL,
    "engraving_id" UUID NOT NULL,
    "biometric_type" VARCHAR(50) NOT NULL,
    "required_channel" VARCHAR(50) NOT NULL,
    "raw_file_url" VARCHAR(500),
    "processed_svg_url" VARCHAR(500),
    "extra_data" JSONB,
    "status" VARCHAR(100) DEFAULT 'PENDING_CAPTURE',
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "engraving_biometrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engraving_versions" (
    "id" UUID NOT NULL,
    "engraving_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "selected_material_id" UUID,
    "selected_gemstone_id" UUID,
    "ring_size" VARCHAR(50),
    "ring_style" VARCHAR(100),
    "ring_shape" VARCHAR(100),
    "customization_config" JSONB,
    "preview_image_url" VARCHAR(500),
    "model_3d_url" VARCHAR(500),
    "production_file_url" VARCHAR(500),
    "status" VARCHAR(100),
    "manager_id" UUID,
    "manager_note" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "engraving_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engravings" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID,
    "unique_product_id" VARCHAR(100),
    "approved_version_id" UUID,
    "biometric_consent_at" TIMESTAMPTZ(6),
    "raw_biometric_deleted_at" TIMESTAMPTZ(6),
    "status" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "engravings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firmware_updates" (
    "id" UUID NOT NULL,
    "device_type" VARCHAR(100),
    "version" VARCHAR(100),
    "download_url" VARCHAR(500),
    "release_notes" TEXT,
    "released_at" TIMESTAMPTZ(6),

    CONSTRAINT "firmware_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gemstones" (
    "id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "carat" DECIMAL(10,2),
    "cut" VARCHAR(100),
    "color" VARCHAR(100),
    "clarity" VARCHAR(100),
    "certification_code" VARCHAR(255),
    "price" DECIMAL(18,2),
    "stock_quantity" INTEGER,
    "is_available" BOOLEAN DEFAULT true,

    CONSTRAINT "gemstones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_customers" (
    "id" UUID NOT NULL,
    "guest_code" VARCHAR(50),
    "full_name" VARCHAR(255),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "note" TEXT,
    "converted_user_id" UUID,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "guest_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_ledgers" (
    "id" UUID NOT NULL,
    "item_type" VARCHAR(100),
    "item_id" UUID,
    "transaction_type" VARCHAR(100),
    "quantity" DECIMAL(18,2),
    "unit" VARCHAR(50),
    "reference_order_id" UUID,
    "reference_warranty_claim_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "inventory_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_devices" (
    "id" UUID NOT NULL,
    "device_name" VARCHAR(255),
    "mac_address" VARCHAR(100),
    "ip_address" VARCHAR(100),
    "device_type" VARCHAR(100),
    "status" VARCHAR(50),
    "firmware_version" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "iot_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "purity" VARCHAR(100),
    "color" VARCHAR(100),
    "current_price_per_gram" DECIMAL(18,2),
    "stock_gram" DECIMAL(18,2),
    "last_updated" TIMESTAMPTZ(6),

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(255),
    "content" TEXT,
    "type" VARCHAR(100),
    "is_read" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_code" VARCHAR(50) NOT NULL,
    "user_id" UUID,
    "guest_customer_id" UUID,
    "design_draft_id" UUID,
    "order_type" VARCHAR(100),
    "package_type" VARCHAR(100),
    "capture_route" VARCHAR(50),
    "design_source" VARCHAR(100),
    "status" VARCHAR(100),
    "subtotal" DECIMAL(18,2),
    "service_fee" DECIMAL(18,2),
    "extra_fee" DECIMAL(18,2),
    "discount_amount" DECIMAL(18,2),
    "total_price" DECIMAL(18,2),
    "paid_amount" DECIMAL(18,2),
    "remaining_amount" DECIMAL(18,2),
    "note" TEXT,
    "created_by_staff_id" UUID,
    "approved_by_manager_id" UUID,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "warranty_claim_id" UUID,
    "payos_transaction_id" VARCHAR(255),
    "payment_code" VARCHAR(100),
    "amount" DECIMAL(18,2) NOT NULL,
    "payment_phase" VARCHAR(100),
    "method" VARCHAR(100),
    "status" VARCHAR(100),
    "is_refund" BOOLEAN DEFAULT false,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_records" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "store_staff_id" UUID,
    "receiver_name" VARCHAR(255),
    "receiver_phone" VARCHAR(50),
    "identity_note" TEXT,
    "proof_image_url" VARCHAR(500),
    "picked_up_at" TIMESTAMPTZ(6),

    CONSTRAINT "pickup_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_gemstones" (
    "product_id" UUID NOT NULL,
    "gemstone_id" UUID NOT NULL,

    CONSTRAINT "product_gemstones_pkey" PRIMARY KEY ("product_id","gemstone_id")
);

-- CreateTable
CREATE TABLE "product_materials" (
    "product_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,

    CONSTRAINT "product_materials_pkey" PRIMARY KEY ("product_id","material_id")
);

-- CreateTable
CREATE TABLE "production_tasks" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "engraving_id" UUID NOT NULL,
    "assigned_jeweler_id" UUID,
    "task_name" VARCHAR(255),
    "task_description" TEXT,
    "status" VARCHAR(100),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "production_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "base_material_id" UUID,
    "base_price" DECIMAL(18,2),
    "thumbnail_url" VARCHAR(500),
    "model_3d_url" VARCHAR(500),
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qa_checks" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "production_task_id" UUID,
    "checked_by_id" UUID,
    "result" VARCHAR(100),
    "checklist" JSONB,
    "proof_images" JSONB,
    "note" TEXT,
    "checked_at" TIMESTAMPTZ(6),

    CONSTRAINT "qa_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_memories" (
    "id" UUID NOT NULL,
    "engraving_id" UUID NOT NULL,
    "theme_id" UUID,
    "qr_code" VARCHAR(255) NOT NULL,
    "landing_page_url" VARCHAR(500),
    "access_pin_hash" VARCHAR(255),
    "card_title" VARCHAR(255),
    "greeting_message" TEXT,
    "custom_images" JSONB,
    "biometric_display_settings" JSONB,
    "is_locked" BOOLEAN DEFAULT false,
    "failed_attempts" INTEGER DEFAULT 0,
    "activated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "qr_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_memory_access_logs" (
    "id" UUID NOT NULL,
    "qr_memory_id" UUID NOT NULL,
    "accessed_by_user_id" UUID,
    "ip_address" VARCHAR(100),
    "user_agent" TEXT,
    "success" BOOLEAN,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "qr_memory_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_requests" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "requested_by_id" UUID,
    "reason" TEXT,
    "proof_images" JSONB,
    "status" VARCHAR(100),
    "resolution" TEXT,
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_ticket_updates" (
    "id" UUID NOT NULL,
    "service_ticket_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "old_status" VARCHAR(100),
    "new_status" VARCHAR(100),
    "note" TEXT,
    "images" JSONB,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "service_ticket_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_tickets" (
    "id" UUID NOT NULL,
    "ticket_code" VARCHAR(100),
    "warranty_claim_id" UUID NOT NULL,
    "assigned_staff_id" UUID,
    "assigned_jeweler_id" UUID,
    "service_type" VARCHAR(100),
    "description" TEXT,
    "status" VARCHAR(100),
    "received_product_at" TIMESTAMPTZ(6),
    "service_started_at" TIMESTAMPTZ(6),
    "service_completed_at" TIMESTAMPTZ(6),
    "result_note" TEXT,
    "cost_update" DECIMAL(18,2),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "service_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "address_id" UUID,
    "delivery_method" VARCHAR(100),
    "status" VARCHAR(100),
    "assigned_delivery_staff_id" UUID,
    "recipient_name" VARCHAR(255),
    "recipient_phone" VARCHAR(50),
    "shipping_address_text" TEXT,
    "tracking_code" VARCHAR(100),
    "tracking_url" VARCHAR(500),
    "estimated_delivery_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_assignments" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "order_id" UUID,
    "warranty_claim_id" UUID,
    "capture_session_id" UUID,
    "assignment_type" VARCHAR(100),
    "status" VARCHAR(100),
    "assigned_by_id" UUID,
    "assigned_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_shifts" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "shift_date" DATE,
    "start_time" TIME(6),
    "end_time" TIME(6),
    "max_tasks" INTEGER,
    "current_tasks" INTEGER,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "recipient_name" VARCHAR(255),
    "phone_number" VARCHAR(50),
    "full_address" TEXT,
    "ward" VARCHAR(100),
    "district" VARCHAR(100),
    "province" VARCHAR(100),
    "is_default" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_ring_sizes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" VARCHAR(100),
    "hand_side" VARCHAR(20),
    "finger_type" VARCHAR(50),
    "size_system" VARCHAR(50),
    "ring_size" VARCHAR(50),
    "diameter_mm" DECIMAL(6,2),
    "circumference_mm" DECIMAL(6,2),
    "measurement_method" VARCHAR(100),
    "measurement_source" VARCHAR(100),
    "guide_step_result" JSONB,
    "image_url" VARCHAR(500),
    "confidence_score" DECIMAL(5,2),
    "is_default" BOOLEAN DEFAULT false,
    "note" TEXT,
    "measured_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_ring_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255),
    "password_hash" VARCHAR(255),
    "full_name" VARCHAR(255),
    "phone" VARCHAR(50),
    "customer_type" VARCHAR(50),
    "skin_tone" VARCHAR(100),
    "preferences" JSONB,
    "is_vip" BOOLEAN DEFAULT false,
    "status" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranties" (
    "id" UUID NOT NULL,
    "engraving_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "warranty_code" VARCHAR(100),
    "warranty_type" VARCHAR(100),
    "issue_format" VARCHAR(50),
    "warranty_scope" JSONB,
    "issue_date" TIMESTAMPTZ(6),
    "expiry_date" TIMESTAMPTZ(6),
    "activated_at" TIMESTAMPTZ(6),
    "status" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "warranties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_claims" (
    "id" UUID NOT NULL,
    "claim_code" VARCHAR(100),
    "warranty_id" UUID,
    "order_id" UUID NOT NULL,
    "engraving_id" UUID NOT NULL,
    "requested_by_user_id" UUID,
    "guest_customer_id" UUID,
    "service_type" VARCHAR(100),
    "issue_description" TEXT,
    "proof_images" JSONB,
    "proof_videos" JSONB,
    "status" VARCHAR(100),
    "charge_status" VARCHAR(100),
    "extra_fee" DECIMAL(18,2),
    "manager_id" UUID,
    "manager_note" TEXT,
    "customer_confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "warranty_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "device_agent" VARCHAR(255),
    "ip_address" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "biometric_capture_items_capture_session_id_idx" ON "biometric_capture_items"("capture_session_id");

-- CreateIndex
CREATE INDEX "biometric_capture_sessions_device_id_idx" ON "biometric_capture_sessions"("device_id");

-- CreateIndex
CREATE INDEX "biometric_capture_sessions_order_id_idx" ON "biometric_capture_sessions"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_themes_theme_code_key" ON "card_themes"("theme_code");

-- CreateIndex
CREATE UNIQUE INDEX "design_drafts_design_code_key" ON "design_drafts"("design_code");

-- CreateIndex
CREATE INDEX "engraving_biometrics_engraving_id_idx" ON "engraving_biometrics"("engraving_id");

-- CreateIndex
CREATE INDEX "engraving_versions_engraving_id_idx" ON "engraving_versions"("engraving_id");

-- CreateIndex
CREATE UNIQUE INDEX "engravings_unique_product_id_key" ON "engravings"("unique_product_id");

-- CreateIndex
CREATE INDEX "engravings_order_id_idx" ON "engravings"("order_id");

-- CreateIndex
CREATE INDEX "engravings_status_idx" ON "engravings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "guest_customers_guest_code_key" ON "guest_customers"("guest_code");

-- CreateIndex
CREATE INDEX "guest_customers_phone_idx" ON "guest_customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "iot_devices_mac_address_key" ON "iot_devices"("mac_address");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_code_key" ON "orders"("order_code");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "orders_guest_customer_id_idx" ON "orders"("guest_customer_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_payment_code_key" ON "payments"("payment_code");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_slug_key" ON "permissions"("slug");

-- CreateIndex
CREATE INDEX "pickup_records_order_id_idx" ON "pickup_records"("order_id");

-- CreateIndex
CREATE INDEX "production_tasks_status_idx" ON "production_tasks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "qr_memories_engraving_id_key" ON "qr_memories"("engraving_id");

-- CreateIndex
CREATE UNIQUE INDEX "qr_memories_qr_code_key" ON "qr_memories"("qr_code");

-- CreateIndex
CREATE INDEX "qr_memories_theme_id_idx" ON "qr_memories"("theme_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "service_tickets_ticket_code_key" ON "service_tickets"("ticket_code");

-- CreateIndex
CREATE INDEX "service_tickets_status_idx" ON "service_tickets"("status");

-- CreateIndex
CREATE INDEX "service_tickets_warranty_claim_id_idx" ON "service_tickets"("warranty_claim_id");

-- CreateIndex
CREATE INDEX "shipments_order_id_idx" ON "shipments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "warranties_engraving_id_key" ON "warranties"("engraving_id");

-- CreateIndex
CREATE UNIQUE INDEX "warranties_warranty_code_key" ON "warranties"("warranty_code");

-- CreateIndex
CREATE INDEX "warranties_order_id_idx" ON "warranties"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_claims_claim_code_key" ON "warranty_claims"("claim_code");

-- CreateIndex
CREATE INDEX "warranty_claims_order_id_idx" ON "warranty_claims"("order_id");

-- CreateIndex
CREATE INDEX "warranty_claims_warranty_id_idx" ON "warranty_claims"("warranty_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_ai_session_id_fkey" FOREIGN KEY ("ai_session_id") REFERENCES "ai_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "biometric_capture_items" ADD CONSTRAINT "biometric_capture_items_capture_session_id_fkey" FOREIGN KEY ("capture_session_id") REFERENCES "biometric_capture_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "biometric_capture_sessions" ADD CONSTRAINT "biometric_capture_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "biometric_capture_sessions" ADD CONSTRAINT "biometric_capture_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "iot_devices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "biometric_capture_sessions" ADD CONSTRAINT "biometric_capture_sessions_engraving_id_fkey" FOREIGN KEY ("engraving_id") REFERENCES "engravings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "biometric_capture_sessions" ADD CONSTRAINT "biometric_capture_sessions_guest_customer_id_fkey" FOREIGN KEY ("guest_customer_id") REFERENCES "guest_customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "biometric_capture_sessions" ADD CONSTRAINT "biometric_capture_sessions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "biometric_capture_sessions" ADD CONSTRAINT "biometric_capture_sessions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "design_drafts" ADD CONSTRAINT "design_drafts_ai_session_id_fkey" FOREIGN KEY ("ai_session_id") REFERENCES "ai_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "design_drafts" ADD CONSTRAINT "design_drafts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "design_drafts" ADD CONSTRAINT "design_drafts_selected_gemstone_id_fkey" FOREIGN KEY ("selected_gemstone_id") REFERENCES "gemstones"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "design_drafts" ADD CONSTRAINT "design_drafts_selected_material_id_fkey" FOREIGN KEY ("selected_material_id") REFERENCES "materials"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "design_drafts" ADD CONSTRAINT "design_drafts_selected_user_ring_size_id_fkey" FOREIGN KEY ("selected_user_ring_size_id") REFERENCES "user_ring_sizes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "design_drafts" ADD CONSTRAINT "design_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "device_health_logs" ADD CONSTRAINT "device_health_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "iot_devices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "engraving_biometrics" ADD CONSTRAINT "engraving_biometrics_engraving_id_fkey" FOREIGN KEY ("engraving_id") REFERENCES "engravings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "engraving_versions" ADD CONSTRAINT "engraving_versions_engraving_id_fkey" FOREIGN KEY ("engraving_id") REFERENCES "engravings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "engraving_versions" ADD CONSTRAINT "engraving_versions_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "engraving_versions" ADD CONSTRAINT "engraving_versions_selected_gemstone_id_fkey" FOREIGN KEY ("selected_gemstone_id") REFERENCES "gemstones"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "engraving_versions" ADD CONSTRAINT "engraving_versions_selected_material_id_fkey" FOREIGN KEY ("selected_material_id") REFERENCES "materials"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "engravings" ADD CONSTRAINT "engravings_approved_version_id_fkey" FOREIGN KEY ("approved_version_id") REFERENCES "engraving_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "engravings" ADD CONSTRAINT "engravings_id_fkey" FOREIGN KEY ("id") REFERENCES "qr_memories"("engraving_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "engravings" ADD CONSTRAINT "engravings_id_fkey1" FOREIGN KEY ("id") REFERENCES "warranties"("engraving_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "engravings" ADD CONSTRAINT "engravings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "engravings" ADD CONSTRAINT "engravings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "guest_customers" ADD CONSTRAINT "guest_customers_converted_user_id_fkey" FOREIGN KEY ("converted_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventory_ledgers" ADD CONSTRAINT "inventory_ledgers_reference_order_id_fkey" FOREIGN KEY ("reference_order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventory_ledgers" ADD CONSTRAINT "inventory_ledgers_reference_warranty_claim_id_fkey" FOREIGN KEY ("reference_warranty_claim_id") REFERENCES "warranty_claims"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_approved_by_manager_id_fkey" FOREIGN KEY ("approved_by_manager_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_staff_id_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_design_draft_id_fkey" FOREIGN KEY ("design_draft_id") REFERENCES "design_drafts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_guest_customer_id_fkey" FOREIGN KEY ("guest_customer_id") REFERENCES "guest_customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_warranty_claim_id_fkey" FOREIGN KEY ("warranty_claim_id") REFERENCES "warranty_claims"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pickup_records" ADD CONSTRAINT "pickup_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pickup_records" ADD CONSTRAINT "pickup_records_store_staff_id_fkey" FOREIGN KEY ("store_staff_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_gemstones" ADD CONSTRAINT "product_gemstones_gemstone_id_fkey" FOREIGN KEY ("gemstone_id") REFERENCES "gemstones"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_gemstones" ADD CONSTRAINT "product_gemstones_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_materials" ADD CONSTRAINT "product_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_materials" ADD CONSTRAINT "product_materials_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "production_tasks" ADD CONSTRAINT "production_tasks_assigned_jeweler_id_fkey" FOREIGN KEY ("assigned_jeweler_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "production_tasks" ADD CONSTRAINT "production_tasks_engraving_id_fkey" FOREIGN KEY ("engraving_id") REFERENCES "engravings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "production_tasks" ADD CONSTRAINT "production_tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_base_material_id_fkey" FOREIGN KEY ("base_material_id") REFERENCES "materials"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "qa_checks" ADD CONSTRAINT "qa_checks_checked_by_id_fkey" FOREIGN KEY ("checked_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "qa_checks" ADD CONSTRAINT "qa_checks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "qa_checks" ADD CONSTRAINT "qa_checks_production_task_id_fkey" FOREIGN KEY ("production_task_id") REFERENCES "production_tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "qr_memories" ADD CONSTRAINT "qr_memories_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "card_themes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "qr_memory_access_logs" ADD CONSTRAINT "qr_memory_access_logs_accessed_by_user_id_fkey" FOREIGN KEY ("accessed_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "qr_memory_access_logs" ADD CONSTRAINT "qr_memory_access_logs_qr_memory_id_fkey" FOREIGN KEY ("qr_memory_id") REFERENCES "qr_memories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "service_ticket_updates" ADD CONSTRAINT "service_ticket_updates_service_ticket_id_fkey" FOREIGN KEY ("service_ticket_id") REFERENCES "service_tickets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "service_ticket_updates" ADD CONSTRAINT "service_ticket_updates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_assigned_jeweler_id_fkey" FOREIGN KEY ("assigned_jeweler_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_warranty_claim_id_fkey" FOREIGN KEY ("warranty_claim_id") REFERENCES "warranty_claims"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "user_addresses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_assigned_delivery_staff_id_fkey" FOREIGN KEY ("assigned_delivery_staff_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_capture_session_id_fkey" FOREIGN KEY ("capture_session_id") REFERENCES "biometric_capture_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_warranty_claim_id_fkey" FOREIGN KEY ("warranty_claim_id") REFERENCES "warranty_claims"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_ring_sizes" ADD CONSTRAINT "user_ring_sizes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_engraving_id_fkey" FOREIGN KEY ("engraving_id") REFERENCES "engravings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_guest_customer_id_fkey" FOREIGN KEY ("guest_customer_id") REFERENCES "guest_customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_warranty_id_fkey" FOREIGN KEY ("warranty_id") REFERENCES "warranties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
