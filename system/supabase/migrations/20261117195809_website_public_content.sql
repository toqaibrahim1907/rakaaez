create view public.website_published_content with (security_barrier=true) as select organization_id,headline,subhead,theme,sections,images,updated_at from public.website_content where published = true; revoke all on public.website_published_content from public; grant select on public.website_published_content to anon,authenticated;

