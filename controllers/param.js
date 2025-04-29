const { exeQuery } = require('../utils/queryHandler');

/*
 * General utility function to retrieve data from Param table based on dynamic conditions
 * Fetches records from the Param table with dynamic conditions.
 * @param {object} conn - Database connection object.
 * @param {object} stmts - Query configuration.
 * @param {string} [stmts.selectClause="DISTINCT PDesc, PMCd"] - SELECT clause.
 * @param {string[]} [stmts.whereConditions=["PTyp = @PTyp"]] - WHERE conditions.
 * @returns {Promise<Array>} - Query results.
*/
async function getParamRecords(conn, stmts = {}) {
  if (!stmts.inputValuesMap || !stmts.inputValuesMap.PTyp) {
    throw new Error('Missing required parameter: PTyp');
  }
  const defaultWhereConditions = ['PTyp = @PTyp'];
  const defaultInputTypeMap = {
    'PTyp': conn.sql.VarChar,
  };
  const defaultInputValuesMap = {};

  stmts.selectClause = stmts.selectClause || 'DISTINCT PMCd, PSCd, PDesc';

  stmts.from = stmts.from || 'Param';

  stmts.whereConditions = [
    ...defaultWhereConditions,
    ...(stmts.whereConditions || [])
  ];
  

  stmts.orderByClause = stmts.orderByClause || 'PMCd';

  stmts.inputTypeMap = {
    ...defaultInputTypeMap,
    ...(stmts.inputTypeMap || {})
  };

  stmts.inputValuesMap = {
    ...defaultInputValuesMap,
    ...(stmts.inputValuesMap || {})
  };

  return await exeQuery(conn, stmts);
}

module.exports = { getParamRecords };
