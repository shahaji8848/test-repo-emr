const { getYParamRecords } = require("./yParam");

const getCatalogueFilterMasters = async (conn) => {
    
    const design_category = await getYParamRecords(conn, {
        selectClause: 'DISTINCT PMCd, PDesc',
        whereConditions: ['PTyp = @PTyp'],
        inputValuesMap: { PTyp: 'yDmCtg' },
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
  const { page_type } = req.query;
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
  else if(page_type == ' Product Page'){
    response ={
    "message": {
        "msg": "success",
        "data": {
            "page_name": "Product Page",
            "page_url": "",
            "from_date": "",
            "to_date": "",
            "page_type": "Product Page",
            "product_category_page_layout": "",
            "filters_component": "",
            "product_card_components": "",
            "magnified_image_component": "Image Thumbnails at the Bottom",
            "product_information_component": "Fallback Product Information",
            "top_section_component": [
            ],
            "bottom_section_component": [
            ]
        },
    }
  }

}
else if(page_type == 'Cart Page'){
  response ={
      "message": {
          "msg": "success",
          "data": {
              "page_name": "Cart Page",
              "page_url": "",
              "from_date": "",
              "to_date": "",
              "page_type": "Cart Page",
              "product_category_page_layout": "",
              "filters_component": "",
              "product_card_components": "",
              "magnified_image_component": null,
              "product_information_component": null,
              "associated_component": [
                  {
                      "component": "FallbackCartComponent",
                      "component_name": "FallbackCartComponent",
                      "section_name": "PersonalisedCart",
                      "page_name": "cart-page",
                      "properties": null
                  }
              ]
          },
          "exec_time": "0.0138 seconds"
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


//static response api for development purpose
async function settings(req, res, next){
  return res.json({"data": {
        "name": "Settings",
        "owner": "Administrator",
        "modified": "",
        "modified_by": "Administrator",
        "docstatus": 0,
        "idx": "0",
        "enable_user_based_menu": 1,
        "variant_type": "Image",
        "header_component": "Fallback Navbar",
        "font_family": "Nunito",
        "show_variant_on_product_card": 1,
        "variant_attribute_on_product_card": "",
        "footer_component": "Fallback Footer",
        "summit_screens_error_message": []
    }}) 
}


module.exports = { getCatalogueFilterMasters, getDsgConfig, getComponents, settings };