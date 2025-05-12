const { exeQuery } = require('../utils/queryHandler.js');
const { sql } = require('../config/db.js');

const { copyOrdRm } = require('../controllers/ordRm.js');

const { copyOrdLab } = require('../controllers/ordLab.js');


// Main function to fetch catalogues based on dynamic filters
async function getCatalog(conn){
  const kwargs = conn.req.body;
  console.log(kwargs)
  // const { CsCd } = conn.req.userInfo?.CsCd; // Extract user info from request
  const { CsCd } = 1; // Extract user info from request

  const inputTypeMap = {};     // Maps parameter names to SQL types
  const inputValuesMap = {};   // Maps parameter names to their values

  // Generate JOIN tables based on filters
  const joinTables = getCatalogueJoinTables(kwargs);

  // Build dynamic WHERE conditions
  const whereConditions = getCatalogueWhereConditions(kwargs, inputTypeMap, inputValuesMap, CsCd);

  // Build dynamic HAVING conditions (aggregate filters)
  const havingConditions = getCatalogueHavingConditions(kwargs, inputTypeMap, inputValuesMap, CsCd);

  const orderByClause = getCatalogueOrderBy(kwargs)


  // SELECT clause with calculated weights using conditional aggregation
  const selectClause = `Distinct OdCoCd, OdTc, OdYy, OdChr, OdNo, OdSr, OdDmCd, CAST(ROUND(OdSalPrc, 4) AS DECIMAL(18,4)) as OdSalPrc, OdKt,
    CAST(ROUND(SUM(CASE WHEN Rm.OrRmCtg IN ('D', 'C') THEN Rm.OrWt / 5 ELSE Rm.OrWt END), 4) AS DECIMAL(18,4)) AS GrWt,
    CAST(ROUND(SUM(CASE WHEN Rm.OrRmCtg = 'D' THEN Rm.OrWt ELSE 0 END), 4) AS DECIMAL(18,4)) AS DiaWt,
    CAST(ROUND(SUM(CASE WHEN Rm.OrRmCtg = 'C' THEN Rm.OrWt ELSE 0 END), 4) AS DECIMAL(18,4)) AS CsWt
  `;

  return await exeQuery(conn, {
    selectClause,
    from: 'OrdDsg',
    whereConditions,
    joinTables,
    groupByClause: 'OdCoCd, OdTc, OdYy, OdChr, OdNo, OdSr, OdDmCd, OdKt, OdSalPrc',
    havingConditions,
    orderByClause,
    inputTypeMap,
    inputValuesMap
  });
};

// Helper to generate JOIN clauses based on request filters
function getCatalogueJoinTables(kwargs) {
  const joins = [
    `OrdMst ON OdCoCd = OmCoCd AND OdTc = OmTc AND OdYy = OmYy AND OdChr = OmChr AND OdNo = OmNo`,
    `OrdRm Rm ON Rm.OrCoCd = OdCoCd AND Rm.OrTc = OdTc AND Rm.OrYy = OdYy AND Rm.OrChr = OdChr AND Rm.OrNo = OdNo AND Rm.OrSr = OdSr`,
  ];

  // Add DsgMst join if category or sales category filters are applied
  if (isNonEmptyValue(kwargs?.DmCtg) || isNonEmptyValue(kwargs?.DmSalCtg)) {
    joins.push(`DsgMst ON DmTcTyp = OdDmTcTyp AND DmCd = OdDmCd AND DmSz = ''`);
  }

  // Add DsgPrm join if design parameter filter is used
  if (isNonEmptyValue(kwargs?.DpCd)) {
    joins.push(`DsgPrm ON DpTyp = 'CAT' AND DpDmCd = OdDmCd`);
  }

  return joins;
}

