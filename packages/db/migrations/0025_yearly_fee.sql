-- One payment a year (DECISIONS.md, 2026-11-06), replacing the monthly fee of 0023: Starter 19,000,
-- Full 21,000, each extra branch 5,000 Birr, for a finance year. Cash and admin approval, the 15-day
-- trial, the grace days and commission as a share of each payment all stay.

insert into tc.setting (key, value, changed_by) values
  ('plan.starter.yearly_fee_birr', '19000', 'migration 0025'),
  ('plan.full.yearly_fee_birr', '21000', 'migration 0025'),
  ('plan.extra_branch.yearly_fee_birr', '5000', 'migration 0025')
on conflict (key) do update set value = excluded.value, changed_by = excluded.changed_by, changed_at = now();
delete from tc.setting where key like 'plan.%.monthly_fee_birr';

-- Put every shop on a paid plan onto the yearly fee, keeping its due date. tc.plan_fee.fee_birr
-- is the fee for the finance year again. The newest row wins, so old rows stay as they were.
insert into tc.plan_fee (business_id, finance_year, plan, branches, fee_birr, base_birr, extra_birr, commission_base_birr, commission_extra_birr, gov_share_percent, due_on, reason)
select business_id, finance_year, plan, branches,
  case plan when 'starter' then 19000 else 21000 + greatest(0, branches - 2) * 5000 end,
  case plan when 'starter' then 19000 else 21000 end,
  case plan when 'starter' then 0 else 5000 end,
  case plan when 'starter' then 3040 else 4200 end,
  case plan when 'starter' then 0 else 1000 end,
  gov_share_percent, due_on, 'plan_changed'
from (
  select distinct on (business_id) * from tc.plan_fee order by business_id, finance_year desc, id desc
) newest
where plan <> 'pilot';
