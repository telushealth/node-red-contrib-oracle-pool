module.exports = function(RED) {
    //#region requires
    const oracledb = require('oracledb')
    oracledb.fetchAsString = [ oracledb.CLOB ];

    //#endregion
    
    //#region Execution Node
    
    function OraclePoolExecutionNode(config) {
        RED.nodes.createNode(this,config);
        let node = this;
        node.server = RED.nodes.getNode(config.server);
	node.maxrows = config.maxrows || 100;
	node.outputConn = config.outputConn || "close";
	    
        node.on('input', async function(msg, send, done) {
            let connection;
	    msg.payload = {};
            try {
                let sql = msg.sql;
                let binds, options, result;

                // dbConfig =  {
                //     user: node.server.user,
                //     password: node.server.password,
                //     connectString : `${node.server.host}:${node.server.port}/${node.server.database}`,
                //     externalAuth  : false
                //   };
                // connection = await oracledb.getConnection(dbConfig);
		if (msg.connection != undefined) {
			connection = this.context().global.get(msg.connection); //msg.connection;
		} else {
			connection = await node.server.pool.getConnection();
		}
                
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
			node.error(err);
		}
			
            } finally {
                if (connection) {
                    try {
			if (node.outputConn != "close") {
				this.context().global.set(msg._msgid, connection);
				msg.connection = msg._msgid;
			} else {
				await connection.close();
				if (msg.connection) {
					this.context().global.set(msg.connection, undefined);
				}
				// delete msg.connection; //à valider
			}
                    } catch (err) {
			if(done){
				done(err);
			}
			else {
				node.error(err);
			}
                    }
                }
            }
	    if (node.server.enableStatistics == true) {
		msg.payload.statistics = node.server.pool.getStatistics();
	    }
       	    node.send([msg, {inUse: node.server.pool.connectionsInUse, open: node.server.pool.connectionsOpen}]);
	    done();
        });
	node.on('close', function() {
    		// tidy up any state
	});
    }
	
    //#endregion
    
    //#region Config Node
    
    function OraclePoolConfigNode(n) {
        RED.nodes.createNode(this,n);
	let node = this;
        this.host = n.host;
        this.port = n.port;
        this.database = n.database;
        this.user = n.user;
        this.password = n.password;
	this.enableStatistics = parseBool(n.enableStatistics) || false;
	this.poolMin = parseInt(n.poolMin);
	this.poolMax = parseInt(n.poolMax);
	this.poolIncrement = parseInt(n.poolIncrement);
	this.pool = null;
	oracledb.createPool({
		user: this.user,
	    	password: this.password,
	    	connectString : `${this.host}:${this.port}/${this.database}`,
	    	externalAuth  : false,
		poolIncrement : parseInt(this.poolIncrement),
            	poolMin       : parseInt(this.poolMin),
            	poolMax       : parseInt(this.poolMax),
		enableStatistics : this.enableStatistics,
		// poolAlias : this.name
	}, function (err, pool){
		if (err) {
			node.error(err);
		} else {
			node.pool = pool;
			// node.warn("Pool created");
		}
	});
	    
	this.on('close', async function() {
    		await this.pool.close(5);
	});
    }

    //#endregion

	function parseBool(value) {
		if (value != undefined && (value.toLowerCase() == "true" || value == true)) {
			return true;
		} else {
			return false;
		}
	}
    RED.nodes.registerType("oracle-pool", OraclePoolExecutionNode);
    RED.nodes.registerType("oracle-pool-config", OraclePoolConfigNode);

}











