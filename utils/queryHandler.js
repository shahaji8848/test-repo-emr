async function exeQuery(conn, stmts = {}) {
    const { transaction, sql} = conn
    const request = new sql.Request(transaction);
    const query = await constructQuery(conn, request, stmts)
    const result = await request.query(query);
    return result.recordset;
  }



async function constructQuery(conn, request, stmts = {}) {
  const {
    selectClause = '*',
    from = '',
    whereConditions = [],
    groupByClause = '',
    orderByClause = '',
    inputTypeMap = {},
    inputValuesMap = {},
  } = stmts;

  if (!from) {
    throw new Error('FROM clause is required');
  }

  // Register all input parameters with default type fallback
  for (const key of Object.keys(inputValuesMap)) {
    const value = inputValuesMap[key];
    const type = inputTypeMap[key] || conn.sql.VarChar; // default to VarChar
    request.input(key, type, value);
  }

  // Build base query
  let query = `SELECT ${selectClause} FROM ${from}`;

  // Build WHERE clause
  const conditions = whereConditions.map((key) => {
    return key.includes('=') || key.includes('LIKE') || key.includes('IN')
      ? key // already a full condition
      : `${key} = @${key}`; // treat as column name
  });
  query += ` WHERE ${conditions.join(' AND ')}`;
  
  // GRROUP BY clause
  if (groupByClause) {
    query += ` GROUP BY ${groupByClause}`;
  }

  // ORDER BY clause
  if (orderByClause) {
    query += ` ORDER BY ${orderByClause}`;
  }
  return query;
}
module.exports = { exeQuery };
  
  
  