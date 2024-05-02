module.exports = function(RED) {
    //#region requires
    const oracledb = require('oracledb')
    oracledb.fetchAsString = [ oracledb.CLOB ];

    //#endregion
    
    //#region Execution Node
    
    function OraclePoolExecutionNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.server = RED.nodes.getNode(config.server);
	node.maxrows = config.maxrows;
	    
        node.on('input', async function(msg, send, done) {

            let connection;

            try {
                let sql = msg.sql;
                let binds, options, result;

		node.warn(node.server);
                // dbConfig =  {
                //     user: node.server.user,
                //     password: node.server.password,
                //     connectString : `${node.server.host}:${node.server.port}/${node.server.database}`,
                //     externalAuth  : false
                //   };
                // connection = await oracledb.getConnection(dbConfig);
                connection = await node.server.pool.getConnection();

                binds = {};

                options = {
                outFormat: oracledb.OUT_FORMAT_OBJECT,   // query result format
		maxRows: node.maxrows,
		autoCommit: true,
                // extendedMetaData: true,               // get extra metadata
                // prefetchRows:     100,                // internal buffer allocation size for tuning
                // fetchArraySize:   100                 // internal buffer allocation size for tuning
                };
                result = await connection.execute(sql, binds, options);
                msg.payload = result;
            } catch (err) {
		if(done){
			done(err);
		}
		else {
			node.error(err)
		}
			
            } finally {
                if (connection) {
                    try {
                        await connection.close();
                    } catch (err) {
			if(done){
				done(err);
			}
			else {
				node.error(err)
			}
                    }
                }
            }
            node.send([msg, null]);
        });
	node.on('close', function() {
    		// tidy up any state
	});
    }
	
    //#endregion
    
    //#region Config Node
    
    function OraclePoolConfigNode(n) {
        RED.nodes.createNode(this,n);
	var node = this;
        this.host = n.host;
        this.port = n.port;
        this.database = n.database;
        this.user = n.user;
        this.password = n.password;
	this.poolMin = n.poolMin;
	this.poolMax = n.poolMax;
	this.poolIncrement = n.poolIncrement;
	this.pool = null;

	oracledb.createPool({
		user: this.user,
	    	password: this.password,
	    	connectString : `${this.host}:${this.port}/${this.database}`,
	    	externalAuth  : false,
		poolIncrement : this.poolIncrement,
            	poolMax       : this.poolMin,
            	poolMin       : this.poolMax,
		enableStatistics : true,
		// poolAlias : this.name
	}, function (err, pool){
		if (err) {
			node.warn(JSON.stringify(err));
			node.error(err);
		} else {
			node.pool = pool;
		}
	});
	    
	this.on('close', async function() {
    		await this.pool.close(5);
	});
    }

    //#endregion
    
    RED.nodes.registerType("oracle-pool", OraclePoolExecutionNode);
    RED.nodes.registerType("oracle-pool-config", OraclePoolConfigNode);

}











