const transactionalWrapper = require('../utils/controllerWrapper');
const { exeQuery } = require('../utils/queryHandler.js');

/* 
To Get Param Details from Param Table with PTyp as Mandatory filters
and optional filter on likeField and likeValue
*/


// Fetch design analytics parameter data from the Param table
async function getDesignAnalytics(conn, anaSrList = []) {
  const groupByClause = 'PMCd, PSCd, PDesc';  
  const inputValuesMap = {
    "PTyp": "DAANACD"
  };     

  const whereConditions = []

  if (anaSrList.length > 0){
    const inClause = anaSrList.map(v => `'${v}'`).join(", ");
    whereConditions.push(`PMCd IN (${inClause})`)
  }


  const results = await getParamRecords(conn, {
    whereConditions,
    groupByClause,
    inputValuesMap
  });

  // Prepare dictionary to group results by PMCd value
  const resultDict = anaSrList.reduce((acc, no) => {
    acc[no] = [];
    return acc;
  }, {});

  results.forEach(record => {
    const { PMCd, PSCd, PDesc } = record;
    const key = parseInt(PMCd); // Ensure PMCd is treated as a number
    if (resultDict[key]) {
      resultDict[key].push({pmcd:PMCd, pscd:PSCd, pdesc:PDesc });
    }
  });

  return resultDict; 
}


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

module.exports = { getParamRecords, getDesignAnalytics };
