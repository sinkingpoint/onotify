CREATE TABLE IF NOT EXISTS account (
  id string,
  name string
);

CREATE TABLE IF NOT EXISTS user (
  id string,
  name string
);

CREATE TABLE IF NOT EXISTS account_membership (
  user_id string,
  account_id string
);

CREATE TABLE IF NOT EXISTS api_keys (
  user_id string,
  account_id string,
  key string,
  expires number,
  scopes string
);

INSERT INTO api_keys VALUES (0, 0, "notify-test", 0, "*");
