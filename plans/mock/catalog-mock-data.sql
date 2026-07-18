-- ============================================================
-- Mock data for Catalog APIs
-- APIs:
--   GET /api/v1/products          -> GetProductsResponse  { products[], total, page, limit }
--   GET /api/v1/products/{id}     -> GetProductByIdResponse { product }
--   GET /api/v1/materials         -> GetMaterialsResponse { materials[] }
--   GET /api/v1/gemstones         -> GetGemstonesResponse { gemstones[] }
--
-- Usage: psql -U <user> -d <db> -f catalog-mock-data.sql
-- Safe to re-run (deletes old data first).
-- ============================================================

BEGIN;

-- Xóa dữ liệu cũ (thứ tự reverse do foreign key)
DELETE FROM product_gemstones;
DELETE FROM product_materials;
DELETE FROM qr_memory_access_logs;
DELETE FROM qr_memories;
DELETE FROM engraving_biometrics;
DELETE FROM warranty_claims;
DELETE FROM warranties;
DELETE FROM biometric_capture_sessions;
DELETE FROM production_tasks;
UPDATE engravings SET approved_version_id = NULL;
UPDATE orders SET design_draft_id = NULL;
DELETE FROM engraving_versions;
DELETE FROM design_drafts;
DELETE FROM engravings;
DELETE FROM products;
DELETE FROM gemstones;
DELETE FROM materials;

