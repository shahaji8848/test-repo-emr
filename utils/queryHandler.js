async function exeQuery(conn, stmts = {}) {
  const { transaction, sql} = conn
  const request = new sql.Request(transaction);
  const query = await constructQuery(conn, request, stmts)
  const result = await request.query(query);
  return result.recordset;
}



async function constructQuery(conn, request, stmts = {}) {
const {
  rawQuery = null,
  selectClause = '*',
  from = '',
  joinTables = [],
  whereConditions = [],
  groupByClause = '',
  havingConditions = [],
  orderByClause = '',
  inputTypeMap = {},
  inputValuesMap = {},
} = stmts;

// Register all input parameters with default type fallback
for (const key of Object.keys(inputValuesMap)) {
  let value = inputValuesMap[key];
  let type = inputTypeMap[key] || conn.sql.VarChar;

  if (type === conn.sql.VarChar && typeof value !== 'string') {
    value = String(value);
  } else if ((type === conn.sql.Int || type === conn.sql.Decimal || type === conn.sql.Float) && typeof value !== 'number') {
    value = Number(value);
  }
  request.input(key, type, value);
}

// Return raw query if provided
if (rawQuery) return rawQuery;

if (!from) {
  throw new Error('FROM clause is required');
}

// Build base query
let query = `SELECT ${selectClause} FROM ${from}`;

// JOINs
const joinRegex = /^(JOIN|INNER JOIN|LEFT JOIN|RIGHT JOIN|FULL JOIN|CROSS JOIN)/i;
for (const jt of joinTables) {
  query += joinRegex.test(jt.trim()) ? ` ${jt}` : ` JOIN ${jt}`;
}

// Build WHERE clause
const conditions = whereConditions.map((key) => {
  return key.includes('=') || key.includes('LIKE') || key.includes('IN') || key.includes('BETWEEN')
    ? key // already a full condition
    : `${key} = @${key}`; // treat as column name
});
if (conditions.length > 0) {
  query += ` WHERE ${conditions.join(' AND ')}`;
}

// GROUP BY clause
if (groupByClause) {
  query += ` GROUP BY ${groupByClause}`;
}

// HAVING clause
const hConditions = havingConditions.map((key) => {
  return key.includes('=') || key.includes('LIKE') || key.includes('IN')
    ? key // already a full condition
    : `${key} = @${key}`; // treat as column name
});
if (hConditions.length > 0) {
  query += `  HAVING ${hConditions.join(' AND ')}`;
}

// ORDER BY clause
if (orderByClause) {
  query += ` ORDER BY ${orderByClause}`;
}
return query;
}
module.exports = { exeQuery };