create table if not exists public.parasite_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique
);

alter table public.parasite_customers enable row level security;
revoke all on public.parasite_customers from anon, authenticated;
grant select, insert on public.parasite_customers to service_role;

insert into storage.buckets (id, name, public)
values ('parasite-members', 'parasite-members', false)
on conflict (id) do nothing;
