const { exeQuery } = require('../utils/queryHandler.js');
const { sql } = require('../config/db.js');

async function copyOrdRm(conn, kwargs = {}) {
  const inputTypeMap = getcopyOrdRmInputTypeMap();
  const {ToOdOmIdNo, ...inputValuesMap} = kwargs;


  const sourceRows = await exeQuery(conn, {
    from: 'OrdRm',
    whereConditions: [
      'OrCoCd = @FromOdCoCd',
      'OrTc = @FromOdTc',
      'OrYy = @FromOdYy',
      'OrChr = @FromOdChr',
      'OrNo = @FromOdNo',
      'OrSr = @FromOdSr'
    ],
    orderByClause: 'OrSrNo',
    inputTypeMap,
    inputValuesMap,
  });

  if (sourceRows.length === 0) return;

  let ToOrSrNo = 1;
  let OrdRm=[]
  for (const row of sourceRows) {
    const localInputValuesMap = { ...inputValuesMap, ToOrSrNo };

    const rawQuery = getCopyOrdRmQuery(row, localInputValuesMap, inputTypeMap);
    
    let result = await exeQuery(conn, {
      rawQuery,
      inputTypeMap,
      inputValuesMap: localInputValuesMap,
    });
    OrdRm.push(result[0])


    ToOrSrNo++;
  }
  return OrdRm
}

function getcopyOrdRmInputTypeMap() {
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
    'ToOrSrNo': sql.Int
  };
}

function getOrdRmColumns() {
  return [
    "OrCoCd", "OrTc", "OrYy", "OrChr", "OrNo", "OrSr", "OrSrNo", "OrRmCtg", "OrRmSCtg", "OrRmCd",
    "OrLn1", "OrLn2", "OrQty", "OrWt", "OrSalRt", "OrSalVal", "OrCstRt", "OrCstVal", "OrSetScd",
    "OrSetSalRt", "OrSetSalVal", "OrSetCstRt", "OrSetCstVal", "OrWsQty", "OrHsQty", "ModUsr", "ModDt", "ModTime",
    "OrSubShp", "OrAlyCd", "OrAlySalRt", "OrAlyCstRt", "OrMainMet", "OrRmPtr", "OrLmeSal", "OrPrdQty", "OrPrdWt", 
    "OrOdIdNo", "OrPrtKey", "OrCustRmCd", "ORLN3", "OrLotNo"
  ];
}

function getCopyOrdRmQuery(row, inputValuesMap, inputTypeMap) {
  const columns = getOrdRmColumns();

  // Destination columns
  const insertColumns = columns.map(col => `[${col}]`).join(', ');

  // Values to insert
  const values = columns.map(col => {
    switch (col) {
      case "OrCoCd": return "@ToOdCoCd";
      case "OrTc": return "@ToOdTc";
      case "OrYy": return "@ToOdYy";
      case "OrChr": return "@ToOdChr";
      case "OrNo": return "@ToOdNo";
      case "OrSr": return "@ToOdSr";
      case "OrSrNo": return `@ToOrSrNo`;
      case "OrOdIdNo": return "@ToOdIdNo";
      default: {
        const paramName = `@${col}`;
        inputValuesMap[col] = row[col];
        if (row[col] instanceof Date) {
          inputTypeMap[col] = sql.DateTime;
        } else if (typeof row[col] === 'number') {
          if (Number.isInteger(row[col])) {
            inputTypeMap[col] = sql.Int;
          } else {
            inputTypeMap[col] = sql.Float;
          }
        } else {
          inputTypeMap[col] = sql.VarChar;
        }
        return paramName;
      }
    }
  });

  // Query with OUTPUT clause to return inserted data
  const insertQuery = `
    DECLARE @InsertedData TABLE(${columns.map(col => `[${col}] NVARCHAR(MAX)`).join(', ')});

    INSERT INTO OrdRm (${insertColumns})
    OUTPUT ${columns.map(col => `INSERTED.[${col}]`).join(', ')} INTO @InsertedData
    VALUES (${values.join(', ')});

    SELECT * FROM @InsertedData;
  `;

  return insertQuery;
}

module.exports = { copyOrdRm };
