async function getDashboardData(pool, userId = null, role = 'user', filters = {}) {
  try {
    const conditions = [];
    const params = [];
    if (role !== 'superadmin' && userId) {
      params.push(Number(userId));
      conditions.push(`p.author_id = $${params.length}`);
    }
    const validDate = (value) => {
      const text = String(value || '');
      const date = new Date(`${text}T00:00:00Z`);
      return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
    };
    if ([filters.from, filters.to].some(value => value && !validDate(value)) || (filters.from && filters.to && filters.from > filters.to)) {
      const error = new Error('Enter valid dates and ensure the start date is before the end date.');
      error.status = 400;
      throw error;
    }
    const hasFromDate = validDate(filters.from);
    const hasToDate = validDate(filters.to);
    if (hasFromDate) {
      params.push(filters.from);
      conditions.push(`p.created_at >= $${params.length}::date`);
    }
    if (hasToDate) {
      params.push(filters.to);
      conditions.push(`p.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }
    if (!hasFromDate && !hasToDate) {
      conditions.push(`p.created_at >= NOW() - INTERVAL '14 days'`);
    }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const userParams = [];
    const userJoinConditions = [];
    if (hasFromDate) {
      userParams.push(filters.from);
      userJoinConditions.push(`p.created_at >= $${userParams.length}::date`);
    }
    if (hasToDate) {
      userParams.push(filters.to);
      userJoinConditions.push(`p.created_at < ($${userParams.length}::date + INTERVAL '1 day')`);
    }
    if (!hasFromDate && !hasToDate) {
      userJoinConditions.push(`p.created_at >= NOW() - INTERVAL '14 days'`);
    }
    const userJoinFilter = userJoinConditions.length ? ` AND ${userJoinConditions.join(' AND ')}` : '';
    const userWhere = role === 'superadmin'
      ? ''
      : (() => {
        userParams.push(Number(userId));
        return `WHERE u.id = $${userParams.length}`;
      })();

    const totalPosts = pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE p.status = 'published')::int AS published,
              COUNT(*) FILTER (WHERE p.status = 'draft')::int AS drafts
       FROM posts p ${whereClause}`,
      params
    );
    const adminUsers = pool.query(
      `SELECT COUNT(*)::int AS total FROM users WHERE role IN ('admin', 'superadmin')`
    );
    const byDay = pool.query(`
      SELECT to_char(p.created_at, 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE p.status = 'published')::int AS published,
        COUNT(*) FILTER (WHERE p.status = 'draft')::int AS drafts
      FROM posts p
      ${whereClause}
      GROUP BY to_char(p.created_at, 'YYYY-MM-DD')
      ORDER BY MIN(p.created_at)
    `, params);

    const users = pool.query(`
      SELECT u.id, u.name, u.username, u.email, u.role,
             COUNT(p.id)::int AS posts_count, u.adsense_access
      FROM users u
      LEFT JOIN posts p ON p.author_id = u.id${userJoinFilter}
      ${userWhere}
      GROUP BY u.id
      ORDER BY u.id ASC
    `, userParams);
    const [totalResult, adminResult, dayResult, userResult] = await Promise.all([totalPosts, adminUsers, byDay, users]);
    const adminRows = userResult.rows.filter(user => ['admin', 'superadmin'].includes(user.role))
      .map(({ id, name, username, role, posts_count }) => ({ id, name, username, role, postCount: Number(posts_count || 0) }));

    return {
      totalPosts: Number(totalResult.rows[0]?.total || 0),
      publishedPosts: Number(totalResult.rows[0]?.published || 0),
      draftPosts: Number(totalResult.rows[0]?.drafts || 0),
      adminCount: Number(adminResult.rows[0]?.total || 0),
      chart: dayResult.rows.map((row) => ({
        date: row.date,
        total: Number(row.total),
        published: Number(row.published || 0),
        drafts: Number(row.drafts || 0),
      })),
      users: userResult.rows.map((user) => ({ ...user, adsense_access: Boolean(user.adsense_access) })),
      adminStats: adminRows,
    };
  } catch (error) {
    console.error('Dashboard query error:', error.message);
    throw error;
  }
}

module.exports = { getDashboardData };
