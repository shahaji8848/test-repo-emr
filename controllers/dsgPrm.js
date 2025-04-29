const { exeQuery } = require('../utils/queryHandler.js');

/* 
From DsgPrm Get Unique Design Collection Codes
 * @param {object} conn - Database connection object.
 * @param {object} stmts - Query configuration.
 * @param {string} [stmts.selectClause="DISTINCT DpCd"] - SELECT clause.
 * @param {string[]} [stmts.whereConditions=["DpTyp = @DpTyp"]] - WHERE conditions.
 * @returns {Promise<Array>} - Query results.
 */

async function getDsgCollections(conn, stmts = {}) {
  const defaultWhereConditions = ['DpTyp = @DpTyp'];
  const defaultInputTypeMap = {
    DpTyp: conn.sql.VarChar(20)
  };
  const defaultInputValuesMap = {
    DpTyp: 'CAT'
  };

  stmts.selectClause ='DISTINCT DpCd';
  stmts.from = 'DsgPrm';

  stmts.whereConditions = [
    ...defaultWhereConditions,
    ...(stmts.whereConditions || [])
  ];

  stmts.orderByClause = stmts.orderByClause || 'DpCd';

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


module.exports = { getDsgCollections };
