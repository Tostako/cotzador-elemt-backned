-- =====================================================================
-- RESET de catálogo: borra TODOS los insumos (supplies) y APUs.
-- Ejecutar en el SQL Editor de Supabase.
--
-- Notas:
--  * Borra de TODOS los shops. Para limitar a uno, descomenta el
--    "WHERE shop_id = '...'" en cada DELETE (usa tu shop_id real).
--  * Borrar APUs dispara ON DELETE CASCADE sobre apu_components, y deja
--    budget_items.apu_id en NULL (no los borra).
--  * Luego los insumos se pueden borrar porque ya no hay componentes
--    que los referencien (apu_components.insumo_id es RESTRICT).
--  * supply_prices se borra en cascada con los insumos.
--  * templates.actividades es JSONB y puede quedar apuntando a APUs
--    inexistentes (no es FK, no bloquea la operación).
-- =====================================================================

BEGIN;

-- 1) APUs -> arrastra sus componentes (CASCADE); budget_items.apu_id = NULL
DELETE FROM cost_pro.apus;
-- WHERE shop_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

-- 2) Insumos -> arrastra supply_prices (CASCADE)
DELETE FROM cost_pro.supplies;
-- WHERE shop_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

COMMIT;

-- Verificación (fuera de la transacción):
-- SELECT count(*) AS apus      FROM cost_pro.apus;
-- SELECT count(*) AS insumos   FROM cost_pro.supplies;
-- SELECT count(*) AS compon    FROM cost_pro.apu_components;
-- SELECT count(*) AS precios   FROM cost_pro.supply_prices;

-- ---------------------------------------------------------------------
-- OPCIONAL: limpiar items de presupuesto huérfanos (apu_id = NULL).
-- Descomenta solo si también quieres vaciar los presupuestos.
-- ---------------------------------------------------------------------
-- DELETE FROM cost_pro.budget_items WHERE apu_id IS NULL;
