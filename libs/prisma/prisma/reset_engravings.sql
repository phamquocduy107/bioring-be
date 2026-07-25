-- Script reset dữ liệu Engravings & Orders để test lại từ đầu
-- Không chạm vào Master Data (materials, gemstones, products, users, roles, permissions...)

BEGIN;

-- 1. Gỡ bỏ liên kết vòng giữa engravings và engraving_versions
UPDATE engravings SET approved_version_id = NULL;

-- 2. Xóa các bảng con phụ thuộc vào Orders và Production Tasks
DELETE FROM qa_checks;
DELETE FROM production_tasks;

-- 3. Xóa các bảng con liên quan đến Đơn hàng (Orders)
DELETE FROM inventory_ledgers;
DELETE FROM payments;
DELETE FROM pickup_records;
DELETE FROM return_requests;
DELETE FROM shipments;
DELETE FROM staff_assignments;
DELETE FROM warranty_claims;
DELETE FROM warranties;

-- 4. Xóa bảng Đơn hàng (Orders)
DELETE FROM orders;

-- 5. Xóa các bảng con liên quan đến Engravings
DELETE FROM qr_memories;
DELETE FROM engraving_biometrics;
DELETE FROM engraving_versions;

-- 6. Xóa dữ liệu Sinh trắc học (Biometric Assets)
DELETE FROM biometric_assets;

-- 7. Xóa bảng Engravings chính
DELETE FROM engravings;

-- 8. Xóa các bản thiết kế nháp (Design Drafts) đã tạo khi test
DELETE FROM design_drafts;

COMMIT;
