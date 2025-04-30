const { exeQuery } = require('../utils/queryHandler.js');
const { sql } = require('../config/db.js');

const { copyOrdRm } = require('../controllers/ordRm.js');

const { copyOrdLab } = require('../controllers/ordLab.js');


// Main function to fetch catalogues based on dynamic filters
async function getCatalogues(conn){
  const kwargs = conn.req.body;
  const { CsCd } = conn.req.userInfo?.CsCd; // Extract user info from request
  const inputTypeMap = {};     // Maps parameter names to SQL types
  const inputValuesMap = {};   // Maps parameter names to their values

  if (!kwargs.DpCd || typeof kwargs.DpCd !== 'string') {
    throw new Error('Invalid Collection');
  }

  // Generate JOIN tables based on filters
  const joinTables = getCatalogueJoinTables(kwargs);

  // Build dynamic WHERE conditions
  const whereConditions = getCatalogueWhereConditions(kwargs, inputTypeMap, inputValuesMap);

  // Build dynamic HAVING conditions (aggregate filters)
  const havingConditions = getCatalogueHavingConditions(kwargs, inputTypeMap, inputValuesMap);

  // SELECT clause with calculated weights using conditional aggregation
  const selectClause = `OdCoCd, OdTc, OdYy, OdChr, OdNo, OdSr, OdDmCd, CAST(ROUND(OdSalPrc, 4) AS DECIMAL(18,4)) as OdSalPrc, OdKt,
    CAST(ROUND(SUM(CASE WHEN Rm.OrRmCtg IN ('D', 'C') THEN Rm.OrWt / 5 ELSE Rm.OrWt END), 4) AS DECIMAL(18,4)) AS GrossWt,
    CAST(ROUND(SUM(CASE WHEN Rm.OrRmCtg = 'D' THEN Rm.OrWt ELSE 0 END), 4) AS DECIMAL(18,4)) AS DiaWt,
    CAST(ROUND(SUM(CASE WHEN Rm.OrRmCtg = 'C' THEN Rm.OrWt ELSE 0 END), 4) AS DECIMAL(18,4)) AS CsWt
  `;

  return await exeQuery(conn, {
    selectClause,
    from: 'OrdDsg',
    whereConditions,
    joinTables,
    groupByClause: 'OdCoCd, OdTc, OdYy, OdChr, OdNo, OdSr, OdDmCd, OdSalPrc, OdKt',
    havingConditions,
    orderByClause: `OdSalPrc`,
    inputTypeMap,
    inputValuesMap
  });
};

// Helper to generate JOIN clauses based on request filters
function getCatalogueJoinTables(kwargs, inputTypeMap, inputValuesMap) {
  const joins = [
    `OrdMst ON OdCoCd = OmCoCd AND OdTc = OmTc AND OdYy = OmYy AND OdChr = OmChr AND OdNo = OmNo`,
    `OrdRm Rm ON Rm.OrCoCd = OdCoCd AND Rm.OrTc = OdTc AND Rm.OrYy = OdYy AND Rm.OrChr = OdChr AND Rm.OrNo = OdNo AND Rm.OrSr = OdSr`,
    `DsgPrm ON DpTyp = 'CAT' AND DpDmCd = OdDmCd`
  ];

  // Add DsgMst join if category or sales category filters are applied
  if (kwargs.DmCtg?.length || kwargs.DmSalCtg?.length) {
    joins.push(`DsgMst ON DmTcTyp = OdDmTcTyp AND DmCd = OdDmCd AND DmSz = ''`);
  }

  return joins;
}


// Helper to create WHERE conditions dynamically
function getCatalogueWhereConditions(kwargs = {}, inputTypeMap, inputValuesMap) {
  const fields = ['DmCtg', 'OrRmSCtg', 'SalPrc', 'DpCd'];
  const conditions = [ `OmCmCd = 'ZSELF'`, `OdTc = 'PL'`]; // Default filters
  
  fields.forEach((field) => {
    const value = kwargs[field];
    if (!value) return;

    if (field === 'SalPrc') {
      addRangeConditions(field, value, inputTypeMap, inputValuesMap, conditions);
    } else {
      addInClause(field, value, field, conditions);
      addInputMap(field, value, inputTypeMap, inputValuesMap, field);
    }
    
  });
  return conditions;
}

