-- What the stamp spaces on a shop's card show (OwnCard, "Stamp face"): their numbers, as before,
-- or one icon the owner picks. Look only: it never changes stamps, rewards or rule versions.
alter table tc.business add column stamp_icon text not null default 'number'
  check (stamp_icon in ('number', 'star', 'heart', 'cup', 'food', 'scissors', 'polish', 'flower', 'bag'));
