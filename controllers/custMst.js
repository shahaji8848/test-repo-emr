/* 
To Get Customers Details from CustMst Table with CmCtg = 'C' and CmValidYN = 'Y'
and optional filter on likeField and likeValue
*/

const { exeQuery } = require('../utils/queryHandler.js');
async function getCustomers(conn, stmts = {}) {
  const defaultWhereConditions = ['CmCtg = @ctg', 'CmValidYN = @valid'];
  const defaultInputTypeMap = {
    ctg: conn.sql.VarChar(1),
    valid: conn.sql.VarChar(1)
  };
  const defaultInputValuesMap = {
    ctg: 'C',
    valid: 'Y'
  };

  stmts.selectClause = stmts.selectClause || 'DISTINCT CmCd, CmName';
  stmts.from = 'CustMst';

  stmts.whereConditions = [
    ...defaultWhereConditions,
    ...(stmts.whereConditions || [])
  ];

  stmts.orderByClause = stmts.orderByClause || 'CmName';

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


module.exports = { getCustomers };
