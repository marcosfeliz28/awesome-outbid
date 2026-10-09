UPDATE "Role"
SET "permissions" = array_append("permissions", 'customers:erase')
WHERE "name" = 'manager'
  AND NOT ('customers:erase' = ANY("permissions"));