// Helper to create WHERE conditions dynamically
function getCatalogueWhereConditions(kwargs = {}, inputTypeMap, inputValuesMap, CsCd) {
  const fields = ['DmCtg', 'DmSalCtg', 'OdSalPrc', 'OdDmCol', 'DpCd', , 'DsgAna'];
  const conditions = [ `OmCmCd = 'ZSELF'`]; // Default filters
  let cond
  
  if (kwargs.scope === 'Cs') {
    conditions.push(`OdCoCd = 'ZZZ' AND OdTc = 'QT' AND OdChr = 'CS' AND OdNo = @CsCd`);
    addInputMap('CsCd', CsCd, inputTypeMap, inputValuesMap, 'CsCd');
  } else {
    conditions.push(`OdTc = 'PL'`);
  }
  
  fields.forEach((field) => {
    const value = kwargs[field];
    if (!isNonEmptyValue(value)) return;
    if (field === 'OdSalPrc') {
      addRangeConditions(field, value, inputTypeMap, inputValuesMap, conditions);
    } 
    else if (field === 'DmSalCtg'){
        const paramNames = value.map((_, i) => `@${field}_${i}`);
        conditions.push(`(
          DmSalCtg IN (${paramNames}) OR
          DmSalCtg2 IN (${paramNames}) OR
          DmSalCtg3 IN (${paramNames})
        )`);
        addInputMap(field, value, inputTypeMap, inputValuesMap, field);
    } else if (field === 'DsgAna') {
        const anaConds = value.map(([sr, cd], i) => {
          addInputMap( `AnaSr_${i}`, String(sr), inputTypeMap, inputValuesMap, 'AnaSr');
          addInputMap(`AnaCd_${i}`, cd, inputTypeMap, inputValuesMap, 'AnaCd');
          return `(DaAnaSr = @AnaSr_${i} AND DaAnaCd = @AnaCd_${i})`;
        }).join(' OR ');
  
        conditions.push(`
          EXISTS (
            SELECT DaCd FROM DsgAna
            WHERE DaTcTyp = 'DM' AND DaCd = OdDmCd AND DaSz = '' AND (${anaConds})
            GROUP BY DaCd
            HAVING COUNT(DISTINCT CONCAT(DaAnaSr, '_', DaAnaCd)) = ${value.length}
          )
        `);
      }
    else {
      addInClause(field, value, field, conditions);
      addInputMap(field, value, inputTypeMap, inputValuesMap, field);
    }
    
  });

  const DmCdConditions = getDmCdConditions(kwargs, inputTypeMap, inputValuesMap)

  if (isNonEmptyValue(DmCdConditions)) {
    conditions.push(DmCdConditions);
  }

  return conditions;
}

// Helper to create DmCd conditions (on aggregated values)
function getDmCdConditions(kwargs, inputTypeMap, inputValuesMap) {
  const fields = ['OdDmCd', 'RangeOdDmCd'];
  const orConditions = [];

  fields.forEach((field) => {
    const value = kwargs[field];
    if (!isNonEmptyValue(value)) return;

    if (field === 'RangeOdDmCd') {
      addRangeConditions('OdDmCd', value, inputTypeMap, inputValuesMap, orConditions);
    } 
    else {
      addInClause(field, value, field, orConditions);
      addInputMap(field, value, inputTypeMap, inputValuesMap, field);
    }
    
  });
  
  if (isNonEmptyValue(orConditions)) {
    return`(${orConditions.join(' OR ')})`;
  }
}

// Helper to create HAVING conditions (on aggregated values)
function getCatalogueHavingConditions(kwargs = {}, inputTypeMap, inputValuesMap) {
  const fields = ['GrWt', 'DiaWt', 'CsWt', 'CsAvl'];
  const conditions = [];

  fields.forEach((field) => {
    const value = kwargs[field];
    if (!value && value !== false) return;

    if (field === 'CsAvl') {
      if (value === 'Yes') {
        conditions.push(`${getExpr('CsWt')} != 0`);
      } else if (value === 'No') {
        conditions.push(`${getExpr('CsWt')} = 0`);
      }
    } else {
      addRangeConditions(field, value, inputTypeMap, inputValuesMap, conditions);
    }
  });

  return conditions;
}

// Helper to generate Order By clauses based on request filters
function getCatalogueOrderBy(kwargs) {
  return kwargs?.sortBy || `OdSalPrc Asc`;
}

// Maps field to corresponding SQL expression
function getExpr(field) {
  const map = {
    GrWt: `ROUND(SUM(CASE WHEN Rm.OrRmCtg IN ('D', 'C') THEN Rm.OrWt / 5 ELSE Rm.OrWt END), 4)`,
    DiaWt: `ROUND(SUM(CASE WHEN Rm.OrRmCtg = 'D' THEN Rm.OrWt ELSE 0 END), 4)`,
    CsWt: `ROUND(SUM(CASE WHEN Rm.OrRmCtg = 'C' THEN Rm.OrWt ELSE 0 END), 4)`,
  };
  return map[field] || field;
}

