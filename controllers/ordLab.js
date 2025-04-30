const { exeQuery } = require('../utils/queryHandler.js');
const { sql } = require('../config/db.js');
  
async function copyOrdLab(conn, kwargs = {}) {
  const inputTypeMap = getcopyOrdLabInputTypeMap();
  const {ToOdOmIdNo, ...inputValuesMap} = kwargs;


  const sourceRows = await exeQuery(conn, {
    from: 'OrdLab',
    whereConditions: [
      'OlCoCd = @FromOdCoCd',
      'OlTc = @FromOdTc',
      'OlYy = @FromOdYy',
      'OlChr = @FromOdChr',
      'OlNo = @FromOdNo',
      'OlSr = @FromOdSr'
    ],
    orderByClause: 'OlSrNo',
    inputTypeMap,
    inputValuesMap,
  });

  if (sourceRows.length === 0) return;

  let ToOlSrNo = 1;

  for (const row of sourceRows) {
    const localInputValuesMap = { ...inputValuesMap, ToOlSrNo };

    const rawQuery = getCopyOrdLabQuery(row, inputTypeMap, localInputValuesMap);

    result = await exeQuery(conn, {
      rawQuery,
      inputTypeMap,
      inputValuesMap: localInputValuesMap,
    });

    ToOlSrNo++;
  }
}


function getcopyOrdLabInputTypeMap() {
  return {
    'FromOdCoCd': sql.VarChar(5),
    'FromOdTc': sql.VarChar(5),
    'FromOdYy': sql.Int,
    'FromOdChr': sql.VarChar(5),
    'FromOdNo': sql.Int,
    'FromOdSr': sql.Int,
    'ToOdCoCd': sql.VarChar(5),
    'ToOdTc': sql.VarChar(5),
    'ToOdYy': sql.Int,
    'ToOdChr': sql.VarChar(5),
    'ToOdNo': sql.Int,
    'ToOdSr': sql.Int,
    'ToOdIdNo': sql.VarChar,
    'ToOlSrNo': sql.Int
  };
}

function getOrdLabColumns() {
  return [
    "OlCoCd", "OlTc", "OlYy", "OlChr", "OlNo", "OlSr", "OlSrNo", "OlMcd", "OlScd", "OlQty", "OlSalRt", 
    "OlSalVal", "OlCstRt", "OlCstVal", "OlQw", "ModUsr", "ModDt", "ModTime", "OlCstQw", "OlOdIdNo", "OlPrtKey"
  ];
}

function getCopyOrdLabQuery(row, inputTypeMap, inputValuesMap) {
  const columns = getOrdLabColumns()
  const insertColumns = columns.map(col => `[${col}]`).join(', ');
  let insertQuery = '';
  const values = columns.map(col => {
    switch (col) {
      case "OlCoCd": return "@ToOdCoCd";
      case "OlTc": return "@ToOdTc";
      case "OlYy": return "@ToOdYy";
      case "OlChr": return "@ToOdChr";
      case "OlNo": return "@ToOdNo";
      case "OlSr": return "@ToOdSr";
      case "OlSrNo": return `@ToOlSrNo`;
      case "OlOdIdNo": return "@ToOdIdNo";
      default: {
        const paramName = `@${col}`;
        inputValuesMap[col] = row[col];
        if (row[col] instanceof Date) {
          inputTypeMap[col] = sql.DateTime;
        } else if (typeof row[col] === 'number') {
          inputTypeMap[col] = sql.Decimal;
        } else {
          inputTypeMap[col] = sql.VarChar;
        }
        return paramName;
      }
    }
  });
  insertQuery += `INSERT INTO OrdLab (${insertColumns}) VALUES (${values.join(', ')});\n`;

  return insertQuery;
}

  
  module.exports = { copyOrdLab };