// Helper to create HAVING conditions (on aggregated values)
function getCatalogueHavingConditions(kwargs, inputTypeMap, inputValuesMap) {
  const {
    GWt = [],
    DiaWt = [],
    CsWt = [],
    CsAvl = 'All'
  } = kwargs;

  const conditions = [];

  addRangeConditions('GWt', GWt, inputTypeMap, inputValuesMap, conditions);
  addRangeConditions('DiaWt', DiaWt, inputTypeMap, inputValuesMap, conditions);
  addRangeConditions('CsWt', CsWt, inputTypeMap, inputValuesMap, conditions);

  // Handle CsAvl filter
  if (CsAvl === 'Yes') {
    conditions.push(`${getExpr('CsWt')} != 0`);
  } else if (CsAvl === 'No') {
    conditions.push(`${getExpr('CsWt')} = 0`);
  }

  return conditions;
}

// Helper to add BETWEEN clauses for weight filters
function addRangeConditions(alias, ranges, inputTypeMap, inputValuesMap, conditions) {
  const expr = getExpr(alias);
  const subConditions = [];

  ranges.forEach((range, idx) => {
    const [from, to] = range;
    const fromKey = `$from${alias}_${idx}`;
    const toKey = `$to${alias}_${idx}`;

    subConditions.push(`(${expr} BETWEEN @${fromKey} AND @${toKey})`);

    addInputMap(fromKey, from, inputTypeMap, inputValuesMap, alias)
    addInputMap(toKey, to, inputTypeMap, inputValuesMap, alias)
  });

  if (subConditions.length) {
    conditions.push(`(${subConditions.join(' OR ')})`);
  }
}

// Maps alias to corresponding aggregate SQL expression
function getExpr(alias) {
  const map = {
    SalPrc: `OdSalPrc`,
    GWt: `ROUND(SUM(CASE WHEN Rm.OrRmCtg IN ('D', 'C') THEN Rm.OrWt / 5 ELSE Rm.OrWt END), 4)`,
    DiaWt: `ROUND(SUM(CASE WHEN Rm.OrRmCtg = 'D' THEN Rm.OrWt ELSE 0 END), 4)`,
    CsWt: `ROUND(SUM(CASE WHEN Rm.OrRmCtg = 'C' THEN Rm.OrWt ELSE 0 END), 4)`,
  };
  return map[alias];
}



// Adds IN clause with parameters like: field IN (@field_0, @field_1, ...)
function addInClause(field, values, prefix, conditions) {
  if (Array.isArray(values)) {
    if(values.length){
      // Handle the IN clause for arrays
      const paramNames = values.map((_, i) => `@${prefix}_${i}`);
      conditions.push(`${field} IN (${paramNames.join(', ')})`);
    }
  } else {
    // For a single value (number, string, etc.), use equality (=)
    conditions.push(`${field} = @${prefix}`);
  }
}

// Adds values and types to the maps used by exeQuery
function addInputMap(key, value, inputTypeMap, inputValuesMap, baseKey) {
  const baseTypes = getCatalogueBaseInputTypeMap();


  if (Array.isArray(value)) {
    value.forEach((val, i) => {
      inputValuesMap[`${key}_${i}`] = val;
      inputTypeMap[`${key}_${i}`] = baseTypes[baseKey];
    });
  } else {
    inputValuesMap[key] = value;
    inputTypeMap[key] = baseTypes[baseKey];
  }
}

