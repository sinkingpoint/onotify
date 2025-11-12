CREATE TABLE IF NOT EXISTS account (
  id string primary key,
  name string
);

CREATE TABLE IF NOT EXISTS user (
  id string primary key,
  name string,
  email string
);

CREATE TABLE IF NOT EXISTS account_membership (
  user_id string primary key,
  account_id string,
  scopes string
);

CREATE TABLE IF NOT EXISTS api_keys (
  user_id string,
  account_id string,
  name string,
  id string,
  key string,
  created number,
  expires number,
  scopes string
);

INSERT INTO api_keys VALUES ("0", "0", "test-key", "st", "730a107cecab83da37f6468d831dcdbbdedf156dc0c45bb037d4f7b0f31cf860", 0, 0, "*");
INSERT INTO user VALUES ("0", "Test User", "test@example.com");
INSERT INTO account VALUES ("0", "Test Account");
INSERT INTO account_membership VALUES ("0", "0", "*");
