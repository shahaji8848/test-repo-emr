const { exeQuery } = require('../utils/queryHandler');

async function insertCsFltrs(conn) {
        const { CsFltr } = conn.req.body;
        const { CsCd } = conn.req.userInfo;
        const { transaction, sql } = conn;

        const request = new sql.Request(transaction);

        const result = await request
            .input('CsCd', sql.VarChar(3), CsCd)
            .input('CsFltr', sql.NVarChar(sql.MAX), JSON.stringify(CsFltr))
            .query(`
                IF EXISTS (SELECT 1 FROM yCsFltr WHERE CsCd = @CsCd)
                BEGIN
                    UPDATE yCsFltr SET CsFltr = @CsFltr WHERE CsCd = @CsCd;
                    SELECT 'updated' AS Action;
                END
                ELSE
                BEGIN
                    INSERT INTO yCsFltr (CsCd, CsFltr) VALUES (@CsCd, @CsFltr);
                    SELECT 'inserted' AS Action;
                END
            `);

        const action = result.recordset?.[0]?.Action || 'unknown';
        return {
            message: `Filter ${action} successfully`,
            action: action
        };
   
}
async function getCsFilters(conn) {
    const { CsCd } = conn.req.userInfo;
    const defaultWhereConditions = ['CsCd  = @CsCd'];
    const defaultInputTypeMap = {
        CsCd: conn.sql.Int,
       
      };
      const defaultInputValuesMap = {
        CsCd: CsCd
    };
    let stmts = {}
      stmts.selectClause =  'CsFltr'
      stmts.from = 'yCsFltr';
    
      stmts.whereConditions = [
        ...defaultWhereConditions,
        ...(stmts.whereConditions || [])
      ];
    
    
      stmts.inputTypeMap = {
        ...defaultInputTypeMap,
        ...(stmts.inputTypeMap || {})
      };
    
      stmts.inputValuesMap = {
        ...defaultInputValuesMap,
        ...(stmts.inputValuesMap || {})
      };
      let CsFltr=  await exeQuery(conn, stmts);
      if (CsFltr.length == 0) {
        return {
          CsFltr: {
            selectedScope: {
              "label": "Database",
              "value": "Database"
          }
          }
        };
      } else {
        return {
          CsFltr: JSON.parse(CsFltr[0].CsFltr)
        };
      }
      
     
    }


module.exports = { insertCsFltrs,getCsFilters };
