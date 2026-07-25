-- 1. Set foreign keys to NULL to avoid constraint violations
UPDATE design_drafts SET selected_material_id = NULL, selected_gemstone_id = NULL;
UPDATE engraving_versions SET selected_material_id = NULL, selected_gemstone_id = NULL;
UPDATE products SET base_material_id = NULL;

-- 2. Clear junction tables
DELETE FROM product_materials;
DELETE FROM product_gemstones;

-- 3. Delete old materials and gemstones
DELETE FROM materials;
DELETE FROM gemstones;

-- 4. Insert new materials with specified render configs and cheap prices
-- Platinum (Bạch kim) / Bạc Ý
INSERT INTO materials (id, name, purity, color, current_price_per_gram, stock_gram, last_updated, render_config)
VALUES (
  '6a43e49f-b7a4-4f40-8b17-061327110001',
  'Bạch kim / Bạc Ý',
  '950',
  'White',
  100000.00,
  1000.00,
  NOW(),
  '{"colorHex":"#E5E9EC","roughness":0.15,"metalness":1.0,"clearcoat":1.0,"clearcoatRoughness":0.1,"envMapIntensity":1.5}'::jsonb
);

-- Vàng 18K (18K Gold) / Đồng mạ vàng
INSERT INTO materials (id, name, purity, color, current_price_per_gram, stock_gram, last_updated, render_config)
VALUES (
  '6a43e49f-b7a4-4f40-8b17-061327110002',
  'Vàng 18K / Đồng mạ vàng',
  '75%',
  'Gold',
  120000.00,
  1000.00,
  NOW(),
  '{"colorHex":"#E7C57E","roughness":0.18,"metalness":1.0,"clearcoat":1.0,"clearcoatRoughness":0.1,"envMapIntensity":1.5}'::jsonb
);

-- Vàng Hồng (Rose Gold)
INSERT INTO materials (id, name, purity, color, current_price_per_gram, stock_gram, last_updated, render_config)
VALUES (
  '6a43e49f-b7a4-4f40-8b17-061327110003',
  'Vàng Hồng (Rose Gold)',
  '75%',
  'Rose Gold',
  110000.00,
  1000.00,
  NOW(),
  '{"colorHex":"#D19B86","roughness":0.16,"metalness":1.0,"clearcoat":1.0,"clearcoatRoughness":0.1,"envMapIntensity":1.5}'::jsonb
);

-- Bạc 925 (Silver)
INSERT INTO materials (id, name, purity, color, current_price_per_gram, stock_gram, last_updated, render_config)
VALUES (
  '6a43e49f-b7a4-4f40-8b17-061327110004',
  'Bạc 925 (Silver)',
  '92.5%',
  'Silver',
  30000.00,
  2000.00,
  NOW(),
  '{"colorHex":"#F3F2EE","roughness":0.22,"metalness":1.0,"clearcoat":1.0,"clearcoatRoughness":0.15,"envMapIntensity":1.2}'::jsonb
);

-- 5. Insert new gemstones with specified render configs and cheap prices
-- Kim Cương (Diamond) / CZ Trong suốt
INSERT INTO gemstones (id, type, carat, cut, color, clarity, certification_code, price, stock_quantity, is_available, render_config)
VALUES (
  'f78326a2-9999-4444-8888-d30b08360001',
  'Kim cương / CZ Trong suốt',
  1.0,
  'Round Brilliant',
  'D',
  'FL',
  'GIA-000001',
  500000.00,
  100,
  TRUE,
  '{"colorHex":"#FFFFFF","ior":2.42,"transmission":0.95,"opacity":1.0,"dispersion":0.044,"roughness":0.0,"meshNodeName":"gemstone"}'::jsonb
);

