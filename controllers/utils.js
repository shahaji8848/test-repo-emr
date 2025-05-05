const { getYParamRecords } = require("./yParam");

const getCatalogueFilters = async (conn) => {
    
    const design_category = await getYParamRecords(conn, {
        selectClause: 'DISTINCT PMCd, PDesc',
        whereConditions: ['PTyp = @PTyp'],
        inputValuesMap: { PTyp: 'ySubCtg' },
      });
    
      const sub_category = await getYParamRecords(conn, {
          selectClause: 'DISTINCT PMCd, PDesc',
          whereConditions: ['PTyp = @PTyp'],
          inputValuesMap: { PTyp: 'ySubCtg' },
        });

    const price_range = await getYParamRecords(conn,{
        selectClause: 'DISTINCT PMCd,PNum,PNum1, PDesc',
        whereConditions: ['PTyp = @PTyp'],
        inputValuesMap: { PTyp: 'yPrice' },
      });

    const dia_wt = await getYParamRecords(conn,{
        selectClause: 'DISTINCT PMCd,PNum,PNum1 ,PDesc',
        whereConditions: ['PTyp = @PTyp'],
        inputValuesMap: { PTyp: 'yDiaWt' },
      });

    const gross_wt = await getYParamRecords(conn,{
        selectClause: 'DISTINCT PMCd,PNum,PNum1 ,PDesc',
        whereConditions: ['PTyp = @PTyp'],
        inputValuesMap: { PTyp: 'yGrossWt' },
      });
  
    const filters = [
      { section: "Category", values: design_category },
      { section: "Sub Category", values: sub_category },
      { section: "Price", values: price_range },
      { section: "Diamond Weight", values: dia_wt },
      { section: "Gross Weight", values: gross_wt },
    ];
  
    return { doctype:"", docname:"",filters:filters };
  };

const getDsgConfig = async (conn) => {
    const metals = await getYParamRecords(conn, {
        selectClause: 'DISTINCT PMCd, PDesc',
        whereConditions: ['PTyp = @PTyp'],
        inputValuesMap: { PTyp: 'yMetal' },
      });
    
      const metal_purity = await getYParamRecords(conn, {
          selectClause: 'DISTINCT PMCd,PSCd,PDesc',
          whereConditions: ['PTyp = @PTyp'],
          inputValuesMap: { PTyp: 'yPurity' },
        });

    const tone = await getYParamRecords(conn,{
        selectClause: 'DISTINCT PMCd,PDesc',
        whereConditions: ['PTyp = @PTyp'],
        inputValuesMap: { PTyp: 'yTone' },
      });

    const dia_qlty = await getYParamRecords(conn,{
        selectClause: 'DISTINCT PMCd, PDesc',
        whereConditions: ['PTyp = @PTyp'],
        inputValuesMap: { PTyp: 'yDiaQlty' },
      });

    const dsgSz = await getYParamRecords(conn,{
        selectClause: 'DISTINCT PMCd,PNum,PDesc',
        whereConditions: ['PTyp = @PTyp'],
        inputValuesMap: { PTyp: 'yDsgSz' },
      });
  
    const filters = [
      { section: "metals", values: metals },
      { section: "metal_purity", values: metal_purity },
      { section: "tone", values: tone },
      { section: "dia_qlty", values: dia_qlty },
      { section: "design_size", values: dsgSz },
    ];
  
    return { doctype:"", docname:"",filters:filters };
}

module.exports = { getCatalogueFilters,getDsgConfig };