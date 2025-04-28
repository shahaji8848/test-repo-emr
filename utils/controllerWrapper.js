const { getConnection, sql} = require('../config/db');

/*
  This function wraps a controller function with a transaction.
  It begins a transaction, executes the controller function, and commits or rolls back the transaction based on the result.
*/

function transactionalControllerWrapper(fn) {
  return async function (req, res, next) {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();
      const conn = { transaction, sql, req, res, next };
      const result = await fn(conn);
      await transaction.commit();
      if (!res.headersSent) {
        res.json({ msg: "success", data: result });
      }
    } catch (error) {
      await transaction.rollback();
      console.error('Transaction Error:', error);
      if (!res.headersSent) {
        res.status(500).json({ msg: "error", error: error.message });
      }
    }
  };
}

module.exports = { transactionalControllerWrapper };
