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
	node.typeConn = config.typeConn || "open_close";
	node.prefixConn = config.prefixConn || "";    
        node.on('input', async function(msg, send, done) {
            let connection;
	    msg.payload = {};
	    msg.oracle = msg.oracle || {};
            try {
                let sql = msg.sql;
                let binds, options, result;

		if (node.typeConn.startsWith("receive") && msg.oracle.connection != undefined && this.context().global.get(node.prefixConn + "_" + msg.oracle.connection).isHealthy()) {
			connection = this.context().global.get(node.prefixConn + "_" + msg.oracle.connection); //msg.connection;
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
			if ( node.typeConn.startsWith("open") && node.typeConn.endsWith("send")) {
				this.context().global.set(node.prefixConn + "_" + msg._msgid, connection);
				msg.oracle.connection = msg._msgid;				
			} else if (node.typeConn.startsWith("receive") && node.typeConn.endsWith("send")) {
				// this.context().global.set(node.prefixConn + "_" + msg._msgid, connection);
				// msg.oracle.connection = msg._msgid;
			} else if (node.typeConn.startsWith("receive") && node.typeConn.endsWith("close")) {
				if (msg.oracle.connection) {
					await connection.close();
					this.context().global.set(node.prefixConn + "_" + msg.oracle.connection, undefined);
					delete msg.oracle.connection;
				}				
			} else {
				await connection.close();
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
		msg.oracle.statistics = node.server.pool.getStatistics();
	    }
	    node.status({text: node.server.pool.connectionsOpen + "/" + node.server.pool.connectionsInUse})
       	    node.send([msg, null]);
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
	oracledb.autoCommit = true;
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











