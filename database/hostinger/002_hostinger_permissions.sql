-- Hostinger SQL access configuration (shared-hosting safe)
-- IMPORTANT:
-- On most Hostinger shared plans, CREATE USER / GRANT via phpMyAdmin is blocked (#1227).
-- Use the MySQL user already created in hPanel (MySQL Databases section).

-- Optional (execute only if your plan/user has privilege):
-- CREATE USER IF NOT EXISTS 'barber_app'@'%' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
-- GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON `__HOSTINGER_DB_NAME__`.* TO 'barber_app'@'%';
-- FLUSH PRIVILEGES;

-- Validation query (safe in shared hosting):
SELECT CURRENT_USER() AS mysql_user, DATABASE() AS selected_database;
