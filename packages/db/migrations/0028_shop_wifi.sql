-- Shop page Wi-Fi (DECISIONS 2026-11-21): the owner saves the shop's guest Wi-Fi and turns it on or
-- off. When on, anyone who opens the shop page (the QR link) sees the network name and password, so
-- this is meant for a guest network. Turning it off keeps the details for later. One network per
-- business, like the shop page itself.
create table tc.business_wifi (
  business_id uuid primary key references tc.business(id),
  enabled boolean not null default false,
  ssid text not null default '' check (char_length(ssid) <= 32),
  password text not null default '' check (char_length(password) <= 63),
  security text not null default 'WPA' check (security in ('WPA', 'WEP', 'nopass')),
  hidden boolean not null default false,
  updated_by uuid references tc.person(id),
  updated_at timestamptz not null default now(),
  -- On needs a name; an open network has no password; WPA needs 8 to 63 characters.
  check (not enabled or ssid <> ''),
  check (security <> 'nopass' or password = ''),
  check (security <> 'WPA' or password = '' or char_length(password) >= 8)
);
grant select, insert, update on tc.business_wifi to tc_app;