-- ============================================================
-- 1. Materials (5 records)
-- UUIDs: a111..., a222..., a333..., a444..., a555...
-- ============================================================
INSERT INTO materials (id, name, purity, color, current_price_per_gram, stock_gram, last_updated)
VALUES
  ('a1111111-1111-4111-8111-111111111111', 'Vàng 14K',       '58.5%', 'Vàng',          1200000, 5000,  NOW()),
  ('a2222222-2222-4222-8222-222222222222', 'Vàng 18K',       '75%',   'Vàng',          1600000, 3000,  NOW()),
  ('a3333333-3333-4333-8333-333333333333', 'Vàng trắng 18K', '75%',   'Trắng',         1800000, 2000,  NOW()),
  ('a4444444-4444-4444-8444-444444444444', 'Bạc 925',        '92.5%', 'Bạc',           300000,  10000, NOW()),
  ('a5555555-5555-4555-8555-555555555555', 'Platinum',       '95%',   'Trắng bạch kim', 2500000, 1000,  NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Gemstones (6 records)
-- UUIDs: b111..., b222..., b333..., b444..., b555..., b666...
-- ============================================================
INSERT INTO gemstones (id, type, carat, cut, color, clarity, certification_code, price, stock_quantity, is_available)
VALUES
  ('b1111111-1111-4111-8111-111111111111', 'Kim cương',  0.5,  'Round Brilliant', 'D',               'VS1',  'GIA-123456', 15000000, 50,  true),
  ('b2222222-2222-4222-8222-222222222222', 'Kim cương',  1.0,  'Round Brilliant', 'E',               'VS2',  'GIA-123457', 35000000, 30,  true),
  ('b3333333-3333-4333-8333-333333333333', 'Sapphire',   1.2,  'Oval',            'Xanh hoàng gia',  'VVS1', 'GIA-123458', 12000000, 20,  true),
  ('b4444444-4444-4444-8444-444444444444', 'Ruby',       0.8,  'Cushion',         'Đỏ máu bồ câu',   'VVS2', 'GIA-123459', 18000000, 15,  true),
  ('b5555555-5555-4555-8555-555555555555', 'Emerald',    1.0,  'Emerald',         'Xanh lục',        'SI1',  'GIA-123460', 14000000, 10,  true),
  ('b6666666-6666-4666-8666-666666666666', 'Moissanite', 1.5,  'Round Brilliant', 'D',               'VVS1', 'GIA-123461',  5000000, 100, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Products (8 records)
-- UUIDs: c111..., c222..., ..., c888...
-- ============================================================
INSERT INTO products (id, name, description, base_material_id, base_price, thumbnail_url, model_3d_url, is_active, created_at, updated_at)
VALUES
  (
    'c1111111-1111-4111-8111-111111111111',
    'Classic Band',
    'Nhẫn trơn cổ điển, phù hợp cho cả nam và nữ. Thiết kế tối giản, tinh tế.',
    'a2222222-2222-4222-8222-222222222222',   -- mat-gold-18k
    5000000,
    'https://cdn.bioring.com/placeholder/ring-default.png',
    'https://cdn.bioring.com/placeholder/ring-default.glb',
    true, NOW(), NOW()
  ),
  (
    'c2222222-2222-4222-8222-222222222222',
    'Elegance',
    'Nhẫn thiết kế thanh lịch với đính đá quý ở trung tâm. Phù hợp cho tiệc cưới và sự kiện.',
    'a3333333-3333-4333-8333-333333333333',   -- mat-white-gold-18k
    8000000,
    'https://cdn.bioring.com/placeholder/ring-default.png',
    'https://cdn.bioring.com/placeholder/ring-default.glb',
    true, NOW(), NOW()
  ),
  (
    'c3333333-3333-4333-8333-333333333333',
    'Solitaire',
    'Nhẫn đính đá đơn, tôn vinh vẻ đẹp của viên kim cương trung tâm.',
    'a5555555-5555-4555-8555-555555555555',   -- mat-platinum
    12000000,
    'https://cdn.bioring.com/placeholder/ring-default.png',
    'https://cdn.bioring.com/placeholder/ring-default.glb',
    true, NOW(), NOW()
  ),
  (
    'c4444444-4444-4444-8444-444444444444',
    'Eternity',
    'Nhẫn vĩnh cửu với dải đá quý chạy quanh thân nhẫn. Biểu tượng cho tình yêu vĩnh hằng.',
    'a1111111-1111-4111-8111-111111111111',   -- mat-gold-14k
    15000000,
    'https://cdn.bioring.com/placeholder/ring-default.png',
    'https://cdn.bioring.com/placeholder/ring-default.glb',
    true, NOW(), NOW()
  ),
  (
    'c5555555-5555-4555-8555-555555555555',
    'Modern Edge',
    'Nhẫn phong cách hiện đại, đường nét sắc sảo. Phù hợp cho người yêu thích sự phá cách.',
    'a4444444-4444-4444-8444-444444444444',   -- mat-silver-925
    2500000,
    'https://cdn.bioring.com/placeholder/ring-default.png',
    'https://cdn.bioring.com/placeholder/ring-default.glb',
    true, NOW(), NOW()
  ),
  (
    'c6666666-6666-4666-8666-666666666666',
    'Vintage Rose',
    'Nhẫn phong cách cổ điển với họa tiết hoa hồng tinh xảo. Đính đá Ruby ở trung tâm.',
    'a2222222-2222-4222-8222-222222222222',   -- mat-gold-18k
    10000000,
    'https://cdn.bioring.com/placeholder/ring-default.png',
    'https://cdn.bioring.com/placeholder/ring-default.glb',
    true, NOW(), NOW()
  ),
  (
    'c7777777-7777-4777-8777-777777777777',
    'Sapphire Dream',
    'Nhẫn Sapphire xanh hoàng gia sang trọng. Viền kim cương tinh tế.',
    'a3333333-3333-4333-8333-333333333333',   -- mat-white-gold-18k
    18000000,
    'https://cdn.bioring.com/placeholder/ring-default.png',
    'https://cdn.bioring.com/placeholder/ring-default.glb',
    true, NOW(), NOW()
  ),
  (
    'c8888888-8888-4888-8888-888888888888',
    'Minimalist',
    'Nhẫn thiết kế tối giản, mỏng nhẹ. Phù hợp cho người yêu thích sự đơn giản.',
    'a4444444-4444-4444-8444-444444444444',   -- mat-silver-925
    1500000,
    'https://cdn.bioring.com/placeholder/ring-default.png',
    'https://cdn.bioring.com/placeholder/ring-default.glb',
    true, NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Product-Materials links (all 5 materials -> each product)
-- ============================================================
INSERT INTO product_materials (product_id, material_id)
SELECT p.id, m.id
FROM products p
CROSS JOIN materials m
ON CONFLICT (product_id, material_id) DO NOTHING;

-- ============================================================
-- 5. Product-Gemstones links (all 6 gemstones -> each product)
-- ============================================================
INSERT INTO product_gemstones (product_id, gemstone_id)
SELECT p.id, g.id
FROM products p
CROSS JOIN gemstones g
ON CONFLICT (product_id, gemstone_id) DO NOTHING;

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
SELECT 'materials' AS table_name, COUNT(*) AS count FROM materials
UNION ALL
SELECT 'gemstones', COUNT(*) FROM gemstones
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'product_materials', COUNT(*) FROM product_materials
UNION ALL
SELECT 'product_gemstones', COUNT(*) FROM product_gemstones
ORDER BY table_name;
