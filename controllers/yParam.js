const { exeQuery } = require('../utils/queryHandler');
const jwt = require('jsonwebtoken');

/*
Get YParam Records
*/ 
async function getYParamRecords(conn, stmts = {}) {
    if (!stmts.inputValuesMap || !stmts.inputValuesMap.PTyp) {
      throw new Error('Missing required parameter: PTyp');
    }
    // Default values for the query
    const defaultWhereConditions = ['PTyp = @PTyp'];
    const defaultInputTypeMap = {
      'PTyp': conn.sql.VarChar,
    };
    const defaultInputValuesMap = {};
  
    stmts.selectClause = stmts.selectClause || 'DISTINCT PMCd, PSCd, PDesc';
    stmts.from = stmts.from || 'YParam';
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
module.exports = { getYParamRecords};