function parseRangeString(rangeStr) {
  if (typeof rangeStr !== 'string') {
    throw new Error(`Invalid range: expected a string. Got: ${typeof rangeStr}`);
  }

  const trimmed = rangeStr.trim();
  const parts = trimmed.split('-').map(p => p.trim());

  if (parts.length !== 2) {
    throw new Error(`Invalid range format: "${rangeStr}". Expected format like "min-max", e.g. "0-100", "a-z"`);
  }

  const [start, end] = parts;

  // Try to convert to numbers; if conversion fails, keep as string
  const startNum = Number(start);
  const endNum = Number(end);

  const parsedStart = isNaN(startNum) ? start : startNum;
  const parsedEnd = isNaN(endNum) ? end : endNum;

  return [parsedStart, parsedEnd];
}

// Helper to add BETWEEN clauses for filters
function addRangeConditions(field, ranges, inputTypeMap, inputValuesMap, conditions) {
  const expr = getExpr(field);
  const subConditions = [];

  ranges.forEach((range, idx) => {
    if (typeof range === 'string') {
      range = parseRangeString(range);
    }
    const [from, to] = range;
    const fromKey = `$from${field}_${idx}`;
    const toKey = `$to${field}_${idx}`;

    if (isNonEmptyValue(from) && isNonEmptyValue(to)){
      subConditions.push(`(${expr} BETWEEN @${fromKey} AND @${toKey})`);
      addInputMap(fromKey, from, inputTypeMap, inputValuesMap, field)
      addInputMap(toKey, to, inputTypeMap, inputValuesMap, field)
    }
    else{
      const rangeCondition = []
      if(isNonEmptyValue(from)){
        rangeCondition.push(`${expr} >= @${fromKey}`)

        addInputMap(fromKey, from, inputTypeMap, inputValuesMap, field)
      }
      if(isNonEmptyValue(to)){
        rangeCondition.push(`${expr} <= @${toKey}`)
        addInputMap(toKey, to, inputTypeMap, inputValuesMap, field)
      }
      if (isNonEmptyValue(rangeCondition)){
        subConditions.push(`(${rangeCondition.join(' AND ')})`)

      }
    }
  });

  if (subConditions.length) {
    conditions.push(`(${subConditions.join(' OR ')})`);
  }
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
    DmSalCtg: sql.VarChar(5),
    OdSalPrc: sql.Float,
    GrWt: sql.Float,
    DiaWt: sql.Float,
    CsAvl: sql.VarChar(3),
    OdDmCol: sql.VarChar(5),
    CsWt: sql.Float,
    CsAvl: sql.VarChar(3),
    OdDmCd: sql.VarChar(15),
    AnaSr: sql.VarChar(2),
    AnaCd: sql.VarChar(8)
  };
}

