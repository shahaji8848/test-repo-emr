const jwt = require("jsonwebtoken");
require("dotenv").config();
const { sql } = require('../config/db.js');
const { exeQuery } = require('../utils/queryHandler.js');

/*
Login API
EMR - USER - Default Condtions: Ptyp='USR', PMCd = username, PValue = password for  Table: Param
Customer - USER - Default Condtions: Ptyp='YCmUSr', PMCd = username, PValue = password for  Table: yPram
Also Create a JWT token for the user with the following payload:
{
  username: <username>,
  CsCd: <CsCd>,
  ptyp: <ptyp>
}
*/ 
async function login(conn) {
  const { username, password } = conn.req.body;

  if (!username || !password) {
    return conn.res.status(400).json({ message: "Username and password are required" });
  }

  let loginData = await checkCredentials(conn, 'Param', 'USR', username, password);

  let ptyp = 'USR';
  if (loginData.length === 0) {
    loginData = await checkCredentials(conn, 'yParam', 'YCMUSr', username, password);
    ptyp = 'YCMUSr';
  }

  if (loginData.length === 1) {
    const CsCd = await getCurrentSessionCode(conn, username, ptyp);
    const token = jwt.sign({ username, CsCd, ptyp }, process.env.JWT_SECRET, { expiresIn: '24h' });

    return conn.res.status(200).json({
      access_token: token,
      full_name: loginData[0]?.full_name || ''
    });
  } else {
    return conn.res.status(401).json({ message: "Invalid username or password" });
  }
}

async function checkCredentials(conn, tableName, ptyp, username, password) {
  const { inputTypeMap, inputValuesMap } = buildInputMaps(ptyp, username, password);

  const whereConditions = [
    `PTyp = @PTyp`,
    `PMCd = @PMCd`,
    `PValue = @PValue`
  ];

  const loginData = await exeQuery(conn, {
    selectClause: `PMCd AS [User], PValue AS Pwd, PDesc AS [full_name]`,
    from: tableName,
    whereConditions,
    inputTypeMap,
    inputValuesMap
  });

  return loginData;
}

function buildInputMaps(ptyp, username, password) {
  return {
    inputTypeMap: {
      'PTyp': sql.VarChar(10),
      'PMCd': sql.VarChar(10),
      'PValue': sql.VarChar(10)
    },
    inputValuesMap: {
      PTyp: ptyp,
      PMCd: username,
      PValue: password
    }
  };
}

async function getCurrentSessionCode(conn, username, ptyp) {
  const tableName = 'yParam';
  const sessionCode = ptyp === 'YCMUSR' ? 'C' : 'U';
  const inputTypeMap = {
    'PMCd': sql.VarChar(10),
    'PSCd': sql.VarChar(10)
  };

  const inputValuesMap = {
    PMCd: username,
    PSCd: sessionCode
  };

  const whereConditions = [
    `PTyp = 'yCsUsr'`,
    `PMCd = @PMCd`,
    `PSCd = @PSCd`
  ];

  const result = await exeQuery(conn, {
    selectClause: `PValue`,
    from: tableName,
    whereConditions,
    inputTypeMap,
    inputValuesMap
  });
  if (result.length === 0) {
    return '';
  }
  return result[0]?.PValue || '';
}

  module.exports = { login };