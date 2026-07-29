-- Backfill production_tasks for existing DEPOSIT_PAID orders that don't have one yet
INSERT INTO production_tasks (id, order_id, engraving_id, task_name, status, created_at)
SELECT
  gen_random_uuid(),
  o.id,
  o.engraving_id,
  CONCAT('Ring production - ', o.order_code),
  'PENDING',
  NOW()
FROM orders o
WHERE o.status = 'DEPOSIT_PAID'
  AND NOT EXISTS (
    SELECT 1 FROM production_tasks pt WHERE pt.order_id = o.id
  );
