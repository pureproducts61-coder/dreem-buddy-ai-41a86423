-- TIVO AI Persistence Layer
-- This table will store Admin's visions, preferences, and system learning data.

create table if not exists public.ai_persistence (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    vision_key text unique not null,
    vision_data jsonb not null,
    is_active boolean default true,
    metadata jsonb default '{}'::jsonb
);

-- RLS Policies
alter table public.ai_persistence enable row level security;

create policy "Admins can manage AI persistence"
on public.ai_persistence
for all
to authenticated
using (
    exists (
        select 1 from public.user_profiles
        where id = auth.uid()
        and role = 'admin'
    )
);