-- Đá Ruby (Màu đỏ)
INSERT INTO gemstones (id, type, carat, cut, color, clarity, certification_code, price, stock_quantity, is_available, render_config)
VALUES (
  'f78326a2-9999-4444-8888-d30b08360002',
  'Đá Ruby (Màu đỏ)',
  1.0,
  'Round Brilliant',
  'Red',
  'VVS1',
  'GIA-000002',
  300000.00,
  100,
  TRUE,
  '{"colorHex":"#E0115F","ior":1.76,"transmission":0.85,"opacity":1.0,"dispersion":0.018,"roughness":0.0,"meshNodeName":"gemstone"}'::jsonb
);

-- Đá Sapphire (Màu xanh dương)
INSERT INTO gemstones (id, type, carat, cut, color, clarity, certification_code, price, stock_quantity, is_available, render_config)
VALUES (
  'f78326a2-9999-4444-8888-d30b08360003',
  'Đá Sapphire (Màu xanh dương)',
  1.0,
  'Round Brilliant',
  'Blue',
  'VVS1',
  'GIA-000003',
  300000.00,
  100,
  TRUE,
  '{"colorHex":"#0F52BA","ior":1.77,"transmission":0.88,"opacity":1.0,"dispersion":0.018,"roughness":0.0,"meshNodeName":"gemstone"}'::jsonb
);

-- Đá Emerald (Lục bảo xanh lá)
INSERT INTO gemstones (id, type, carat, cut, color, clarity, certification_code, price, stock_quantity, is_available, render_config)
VALUES (
  'f78326a2-9999-4444-8888-d30b08360004',
  'Đá Emerald (Lục bảo xanh lá)',
  1.0,
  'Round Brilliant',
  'Green',
  'VVS2',
  'GIA-000004',
  250000.00,
  100,
  TRUE,
  '{"colorHex":"#50C878","ior":1.58,"transmission":0.78,"opacity":1.0,"dispersion":0.014,"roughness":0.05,"meshNodeName":"gemstone"}'::jsonb
);

-- Thạch Anh Tím (Amethyst)
INSERT INTO gemstones (id, type, carat, cut, color, clarity, certification_code, price, stock_quantity, is_available, render_config)
VALUES (
  'f78326a2-9999-4444-8888-d30b08360005',
  'Thạch Anh Tím (Amethyst)',
  1.0,
  'Round Brilliant',
  'Purple',
  'VS1',
  'GIA-000005',
  100000.00,
  100,
  TRUE,
  '{"colorHex":"#9966CC","ior":1.54,"transmission":0.88,"opacity":1.0,"dispersion":0.013,"roughness":0.02,"meshNodeName":"gemstone"}'::jsonb
);

-- 6. Link products to random materials and gemstones
-- First connection: Ensure each product has AT LEAST 1 material
INSERT INTO product_materials (product_id, material_id)
SELECT p.id, m.id
FROM products p
CROSS JOIN LATERAL (
  SELECT id FROM materials ORDER BY random() LIMIT 1
) m
ON CONFLICT DO NOTHING;

-- Second connection: Ensure each product has AT LEAST 1 gemstone
INSERT INTO product_gemstones (product_id, gemstone_id)
SELECT p.id, g.id
FROM products p
CROSS JOIN LATERAL (
  SELECT id FROM gemstones ORDER BY random() LIMIT 1
) g
ON CONFLICT DO NOTHING;

-- Additional connections: Randomly add up to 2 additional materials per product
INSERT INTO product_materials (product_id, material_id)
SELECT p.id, m.id
FROM products p
CROSS JOIN LATERAL (
  SELECT id FROM materials ORDER BY random() LIMIT 2
) m
ON CONFLICT DO NOTHING;

-- Additional connections: Randomly add up to 2 additional gemstones per product
INSERT INTO product_gemstones (product_id, gemstone_id)
SELECT p.id, g.id
FROM products p
CROSS JOIN LATERAL (
  SELECT id FROM gemstones ORDER BY random() LIMIT 2
) g
ON CONFLICT DO NOTHING;

-- 7. Update base_material_id in products to point to a valid available material
UPDATE products p
SET base_material_id = (
  SELECT material_id 
  FROM product_materials 
  WHERE product_id = p.id 
  LIMIT 1
);
