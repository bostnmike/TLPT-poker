CREATE TABLE cashier_login_limits (
 key TEXT PRIMARY KEY NOT NULL,
 window_start INTEGER NOT NULL,
 attempts INTEGER NOT NULL
);
CREATE INDEX cashier_login_limits_window ON cashier_login_limits(window_start);
