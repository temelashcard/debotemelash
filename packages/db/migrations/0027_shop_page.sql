-- Shop page (DECISIONS 2026-11-21): a shop's QR opens a page with its cover photo, logo, name and
-- tagline, then the things a customer can do there (for now only "Start earning rewards").
-- The owner sets the tagline and cover in Look. Look only: nothing here touches stamps or rules.

-- A short line under the shop name. Null means none is shown.
alter table tc.business add column tagline text check (tagline is null or char_length(tagline) between 1 and 60);

-- The cover photo, kept in the database like the logo so moving to the VPS stays a plain dump and
-- restore. The owner's phone crops and resizes it to 1200 x 600 before upload, so rows stay small.
-- No row means the page shows the shop's brand colour instead.
-- The version goes in the cover's URL, which phones cache for good, so it comes from a sequence:
-- removing a cover and adding a new one never reuses an old URL.
create sequence tc.business_cover_version_seq;
grant usage on sequence tc.business_cover_version_seq to tc_app;
create table tc.business_cover (
  business_id uuid primary key references tc.business(id),
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  bytes bytea not null check (octet_length(bytes) <= 500000),
  version bigint not null default nextval('tc.business_cover_version_seq'),
  updated_by uuid references tc.person(id),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on tc.business_cover to tc_app;
