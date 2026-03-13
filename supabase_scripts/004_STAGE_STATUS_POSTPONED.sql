alter table public.stages
drop constraint if exists stages_status_check;

alter table public.stages
add constraint stages_status_check
check (status in ('draft', 'scheduled', 'postponed', 'completed', 'cancelled'));
