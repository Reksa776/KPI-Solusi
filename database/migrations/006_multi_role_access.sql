USE solusi_sejalan;

-- Keep old labels temporarily so existing accounts can be mapped without data loss.
ALTER TABLE users
  MODIFY COLUMN role ENUM('admin','account_manager','client','talent','superadmin','kliper','buzzer','brand','viewer') NOT NULL DEFAULT 'brand';

SET @has_admin_scope = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name='admin_scope');
SET @add_admin_scope_sql = IF(@has_admin_scope=0, 'ALTER TABLE users ADD COLUMN admin_scope ENUM(''dm'',''dae'',''both'') NOT NULL DEFAULT ''both'' AFTER role', 'SELECT 1');
PREPARE add_admin_scope_stmt FROM @add_admin_scope_sql;
EXECUTE add_admin_scope_stmt;
DEALLOCATE PREPARE add_admin_scope_stmt;

UPDATE users SET role='superadmin' WHERE role='admin';
UPDATE users SET role='admin' WHERE role='account_manager';
UPDATE users SET role='brand' WHERE role='client';
UPDATE users SET role='buzzer' WHERE role='talent';

ALTER TABLE users
  MODIFY COLUMN role ENUM('superadmin','admin','kliper','buzzer','brand','viewer') NOT NULL DEFAULT 'brand';
