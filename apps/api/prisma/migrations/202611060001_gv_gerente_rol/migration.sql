-- Rol de la gerente de GV (6-nov) en la tienda.
-- Producto (19-nov): sin roles GV. En la base multiempresa un INSERT/UPDATE de
-- "Role" aquí tocaría a todas las empresas (la migración no pasa por RLS) y
-- GV es un negocio interno de la tienda, apagado en el producto.
SELECT 1;