// Base input type map used for Catalogue
function getCatalogueBaseInputTypeMap() {
  return {
    DpCd: sql.VarChar(16),
    DmCtg: sql.VarChar(5),
    OrRmSCtg: sql.VarChar(5),
    SalPrc: sql.Float,
    GWt: sql.Float,
    DiaWt: sql.Float,
    CsAvl: sql.VarChar(3),
  };
}

// Copies one or more OrdDsg (design, rm, lab) rows to a target voucher
async function copyOrdDsg(conn, kwargs = {}, useKwargs = 0, sourceRows=[]) {
  let FromOdSrList = []
  let inputValuesMap = {}

  if (useKwargs) {
    ({ FromOdSrList = [], ...inputValuesMap } = kwargs)
  } else {
    ({ FromOdSrList = [], ...inputValuesMap } = conn.req.body)
  }
  const inputTypeMap = getcopyOrdDsgInputTypeMap();

  if (sourceRows.length == 0){
    sourceRows = await getSourceRows(conn, FromOdSrList, inputValuesMap)
  }

  // Fetch target OmIdNo for the destination voucher
  const resultToOmId = await exeQuery(conn, {
    selectClause: `TOP 1 OmIdNo`,
    from: `OrdMst`,
    whereConditions: [
      `OmCoCd = @ToOdCoCd`,
      `OmTc = @ToOdTc`,
      `OmYy = @ToOdYy`,
      `OmChr = @ToOdChr`,
      `OmNo = @ToOdNo`
    ],
    inputTypeMap,
    inputValuesMap
  });

  const ToOdOmIdNo = resultToOmId?.[0]?.OmIdNo;
  if (!ToOdOmIdNo) {
    throw new Error(`Target OmIdNo (OrdMst) not found for ToOd* values.`);
  }
  inputValuesMap['ToOdOmIdNo'] = ToOdOmIdNo;

  let ToOdSr = 1;

  const resultToOdSr = await exeQuery(conn, {
    selectClause: `Max(OdSr) as OdSr`,
    from: `OrdDsg`,
    whereConditions: [
      `OdCoCd = @ToOdCoCd`,
      `OdTc = @ToOdTc`,
      `OdYy = @ToOdYy`,
      `OdChr = @ToOdChr`,
      `OdNo = @ToOdNo`
    ],
    inputTypeMap,
    inputValuesMap
  });
  if (resultToOdSr?.[0]?.OdSr) {
    ToOdSr = resultToOdSr?.[0]?.OdSr + 1
  }
  for (const row of sourceRows) {
      const localInputValuesMap = { ...inputValuesMap, ToOdSr };
      const rawQuery = getCopyOrdDsgQuery(row, inputTypeMap, localInputValuesMap);
      const result = await exeQuery(conn, {rawQuery, inputTypeMap, inputValuesMap: localInputValuesMap});
      const ToOdIdNo = result?.[0]?.OdIdNo;
      childKwargs = {
        FromOdCoCd: localInputValuesMap.FromOdCoCd,
        FromOdTc: localInputValuesMap.FromOdTc,
        FromOdYy: localInputValuesMap.FromOdYy,
        FromOdChr: localInputValuesMap.FromOdChr,
        FromOdNo: localInputValuesMap.FromOdNo,
        FromOdSr: row.OdSr,
        ToOdCoCd: localInputValuesMap.ToOdCoCd,
        ToOdTc: localInputValuesMap.ToOdTc,
        ToOdYy: localInputValuesMap.ToOdYy,
        ToOdChr: localInputValuesMap.ToOdChr,
        ToOdNo: localInputValuesMap.ToOdNo,
        ToOdSr: localInputValuesMap.ToOdSr,
        ToOdIdNo: ToOdIdNo
      }
      if (ToOdIdNo) {
        await copyOrdRm(conn, childKwargs);
        await copyOrdLab(conn, childKwargs);
      }
  
      ToOdSr++;
  }
}


// Input types for parameter binding
function getcopyOrdDsgInputTypeMap() {
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
    'ToOdOmIdNo': sql.Int
  };
}

