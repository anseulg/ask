// roadmap.js — phase-1 data tool module for ax-bot.
//
// Exposes `lookupRoadmap({ query })`, which the Claude agent calls to search the
// AX product roadmap. For NOW this returns DUMMY sample data so we can validate
// the end-to-end agent loop before wiring the real database. The real query
// against MariaDB (via MaxScale) is stubbed out below and marked with a TODO.

// ---------------------------------------------------------------------------
// Dummy data — realistic AX roadmap samples for private validation.
// Each item is shaped { title, status, dueDate, owner, jiraKey, link }.
// ---------------------------------------------------------------------------
const DUMMY_ROADMAP = [
  {
    title: '쿠폰 대량업로드',
    status: '진행중',
    dueDate: '2026-09-30',
    owner: '김민수',
    jiraKey: 'AX-123',
    link: 'https://11jira.11stcorp.com/browse/AX-123',
  },
  {
    title: 'PDP 상품평 요약 자동화',
    status: '완료',
    dueDate: '2026-08-15',
    owner: '이서연',
    jiraKey: 'AX-98',
    link: 'https://11jira.11stcorp.com/browse/AX-98',
  },
  {
    title: '검색 랭킹 개인화 v2',
    status: '지연',
    dueDate: '2026-10-20',
    owner: '박지훈',
    jiraKey: 'AX-201',
    link: 'https://11jira.11stcorp.com/browse/AX-201',
  },
  {
    title: '상품 등록 자동 분류(카테고리) 개선',
    status: '진행중',
    dueDate: '2026-11-05',
    owner: '최유진',
    jiraKey: 'AX-215',
    link: 'https://11jira.11stcorp.com/browse/AX-215',
  },
];

/**
 * Search the AX roadmap for items matching `query`.
 *
 * @param {{ query?: string }} params
 * @returns {Promise<Array<{title:string,status:string,dueDate:string,owner:string,jiraKey:string,link:string}>>}
 */
async function lookupRoadmap({ query } = {}) {
  // Case-insensitive substring match against title/owner. An empty/blank query
  // returns everything so the agent can list the full roadmap when asked.
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    return DUMMY_ROADMAP;
  }
  return DUMMY_ROADMAP.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.owner.toLowerCase().includes(q)
  );

  // -------------------------------------------------------------------------
  // TODO: replace dummy data with real query
  // -------------------------------------------------------------------------
  // The real phase-1 data source is a MariaDB instance reached through a
  // MaxScale read/write-split router. Connect with mysql2/promise using env
  // vars (NEVER hardcode credentials):
  //
  //   DB_HOST     — MaxScale host
  //   DB_PORT     — 6446 (MaxScale read/write listener; MariaDB behind it)
  //   DB_NAME     — ax
  //   DB_USER     — ax
  //   DB_PASSWORD — (secret; from env only)
  //
  // NOTE: `roadmap_kv` appears to be a KEY-VALUE table (one row per
  // key/value pair, not one row per task), so the real query will likely need
  // to PIVOT the key/value rows into a single item per task (e.g. GROUP BY a
  // task id with conditional aggregation, or fetch all rows and reduce them in
  // JS). The exact schema is still pending — run `SHOW CREATE TABLE roadmap_kv`
  // once DB access is available and adjust the query/pivot accordingly.
  //
  //   const mysql = require('mysql2/promise');
  //
  //   const pool = mysql.createPool({
  //     host: process.env.DB_HOST,
  //     port: Number(process.env.DB_PORT) || 6446,
  //     database: process.env.DB_NAME || 'ax',
  //     user: process.env.DB_USER || 'ax',
  //     password: process.env.DB_PASSWORD,
  //     waitForConnections: true,
  //     connectionLimit: 5,
  //   });
  //
  //   // Fetch raw key/value rows, then pivot in JS (schema TBD).
  //   const like = `%${q}%`;
  //   const [rows] = await pool.query(
  //     `SELECT task_id, \`key\`, \`value\`
  //        FROM roadmap_kv
  //       WHERE task_id IN (
  //         SELECT task_id FROM roadmap_kv
  //          WHERE \`key\` IN ('title', 'owner')
  //            AND LOWER(\`value\`) LIKE ?
  //       )`,
  //     [like]
  //   );
  //
  //   // Pivot: { [task_id]: { key: value, ... } } -> array of items.
  //   const byTask = new Map();
  //   for (const { task_id, key, value } of rows) {
  //     if (!byTask.has(task_id)) byTask.set(task_id, {});
  //     byTask.get(task_id)[key] = value;
  //   }
  //   return [...byTask.values()].map((t) => ({
  //     title: t.title,
  //     status: t.status,
  //     dueDate: t.due_date,
  //     owner: t.owner,
  //     jiraKey: t.jira_key,
  //     link: t.link,
  //   }));
  // -------------------------------------------------------------------------
}

module.exports = { lookupRoadmap };
