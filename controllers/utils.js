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

//static response api for development purpose
async function getComponents(req, res, next){
  const { page_type } = conn.req.query;
  let response = {}

  if(page_type == 'Home Page'){
    response = {
      "message": {
          "msg": "success",
          "data": {
              "page_name": "Home Page",
              "page_url": "",
              "from_date": "2025-01-10",
              "to_date": "2025-01-24",
              "page_type": "Home Page",
              "product_category_page_layout": "",
              "filters_component": "",
              "product_card_components": "",
              "magnified_image_component": null,
              "product_information_component": null,
              "associated_component": [
                  {
                      "component": "HomeCollectionBanners",
                      "component_name": "HomeCollectionBanners",
                      "section_name": "CollectionSection",
                      "page_name": "home-page",
                      "image": "",
                      "properties": null
                  }
              ]
          },
      }
    }
  }
  else if(page_type == 'Product Category Page'){
    response = {
      "message": {
          "msg": "success",
          "data": {
              "page_name": "Product Category Page",
              "page_url": "",
              "from_date": "2025-01-09",
              "to_date": "2025-01-11",
              "page_type": "Product Category Page",
              "product_category_page_layout": "Default Layout",
              "filters_component": "Fallback Filters",
              "product_card_components": "Fallback Cards",
              "magnified_image_component": null,
              "product_information_component": null,
              "top_section_component": [
                  {
                  }
              ],
              "bottom_section_component": [
                  {}
              ]
          },
      }
    }
  }
  else{
    response = {
        "message": {
            "msg": "error",
            "error": "Invalid page_type specified.",
            "exec_time": "0.0052 seconds"
        }
    }
  }
  return res.json(response) 
}


module.exports = { getCatalogueFilters,getDsgConfig, getComponents };