// Full list of columns to copy from OrdDsg
function getOrdDsgColumns() {
  return [
    "OdCoCd", "OdTc", "OdYy", "OdChr", "OdNo", "OdSr", "OdDmCd", "OdSfx", "OdDmSz",
    "OdPrdSeq", "OdDelDt", "OdOrdEnt", "OdOrdQty", "OdExpQty", "OdPrdEnt",
    "OdPrdQty", "OdFgQty", "OdCalcPrc", "OdSalPrc", "OdCstPrc", "OdDmPrdInst",
    "OdCmPrdInst", "OdCmStmpInst", "OdSzInst", "OdPrtCd", "OdHld", "OdHldDesc",
    "OdVaCtg", "OdKt", "OdMulby", "OdFixPrc", "OdGldAs", "OdIWtEqOrd", "OdIWtFrOrd",
    "OdIGldRtEqOrd", "OdCls", "OdBagPcs", "OdDmCol", "OdGldAsWt", "ModUsr", "ModDt",
    "ModTime", "OdExpDelDt", "OdSfxDesc", "OdWh", "OdWDiaAvlblDt", "OdHDiaAvlblDt",
    "OdLine", "OdSalRem", "OdOmCtCd", "OdMinWt", "OdMaxWt", "OdBYy", "OdBChr",
    "OdBNo", "OdGmChk", "OdChkTol", "OdGrMet", "OdGrDia", "OdGrCS", "OdGrFin",
    "OdCrmFixPrcYN", "OdSubRem", "OdLabAs", "OdLabAsWt", "OdOmCmCd", "OdOmDt",
    "OdOmIdNo", "OdDmIdNo", "OdPrtKey", "OdPrtFgQty", "OdPrtExpQty", "OdPicNm",
    "OdPoNo", "OdILabWtFrOrd", "OdChgPtrOnStwYN", "InsDt", "OdMinDiaTolWt",
    "OdMaxDiaTolWt", "OdBaseIdKey", "OdRefIdKey", "OdMrpMulby", "OdMrp", "OdDmStkYy",
    "OdDmStkChr", "OdDmStkNo", "OdJLRmCd", "OdJLLn1", "OdJLLn2", "OdJLLn3",
    "OdJLLotNo", "OdJLQty", "OdJLWt", "OdJLVchRt", "OdJLRateByQW", "OdJLVchVal",
    "OdInvAllBags", "OdCell", "OdRepGrWt", "OdDmStkCoCd", "OdMrpDisc", "OdSubCust",
    "OdDmTcTyp", "OdFndAvlblDt"
  ];
}

