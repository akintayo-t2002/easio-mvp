create table if not exists oauth_state_tokens (
    nonce text primary key,
    provider text not null,
    organization_id uuid not null,
    redirect_url text,
    origin text,
    pkce_verifier text not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists oauth_state_tokens_provider_idx
    on oauth_state_tokens (provider);
