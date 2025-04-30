const jwt = require("jsonwebtoken");
require("dotenv").config();
const {getParamRecords} = require('./param.js');

/*
Login API
Default Condtions: Ptyp='USR', PMCd = username, PValue = password
Table: Param
Fields : PMCd, PValue
*/ 

async function login(conn) {
    let stmts ={}
    const { username, password } = conn.req.body;
    if (!username || !password) {
        return conn.res.status(400).json({ message: "Username and password are required" });
    }

    let defaultWhereConditions = ['PTyp = @PTyp','PMCd = @PMCd','PValue = @PValue'];
    
    let defaultInputTypeMap = {
        PTyp: conn.sql.VarChar(10),
        PMCd: conn.sql.VarChar(20),
        PValue: conn.sql.VarChar(20)
    };
    
    let defaultInputValuesMap = {
        PTyp: 'USR',
        PMCd: username,
        PValue: password
    };
    
    stmts.inputTypeMap = {
        ...defaultInputTypeMap,
        ...(stmts.inputTypeMap || {})
      };
    
      stmts.inputValuesMap = {
        ...defaultInputValuesMap,
        ...(stmts.inputValuesMap || {})
      };
    stmts['selectClause']='PMCd As [User], PValue As Pwd, PDesc As [full_name]';
    stmts.whereConditions = [
        ...defaultWhereConditions,
        ...(stmts.whereConditions || [])
      ];
    let loginData = await getParamRecords(conn,stmts)
    let CsCd = await getCurrentSessionCode(conn,username);
    if (loginData.length ==1) {
        const token = jwt.sign({ username,CsCd }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return {access_token:token,full_name:loginData[0]?.full_name||'' };
    }
    else {
        return { message: "Invalid username or password" };
    }
  }

async function getCurrentSessionCode(conn,username) {
    let stmts = {}
    let defaultWhereConditions = ['PTyp = @PTyp','PMCd = @PMCd'];
    
    let defaultInputTypeMap = {
        PTyp: conn.sql.VarChar(10),
        PMCd: conn.sql.VarChar(20)
    };
    
    let defaultInputValuesMap = {
        PTyp: 'yCsUSR',
        PMCd: username
    };
    
    stmts.inputTypeMap = {
        ...defaultInputTypeMap,
        ...(stmts.inputTypeMap || {})
      };
    
      stmts.inputValuesMap = {
        ...defaultInputValuesMap,
        ...(stmts.inputValuesMap || {})
      };
    stmts['selectClause']='PSCd As [CsCode]';
    stmts.whereConditions = [
        ...defaultWhereConditions,
        ...(stmts.whereConditions || [])
      ];
    stmts['from']='yParam';

    let CsCodeData = await getParamRecords(conn,stmts)
    return CsCodeData[0].CsCode;

}
  module.exports = { login };