// Contruct Insert Query
function getCopyOrdDsgQuery(row, inputTypeMap, inputValuesMap) {
  const columns = getOrdDsgColumns()
  const insertColumns = columns.map(col => `[${col}]`).join(', ');
  let insertQuery = '';
  const values = columns.map(col => {
    switch (col) {
      case "OdCoCd": return "@ToOdCoCd";
      case "OdTc": return "@ToOdTc";
      case "OdYy": return "@ToOdYy";
      case "OdChr": return "@ToOdChr";
      case "OdNo": return "@ToOdNo";
      case "OdSr": return "@ToOdSr";
      case "OdCrmFixPrcYN": return "''"; //hardcoded crm fixed price to blank as required in validation 
      // case "OdPrdSeq": return "'HSET'"; //hardcoded as prdseq not matching in test db.
      case "OdOmIdNo": return "@ToOdOmIdNo";
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
  insertQuery += `
                  DECLARE @InsertedOdIdNo TABLE(OdIdNo INT)
                  INSERT INTO OrdDsg (${insertColumns}) 
                  OUTPUT INSERTED.OdIdNo INTO @InsertedOdIdNo(OdIdNo)
                  VALUES (${values.join(', ')})
                  SELECT OdIdNo FROM @InsertedOdIdNo;
                `;

  return insertQuery;
}

async function getSourceRows(conn, FromOdSrList, inputValuesMap) {
  const chunkSize = 1000;
  const allRows = [];

  for (let i = 0; i < FromOdSrList.length; i += chunkSize) {
    const chunk = FromOdSrList.slice(i, i + chunkSize);

    const inputTypeMap = getcopyOrdDsgInputTypeMap();
    const whereConditions = [
      'OdCoCd = @FromOdCoCd',
      'OdTc = @FromOdTc',
      'OdYy = @FromOdYy',
      'OdChr = @FromOdChr',
      'OdNo = @FromOdNo',
    ];

    addInClause('OdSr', chunk, 'OdSr', whereConditions);
    addInputMap('OdSr', chunk, inputTypeMap, inputValuesMap, 'OdSr');

    const chunkRows = await exeQuery(conn, {
      from: 'OrdDsg',
      whereConditions,
      orderByClause: 'OdSr',
      inputTypeMap,
      inputValuesMap,
    });

    allRows.push(...chunkRows);
  }

  return allRows;
}


function isEmptyValue(val) {
  if (val === null || val === undefined) return true;
  if (typeof val === "string" && val.trim() === "") return true;
  if (typeof val === "number" && val === 0) return true;
  if (Array.isArray(val) && val.length === 0) return true;
  if (typeof val === "object" && Object.keys(val).length === 0) return true;
  return false;
}

async function createOrder(conn, kwargs = {}, useKwargs = 0) {
  const isFromKwargs = !!useKwargs;
  const FromOdSr = isFromKwargs ? kwargs.OdSr : conn.req.body.OdSr
  const OdCoCd = isFromKwargs ? kwargs.OdCoCd : conn.req.body.OdCoCd
  const OdTc =  isFromKwargs ? kwargs.OdTc : conn.req.body.OdTc
  const OdYy =  isFromKwargs ? kwargs.OdYy : conn.req.body.OdYy
  const OdChr = isFromKwargs ? kwargs.OdChr : conn.req.body.OdChr
  const OdNo =  isFromKwargs ? kwargs.OdNo : conn.req.body.OdNo


  const ToOdNo = conn.req.userInfo?.CsCd;
  if (!ToOdNo) {
    throw new Error("Missing user session code (ToOdNo).");
  }
  const inputValuesMap = {
    FromOdCoCd: OdCoCd,
    FromOdTc: OdTc,
    FromOdYy: OdYy,
    FromOdChr: OdChr,
    FromOdNo: OdNo,
    FromOdSrList: [FromOdSr],
    ToOdCoCd: 'ZZZ',
    ToOdTc: 'QT',
    ToOdYy: OdYy,
    ToOdChr: 'SO',
    ToOdNo: ToOdNo,
  };
  await copyOrdDsg(conn, inputValuesMap, 1);
  return `Order Created Successfully.`;
}




async function moveDsg(conn, kwargs = {}, useKwargs = 0, sourceRows = []) {
  const isFromKwargs = !!useKwargs;
  const voucherTypeMap = getVoucherTypeMap()
  const validVoucherTypes = ['CS', 'CT', 'QT']
  const VoucherType = isFromKwargs ? kwargs.ToOdChr : conn.req.body.ToOdChr;
  if(VoucherType == 'CS'){
    let csFilters = await getCsFilters(conn)
    csFilters = csFilters.CsFltr
    const keys = Object.keys(csFilters);
    const nonEmptyKeys = keys.filter(key => {
      if (key === "selectedScope") return false;
      return !isEmptyValue(csFilters[key]);
    });

    if (nonEmptyKeys.length === 0) {
      throw new Error(`Cannot set current session if CsFilters are empty`);
    }
  }

  validateVoucherType(validVoucherTypes, VoucherType)

  const ToOdNo = conn.req.userInfo?.CsCd;
  if (!ToOdNo) {
    throw new Error("Missing user session code (ToOdNo).");
  }

  let rowsToGroup = isFromKwargs ? sourceRows : conn.req.body.dsgList;
  rowsToGroup = rowsToGroup.filter(row =>
    row != null &&
    typeof row === 'object' &&
    !Array.isArray(row) &&
    Object.keys(row).length > 0
  );

  if (!Array.isArray(rowsToGroup) || rowsToGroup.length === 0) {
    throw new Error("No designs provided to move.");
  }

  const groupedDesigns = groupDsgByFromParams(rowsToGroup);
  for (const group of groupedDesigns) {
    const { OdCoCd, OdTc, OdYy, OdChr, OdNo, OdSrList } = group;

    if (!Array.isArray(OdSrList) || OdSrList.length === 0) {
      throw new Error(`Missing design serials for voucher ${OdChr}-${OdNo}`);
    }

    const inputValuesMap = {
      FromOdCoCd: OdCoCd,
      FromOdTc: OdTc,
      FromOdYy: OdYy,
      FromOdChr: OdChr,
      FromOdNo: OdNo,
      FromOdSrList: OdSrList,
      ToOdCoCd: 'ZZZ',
      ToOdTc: 'QT',
      ToOdYy: OdYy,
      ToOdChr: VoucherType,
      ToOdNo: ToOdNo,
    };

    // const designs = isFromKwargs ? group.rows : undefined;
    // await copyOrdDsg(conn, inputValuesMap, 1, designs);
    await copyOrdDsg(conn, inputValuesMap, 1);
  }

  return `Designs moved successfully to ${voucherTypeMap[VoucherType] || VoucherType}.`;
}


function groupDsgByFromParams(dsgList) {
  const grouped = {};

  for (const row of dsgList) {
    const key = `${row.OdCoCd}_${row.OdTc}_${row.OdYy}_${row.OdChr}_${row.OdNo}`;
    if (!grouped[key]) {
      grouped[key] = {
        OdCoCd: row.OdCoCd,
        OdTc: row.OdTc,
        OdYy: row.OdYy,
        OdChr: row.OdChr,
        OdNo: row.OdNo,
        OdSrList: [],
        rows: [] // holds full row objects
      };
    }

    grouped[key].OdSrList.push(row.OdSr);
    grouped[key].rows.push(row);
  }

  return Object.values(grouped);
}


async function delOrdDsg(conn, kwargs = {}, useKwargs = 0) {
  const voucherTypeMap = getVoucherTypeMap();
  const validVoucherTypes = ['CS', 'CT', 'QT']


  const inputTypeMap = {
    OdChr: sql.VarChar(5),
    OdNo: sql.Int,
  };

  const VoucherType = useKwargs ? kwargs.OdChr : conn.req.body.OdChr;
  const OdNo = conn.req.userInfo?.CsCd;

  
  validateVoucherType(validVoucherTypes, VoucherType)

  if (!OdNo) {
    throw new Error("Missing user session code (OdNo).");
  }

  const inputValuesMap = { OdChr:VoucherType, OdNo };

  await exeQuery(conn, {
    rawQuery: `DELETE FROM OrdDsg WHERE OdCoCd = 'ZZZ' AND OdChr = @OdChr AND OdNo = @OdNo`,
    inputTypeMap,
    inputValuesMap,
  });

  return `${voucherTypeMap[VoucherType] || VoucherType} cleared successfully.`;
}

function validateVoucherType(validVoucherTypes, VoucherType){
  const voucherTypeMap = getVoucherTypeMap()
  if (!validVoucherTypes.includes(VoucherType)) {
    const allowedList = validVoucherTypes
      .map(code => {
        const label = voucherTypeMap[code] || code;
        return `'${code}' (${label})`;
      })
      .join(", ");
    throw new Error(`Invalid VoucherType. Only ${allowedList} are allowed.`);
  }
}

function getVoucherTypeMap(){
  const voucherTypeMap = {
    CS: "Current Session",
    CT: "Cart",
    QT: "Quotation",
    SO: "Sales Order"
  }
  return voucherTypeMap;
}

module.exports = { getCatalogues, copyOrdDsg, moveDsg, delOrdDsg, createOrder };