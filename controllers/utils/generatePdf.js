const fs = require('fs');
const path = require('path');
const nunjucks = require('nunjucks');  // Nunjucks for templating
const pdf = require('html-pdf');
const { promisify } = require('util');
const { getCatalogueDetails } = require('../ordDsg'); // Assuming this is the correct path to your function
const { sql } = require('../../config/db');
const { exeQuery } = require('../../utils/queryHandler.js');

// Template rendering function using Nunjucks
async function renderTemplate(templateFilePath, context) {
  const template = await promisify(fs.readFile)(templateFilePath, 'utf-8');
  const rendered = nunjucks.renderString(template, context); // Rendering with Nunjucks
  return rendered;
}

// PDF generation function
// generateSoPdf
async function generateSoPdf(conn) {
    const {req, res} = conn;
    const {orderData} = req.query;
    console.log("orderData", orderData)
    let orderDetails = await getOrderDetails(conn,orderData)
    console.log("orderDetails", orderDetails)
    const templatePath = path.join(__dirname, '..', '..', 'templates', 'sales_order.html');
    const renderedHtml = await renderTemplate(templatePath, { order_data: orderDetails });
  
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="sales_order.pdf"');
  
    return new Promise((resolve, reject) => {
      pdf.create(renderedHtml).toStream((err, stream) => {
        if (err) {
          console.error("Error generating PDF: ", err);
          res.status(500).send("Error generating PDF");
          reject(err);
        } else {
          stream.pipe(res);
          stream.on('end', () => {
            // Let wrapper know response was handled
            resolve({ streamed: true });
          });
        }
      });
    });
  }

  async function getOrderDetails(conn, orderData) {
    const [OdCoCd, OdTc, OdYyStr, OdChr, OdNoStr] = orderData.split('-');
    const OdYy = parseInt(OdYyStr, 10);
    const OdNo = parseInt(OdNoStr, 10);
  
    const inputTypeMap = {
      'OdCoCd': sql.VarChar(5),
      'OdTc': sql.VarChar(5),
      'OdYy': sql.Int,
      'OdChr': sql.VarChar(5),
      'OdNo': sql.Int,
    };
    const inputValuesMap = { OdCoCd, OdTc, OdYy, OdChr, OdNo };
  
    // 1. Get OrdMst
    const ordMstQuery = `
      SELECT * FROM OrdMst 
      WHERE OmCoCd = @OdCoCd AND OmTc = @OdTc AND OmYy = @OdYy AND OmChr = @OdChr AND OmNo = @OdNo
    `;
    const ordMstResult = await exeQuery(conn, {
      rawQuery: ordMstQuery,
      inputTypeMap,
      inputValuesMap
    });
  
    const ordMst = ordMstResult[0] || {};
  
    // 2. Get all OrdDsg
    const ordDsgQuery = `
      SELECT * FROM OrdDsg 
      WHERE OdCoCd = @OdCoCd AND OdTc = @OdTc AND OdYy = @OdYy AND OdChr = @OdChr AND OdNo = @OdNo
    `;
    const ordDsgList = await exeQuery(conn, {
      rawQuery: ordDsgQuery,
      inputTypeMap,
      inputValuesMap
    });
  
    const ord_dsg = [];
  
    for (const dsg of ordDsgList) {
      const OdSr = dsg.OdSr;
  
      // Create extended input maps for Sr
      const fullInputValuesMap = { ...inputValuesMap, OdSr };
      const extendedInputTypeMap = { ...inputTypeMap, OdSr: sql.Int };
  
      // 3. Get OrdRm for current OdSr
      const ordRmQuery = `
        SELECT * FROM OrdRm 
        WHERE OrCoCd = @OdCoCd AND OrTc = @OdTc AND OrYy = @OdYy AND OrChr = @OdChr AND OrNo = @OdNo AND OrSr = @OdSr
      `;
      const ordRmList = await exeQuery(conn, {
        rawQuery: ordRmQuery,
        inputTypeMap: extendedInputTypeMap,
        inputValuesMap: fullInputValuesMap
      });
  
      // 4. Get OrdLab for current OdSr
      const ordLabQuery = `
        SELECT * FROM OrdLab 
        WHERE OlCoCd = @OdCoCd AND OlTc = @OdTc AND OlYy = @OdYy AND OlChr = @OdChr AND OlNo = @OdNo AND OlSr = @OdSr
      `;
      const ordLabList = await exeQuery(conn, {
        rawQuery: ordLabQuery,
        inputTypeMap: extendedInputTypeMap,
        inputValuesMap: fullInputValuesMap
      });
  
      ord_dsg.push({
        ...dsg,
        ord_rm: ordRmList,
        ord_lab: ordLabList
      });
    }
  
    return {
      ...ordMst,
      ord_dsg
    };
  }
  
  
  
module.exports = {
  generateSoPdf
};
