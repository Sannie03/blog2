function describeDatabaseError(error) {
  const codes = [error.code, ...(error.errors || []).map((item) => item.code)];
  if (codes.includes('ECONNREFUSED')) return 'Cannot connect to PostgreSQL. Start Docker Desktop, then run docker compose up -d --wait in backend.';
  if (codes.includes('28P01')) return 'PostgreSQL rejected the credentials. Check DATABASE_URL and POSTGRES_PASSWORD in backend/.env.';
  if (codes.includes('42P01')) return 'Database tables are missing. Run npm run migrate before bootstrap-admin.';
  return codes.filter(Boolean).join(', ') || error.message || 'Unknown database error';
}
module.exports = { describeDatabaseError };
