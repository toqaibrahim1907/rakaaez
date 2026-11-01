(() => {
  const config = window.RAKAEZ_SUPABASE_CONFIG || {};
  const ready = Boolean(config.url && config.anonKey && window.supabase?.createClient);
  const client = ready ? window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;
  window.RakaezBackend = {
    client,
    ready,
    async requireRole(roles) {
      if (!client) return { local: true };
      const { data: { session }, error } = await client.auth.getSession();
      if (error || !session) { location.href = 'login.html'; return null; }
      const { data, error: roleError } = await client.from('employee_profiles').select('full_name,role,active').eq('user_id', session.user.id).single();
      if (roleError || !data?.active || !roles.includes(data.role)) {
        await client.auth.signOut(); location.href = 'login.html?error=role'; return null;
      }
      return { session, profile: data };
    },
    async signOut() { if (client) await client.auth.signOut(); location.href = 'login.html'; }
  };
})();
