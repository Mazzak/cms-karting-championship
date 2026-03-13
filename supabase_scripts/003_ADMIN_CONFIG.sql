insert into public.profiles (id, full_name, email, role)
values (
  '0cf57683-cbcf-444a-ac01-19c957c1873b',
  'Pedro Maia',
  'pfmaia91@gmail.com',
  'admin'
)
on conflict (id) do update
set
  full_name = excluded.full_name,
  email = excluded.email,
  role = 'admin';