async function getTargetHeaderDetails(conn, inputValuesMap){

  
  const inputTypeMap = getcopyOrdDsgInputTypeMap();
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
  inputValuesMap["ToOdOmIdNo"] = ToOdOmIdNo
  if (!ToOdOmIdNo) {
    throw new Error(`Target OmIdNo (OrdMst) not found for ToOd* values.`);
  }

  // Determine starting OdSr for the target voucher
  let ToOdSr = 1;
  const resultToOdSr = await exeQuery(conn, {
    selectClause: `MAX(OdSr) as OdSr`,
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
    ToOdSr = resultToOdSr[0].OdSr + 1;
  }
  return ToOdSr

}

//Placeholder api
async function copyOrdDsg(conn, kwargs = {}, useKwargs = 0) {
  let dsgList = []
  const inputTypeMap = getcopyOrdDsgInputTypeMap()
  let params = {}
  let ToOdCoCd, ToOdTc, ToOdYy, ToOdChr, ToOdNo;


  // Extract input based on source (kwargs or req.body)
  if (useKwargs) {
    ({ dsgList = [], Cmcd, Cscd, ToOdTc,   ...params } = kwargs);
  } else {
    ({ dsgList = [], Cmcd, Cscd, ToOdTc, ...params } = conn.req.body);
  }

  toInputValuesMap = {
  }

  //example data
  if (ToOdTc == "SO"){
    ToOdCoCd = "MW"
    ToOdYy = 22,
    ToOdChr = 'REG',
    ToOdNo = 1264
  }
  else{
    ToOdCoCd = 'ZZZ',
    ToOdYy = 22,
    ToOdChr = 'QT',
    ToOdNo = Cscd
  }

  toInputValuesMap = {
    ToOdCoCd,
    ToOdTc,
    ToOdYy,
    ToOdChr,
    ToOdNo
  }

  // fetch target header details
  let ToOdSr = await getTargetHeaderDetails(conn, toInputValuesMap)
  // Loop through each design row to copy
  const finalResult = [];
  for (const row of dsgList) {
    const localInputValuesMap = {
      FromOdCoCd: row.OdCoCd,
      FromOdTc: row.OdTc,
      FromOdYy: row.OdYy,
      FromOdChr: row.OdChr,
      FromOdNo: row.OdNo,
      FromOdSr: row.OdSr,
      OdSalPrc: row.OdSalPrc,
      OdOrdQty: row.quantity,
      ...toInputValuesMap,
      ToOdSr
    };
  
    const rawQuery = getCopyOrdDsgInsertSelectQuery();
  
    const result = await exeQuery(conn, {
      rawQuery,
      inputTypeMap,
      inputValuesMap: localInputValuesMap
    });
  
    const OrdDsg = result[0];
    const ToOdIdNo = OrdDsg?.OdIdNo;
  
    if (ToOdIdNo) {
      const childKwargs = {
        ...localInputValuesMap,
        ToOdIdNo
      };
  
      const OrdRm = await copyOrdRm(conn, childKwargs);
      const OrdLab = await copyOrdLab(conn, childKwargs);
  
      OrdDsg.OrdRm = OrdRm || [];
      OrdDsg.OrdLab = OrdLab || [];
    } else {
      OrdDsg.OrdRm = [];
      OrdDsg.OrdLab = [];
    }
  
    finalResult.push(OrdDsg);
    ToOdSr++;
  }
  
  return finalResult
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

function getCopyOrdDsgInsertSelectQuery() {
  const columns = getOrdDsgColumns();

  // Destination columns
  const insertColumns = columns.map(col => `[${col}]`).join(', ');

  // Source expressions (can be param replacements or source fields)
  const selectExpressions = columns.map(col => {
    switch (col) {
      case "OdCoCd": return "@ToOdCoCd";
      case "OdTc": return "@ToOdTc";
      case "OdYy": return "@ToOdYy";
      case "OdChr": return "@ToOdChr";
      case "OdNo": return "@ToOdNo";
      case "OdSr": return "@ToOdSr";
      case "OdCrmFixPrcYN": return "''"; // Blank value for validation
      case "OdOmIdNo": return "@ToOdOmIdNo";
      case "OdSalPrc": return "@OdSalPrc"; 
      case "OdOrdQty": return "@OdOrdQty"; // Quantity from input
      default: return `[${col}]`; // Take directly from source row
    }
  }).join(', ');

  // Prepare query
  const insertQuery = `
    DECLARE @InsertedData TABLE(${columns.map(col => `[${col}] NVARCHAR(MAX)`).join(', ')}, [OdIdNo] INT);

    INSERT INTO OrdDsg (${insertColumns})
    OUTPUT ${columns.map(col => `INSERTED.[${col}]`).join(', ')}, INSERTED.[OdIdNo] INTO @InsertedData
    SELECT ${selectExpressions}
    FROM OrdDsg
    WHERE OdCoCd = @FromOdCoCd
      AND OdTc = @FromOdTc
      AND OdYy = @FromOdYy
      AND OdChr = @FromOdChr
      AND OdNo = @FromOdNo
      AND OdSr = @FromOdSr;

    SELECT * FROM @InsertedData;
  `;

  return insertQuery;
}

function isNonEmptyValue(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === "string" && val.trim() === "") return false;
  if (typeof val === "number" && val === 0) return false;
  if (Array.isArray(val) && val.length === 0) return false;
  if (
    typeof val === "object" &&
    !Array.isArray(val) &&
    val.constructor === Object &&
    Object.keys(val).length === 0
  ) return false;
  return true;
}

async function createOrder(conn, kwargs = {}, useKwargs = 0) {

  if (useKwargs) {
    ({ dsgList = [] } = kwargs); // <-- Note the parentheses
  } else {
    ({ dsgList = [] } = conn.req.body); // <-- Note the parentheses
  }


  const CmCd = conn.req.userInfo?.CsCd; //customer
  const CsCd =  conn.req.userInfo?.username

  //target header details
  const inputValuesMap = {
    dsgList,
    CmCd,
    CsCd,
    ToOdTc: 'SO',
  };

  //placeholder api
  let data = await copyOrdDsg(conn, inputValuesMap, 1);

  return {
    msg: `Order Created Successfully.`,
    data:data
  }
}




async function moveDsg(conn, kwargs = {}, useKwargs = 0, sourceRows = []) {
  
  if (useKwargs) {
    ({ dsgList = [] } = kwargs); // <-- Note the parentheses
  } else {
    ({ dsgList = [] } = conn.req.body); // <-- Note the parentheses
  }
  const voucherTypeMap = getVoucherTypeMap()
  const validVoucherTypes = ['CS', 'CT']
  const VoucherType = isFromKwargs ? kwargs.ToOdChr : conn.req.body.ToOdChr;
  if(VoucherType == 'CS'){
    let csFilters = await getCsFilters(conn)
    csFilters = csFilters.CsFltr
    const keys = Object.keys(csFilters);
    const nonEmptyKeys = keys.filter(key => {
      if (key === "selectedScope") return false;
      return isNonEmptyValue(csFilters[key]);
    });

    if (nonEmptyKeys.length === 0) {
      throw new Error(`Cannot set current session if CsFilters are empty`);
    }
  }

  validateVoucherType(validVoucherTypes, VoucherType)

  const CmCd = conn.req.userInfo?.username; //customer
  const CsCd =  conn.req.userInfo?.CsCd

  //target header details
  const inputValuesMap = {
    dsgList,
    CmCd,
    CsCd,
    ToOdTc: VoucherType,
  };

  //placeholder api
  let data = await copyOrdDsg(conn, inputValuesMap, 1);
 

  return `Designs moved successfully to ${voucherTypeMap[VoucherType] || VoucherType}.`;
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

async function getCatalogueDetails(conn){
  const { item,  ...Params } = conn.req.query;
  const [OdCoCd,OdTc, OdYyStr, OdChr, OdNoStr, OdSrStr] = item.split('-');

  const OdYy = parseInt(OdYyStr, 10);
  const OdNo = parseInt(OdNoStr, 10);
  const OdSr = parseInt(OdSrStr, 10);
  
  const inputTypeMap = {
    'OdCoCd': sql.VarChar(5),
    'OdTc': sql.VarChar(5),
    'OdYy': sql.Int,
    'OdChr': sql.VarChar(5),
    'OdNo': sql.Int,
    'OdSr': sql.Int,
  };     
  const inputValuesMap = {OdCoCd, OdTc, OdYy, OdChr, OdNo, OdSr}; 

  const whereConditions = [
    `OdCoCd = @OdCoCd`,
    `OdTc = @OdTc`,
    `OdYy = @OdYy`,
    `OdChr = @OdChr`,
    `OdNo = @OdNo`,
    `OdSr = @OdSr`
  ];

  const joinTables = [
    `OrdMst ON OdCoCd = OmCoCd AND OdTc = OmTc AND OdYy = OmYy AND OdChr = OmChr AND OdNo = OmNo`,
    `OrdRm Rm ON Rm.OrCoCd = OdCoCd AND Rm.OrTc = OdTc AND Rm.OrYy = OdYy AND Rm.OrChr = OdChr AND Rm.OrNo = OdNo AND Rm.OrSr = OdSr`,
  ];

  // SELECT clause with calculated weights using conditional aggregation
  const selectClause = `OdCoCd, OdTc, OdYy, OdChr, OdNo, OdSr, OdDmCd, CAST(ROUND(OdSalPrc, 4) AS DECIMAL(18,4)) as OdSalPrc, OdKt,
    CAST(ROUND(SUM(CASE WHEN Rm.OrRmCtg IN ('D', 'C') THEN Rm.OrWt / 5 ELSE Rm.OrWt END), 4) AS DECIMAL(18,4)) AS GrWt,
    CAST(ROUND(SUM(CASE WHEN Rm.OrRmCtg = 'D' THEN Rm.OrWt ELSE 0 END), 4) AS DECIMAL(18,4)) AS DiaWt,
    CAST(ROUND(SUM(CASE WHEN Rm.OrRmCtg = 'C' THEN Rm.OrWt ELSE 0 END), 4) AS DECIMAL(18,4)) AS CsWt
  `;

  let CatalogueData = await exeQuery(conn, {
    selectClause,
    from: 'OrdDsg',
    whereConditions,
    joinTables,
    groupByClause: 'OdCoCd, OdTc, OdYy, OdChr, OdNo, OdSr, OdDmCd, OdSalPrc, OdKt',
    orderByClause: `OdSalPrc`,
    inputTypeMap,
    inputValuesMap
  });
  return CatalogueData[0] || {};
};


module.exports = { getCatalog, copyOrdDsg, moveDsg, delOrdDsg, createOrder,getCatalogueDetails };
