/*
 *  gdbMI for node.js.
 * 
 *  A simple wrapper around the gdbMI interface for Node.js
 * 
 *  2014 Jean-Baptiste BESNARD.
 * 
 */
 
 /*###############################################################
  #                   GDB WRAPPER DEFINITION                     #
  # Defines how gdbMI is interfaced with the undelying gdb       #
  # process. This is simply a way of defining a read/write       #
  # interface on top of node event notification system. This     #
  # way new wrappers can be defined to define other data sources #
  ##############################################################*/

var spawn = require('child_process').spawn;
var exec = require('child_process').exec;

/* This creates a gdb process on a given command
 * this object is a generic interface to the spawn
 * command as we want to be able to listen on other
 * types of streams for example sockets or whatever...
 * 
 * Interface of a gdbMI wrapper is the following:
 * 
 *  .init( program_and_args ) : called to instantiate the interface
 *  .write() : used to send data to the gdb process
 *  .interrupt() : sends a SIGINT to a PID
 *  .onData() : calls the wrapper function when data are available
 *  .onClose() : calls the wrapper function when the stream ends
 *  .onError() : calls the wrapper function when an error occurs
 * 
 *  */

function gdbProcessWrapper( command_and_args )
{
	/* ############################################## */
	/* ############################################## */
	
	/* Initialize */
	gdbProcessWrapper.prototype.init = function(command_and_args)
	{
		if( !command_and_args )
			command_and_args = "";

		var cmd = command_and_args.trim().split(" ");
		
		if( cmd.length == 0 )
		{
			throw("No command provided");
		}

		var gdb_args = [ "--interpreter=mi",'--readnow',"--quiet", "--args" ].concat( cmd );
		
		
		try
		{
			this.gdb_instance = spawn( "gdb", gdb_args, {detached : true} );
		}
		catch(e)
		{
			console.log("Error launching the gdb child process");
			console.dir(e);
			return 1;
		}
		
		return 0;
	}
	
	/* Write */
	gdbProcessWrapper.prototype.write = function( data )
	{
		try
		{
			this.gdb_instance.stdin.write( data );
		}
		catch(e)
		{
			console.log("Error writing to the gdb instance");
			console.dir(e);
			return 1;
		}
		
		return 0;
	};
	
	gdbProcessWrapper.prototype.interrupt = function( pid )
	{
		exec("kill -s 2 " + pid);
		return 0;
	};
	
	/* On data */
	gdbProcessWrapper.prototype.onData = function (handler)
	{
		this.gdb_instance.stdout.on("data", handler );
		/* handler( data ) */	
	}
	
	/* On close */
	gdbProcessWrapper.prototype.onClose = function (handler)
	{
		this.gdb_instance.on("close", handler );	
		/* handler( return_code, signal ) */
	}

	/* On error */
	gdbProcessWrapper.prototype.onExit = function (handler)
	{
		this.gdb_instance.on("exit", handler );	
		/* handler(  return_code, signal  ) */
	}
	
	/* On error */
	gdbProcessWrapper.prototype.onError = function (handler)
	{
		this.gdb_instance.on("error", handler );	
		/* handler( error ) */
	}
	
	/* ############################################## */
	/* ############################################## */
	/* Constructor */
	this.gdb_instance = undefined;
	
}

 /*################################################################
  #                        gdbMI instance                         #
  # This is the definition of the gdbMI instance which can be     #
  # used to communicate with a gdb instace through the gdb/MI     #
  # interface. It produces json output and matches commands with  #
  # javascript calls. This module only provide ALL the commands   #
  # of the gdb/MI interface it is not intended for state handling #
  #################################################################*/

var events = require('events');

/* Utilities */

/* Yes javascript does not handle string subscripts ... */
String.prototype.setCharAt = function(index,chr) {
	if(this.length <= index)
		return str;
	
	return this.substr(0,index) + chr + this.substr(index+1);
}

/* Rebuild string from lines with an offset indicator */
function rebuildString( target_array, count )
{
	var ret = "";
	
	if( !target_array )
		throw("No array provided");
	
	if( !count || (target_array.length < count) )
		count = target_array.length;
	
	for( i = (target_array.length - count) ; i < target_array.length ; i++ )
	{
		ret += target_array[i] + "\n";
	}
	
	return ret;
}


/* Remove labels inside arrays */
function removeArrayLabels( args )
{
	/* We now have to handle labels inside arrays */

	var t_in_array = [];
	var in_array = 0;
	var i = 0;
	for( i = 0 ; i < args.length ; i++ )
	{
		if( args[i] == "[" )
			t_in_array.push(1);
		
		if( args[i] == "{" )
			t_in_array.push(0);
		
		if( args[i] == "]" || args[i] == "}" )
			t_in_array.pop();
		
		in_array = t_in_array[ t_in_array.length - 1 ];
		
		/* If we encounter a ',"' inside an array delete until the '":' */
		if( in_array && (args[i] == "," || args[i] == "[") && args[i+1] == "\"" )
		{
			var k = i;
			
			while( (k < args.length) 
				&& (args[k] != ":")
				&& (args[k] != "=")
				&& (args[k] != "]") )
				{
					k++;
				}
				
				if(  args[k] == ":" || args[k] == "=" )
				{
					var l;
					
					for( l=(i+1) ; l <= k ; l++ )
					{
						args = args.setCharAt(l,' ');
					}
					
				}
			
			
		}
	}
	
	return args;
}


function gdbMI( gdbWrapper, command_and_args, options )
{
	/* ############################################## */
	/* ############################################## */	

	/* Wrapper interface */
	gdbMI.prototype.onData = function( data )
	{
		var full_data = this.input_buffer + data;
		this.input_buffer = "";
		
		/* Is this entry terminated by a \n ? */
		var cr_terminated = (full_data[full_data.length - 1] == '\n' );
		
		var data_array = full_data.split("\n");
		
		if( !cr_terminated )
		{
			/* Push the last entry in the buffer for upcoming completion */
			this.input_buffer = data_array[ data_array.length - 1 ];
			data_array = data_array.slice( 0 , data_array.length - 1 );
		}
		
		/* Push all the lines */
		for( var i = 0 ; i < data_array.length ; i++ )
		{
			data_array[i] = data_array[i].trim();

			if( data_array[i] == "(gdb)" )
				continue;
			
			this.pushLine( data_array[i] );
		}
		
	}

	gdbMI.prototype.onClose = function( return_code, signal )
	{
		this.emit("closed",  return_code, signal);
	}
	
	gdbMI.prototype.onExit = function( return_code, signal )
	{
		this.emit("exited",  return_code, signal);
	}

	gdbMI.prototype.onError = function( error )
	{
		this.emit("gdbError",  error);
	}
	
	/* Option parsing */
	gdbMI.prototype.getOpt = function( name )
	{
		if( !this.opt )
			return undefined;
		
		if( !this.opt[ name ] )
			return undefined;
		
		return this.opt[ name ];
	}
	
	
	/* Line parsing */
	gdbMI.prototype.parseStateArgs = function( args )
	{
		/* This is crazy but GDB almost provides a JSON output */
		args = args.replace(/=/g, "!:");
		args = args.replace(/([a-zA-Z0-9-]*)!:/g, "\"$1\":");

		/* Remove array labels */
		args = removeArrayLabels(args);
		
		args = "{" + args + "}";
		
		
		var ret = {};
		
		//console.log("$$$$$ " + args + " $$$$$" );
		
		try
		{
			ret = JSON.parse( args );
		}
		catch(e)
		{
			/* We lamentably failed =( */
			console.log(e);
		}
		
		return ret;
	}
	
	gdbMI.prototype.getState = function( line )
	{
		var m = line.match("^([a-z-]*),");
		
		if( m )
		{
			if( m.length == 2 )
			{
				return  m[1].trim();
			}
			
		}

		var m = line.match("^([a-z-]*)$");
		
		if( m )
		{
			if( m.length == 2 )
			{
				return  m[1].trim();
			}
			
		}
				
		return undefined;
	}
	
	
	gdbMI.prototype.parseState = function( line )
	{
		line = line.trim();
		
		/* Handle state */
		var state = this.getState( line) ;
		
		if( state )
		{
			this.gdb_state.state = state;
		}
		
		//console.log("STATE " + state );
		
		/* Handle args if present */
		var m = line.match("^[a-z-]*,(.*)");
		if( m )
		{
			if( m.length == 2 )
			{
				this.gdb_state.status = this.parseStateArgs( m[1] );
			}
		}
	}
	
	gdbMI.prototype.callTerminationHandler = function()
	{
		if( this.gdb_state.state == "idle" )
		{
			/* Do not call twice for event */
			return;
		}
		
		if( this.push_back_handler )
		{
			/* We do this as we want to clear the handler
			 * before calling an handler which will possibly
			 * set its own handler */
			var to_call = this.push_back_handler;
			this.push_back_handler = undefined;
			(to_call)( this.gdb_state );
		}
		
		this.gdb_state.state = "idle";
	}
	
	
	gdbMI.prototype.pushLineAndTruncate = function( target, line, maxlen, do_cleanup )
	{
		
		if( do_cleanup )
		{
			line=line.trim();
			
			if( line[0] == '"' )
				line = line.slice(1);

			if( line[line.length - 1] == '"' )
				line = line.slice(0,line.length - 1);
			
			line = line.replace(/\\"/g, "\"");
			line = line.replace(/\\n/g, "\n");
		}
		
		target.push( line  );
		target.slice( -maxlen ); 
	}
	
	gdbMI.prototype.pushLine = function( line )
	{
		
		if( !line.length )
		{
			/* Nothing to do */
			return;
		}
		
		var line_descriptor = line[0];
		
		//console.log(line);
		
		var line = line.slice(1);
		
		this.parseState( line );

		switch( line_descriptor )
		{
			/* log-stream-output */
			case "&" : /* Messages from GDB internals */
			/* console-stream-output */
			case "~" : /* GDB output as it would be displayed normally */
				this.pushLineAndTruncate( this.gdb_log, line.slice(1), this.gdb_log_max_len, true );
				this.emit("gdbOutput", line );
			break;
			
			/* status-async-output  */
			case "+" : /* Async output progress for slow operations (optionnal) */
			case "=" : /* Async output notify suplementary informations */
			
				/* We need to handle child processes PID as we cannot relieably
				 * forward the interupt signal (or I mised someting.. ) */
				if( this.gdb_state.state == "thread-group-started" )
				{
					if( this.gdb_state.status.pid )
					{
						//console.log("Attached to pid " + this.gdb_state.status.pid );
						this.pid_list.push( this.gdb_state.status.pid );
					}
				}
				
				this.emit("notify", this.gdb_state );			
			break;
			
			/*  GDB state */
			case "^" : /*  exec-async-output */
			case "*" : /* Async state change (running, stopped ...) */

				/* We only call termination handler when we are sure we can enter next command */
				if( this.gdb_state.state != "running" )
					this.callTerminationHandler( this.gdb_state );
				
				if( this.gdb_state.state == "error" )
					this.emit("gdbError", this.gdb_state );

				this.emit("ready", this.gdb_state);
			break;
			
			/* target-stream-output */
			case "@":
			default:
				/* Basic output from the program */
				this.pushLineAndTruncate( this.app_log, line, this.app_log_max_len );
				this.emit("appOutput", line );
		}
		
		
	}
	
	/* ***************************************************
	* 
	* Gdb actions
	*
	*****************************************************/

	/*#######################
	# Process management    #
	#######################*/
	 
	gdbMI.prototype.interrupt = function (handler)
	{
		this.command("", handler );
		
		/* Here we send the signal by hand (it seems more reliable)
		 * there is maybe a mismatch with node which is mixed up
		 * so we retrive the pid upon thread group start in order
		 * to kill it later (SIGINT)
		 * 
		 * TODO find a cleaner versiojn using -process-interrupt ? 
		 * 
		 * this.command("-exec-interrupt", handler);
		 * */
		var i;

		for( i = 0 ; i < this.pid_list.length; i++ )
		{
			this.wrapper.interrupt( this.pid_list[i] );
		}
	}

	gdbMI.prototype.run = function (handler)
	{
		this.command("-exec-run", handler);
	}
	
	gdbMI.prototype.continue = function (handler)
	{
		this.command("-exec-continue", handler);
	}
	
	gdbMI.prototype.finish = function (handler)
	{
		this.command("-exec-finish", handler);
	}
	
	gdbMI.prototype.step = function (handler)
	{
		this.command("-exec-step", handler);
	}
	
	gdbMI.prototype.stepInstruction = function (handler)
	{
		this.command("-exec-step-instruction", handler);
	}
	
	gdbMI.prototype.next = function (handler)
	{
		this.command("-exec-next", handler);
	}
	
	gdbMI.prototype.nextInstruction = function (handler)
	{
		this.command("-exec-next-instruction", handler);
	}
	
	gdbMI.prototype.retrun = function (handler)
	{
		this.command("-exec-return", handler);
	}
	
	gdbMI.prototype.jump = function (location, handler)
	{
		if( typeof(location) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-exec-jump " + location, handler);
	}
	
	gdbMI.prototype.execUntil = function (location, handler)
	{
		if( typeof(location) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-exec-until " + location, handler);
	}

	/*#######################
	# Breakpointing         #
	#######################*/	
	
	gdbMI.prototype.breakAfter = function (number, count , handler)
	{
		if( typeof(number) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		if( typeof(count) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-break-after " + number + " " + count , handler);
	}
	
	gdbMI.prototype.breakCommand = function (number, commands , handler)
	{
		if( typeof(number) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		if( typeof(commands) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-break-command " + number + " " + commands , handler);
	}
		
	gdbMI.prototype.breakCondition = function (number, expr , handler)
	{
		if( typeof(number) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		if( typeof(expr) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-break-condition " + number + " " + expr , handler);
	}
	
			
	gdbMI.prototype.breakDelete = function (numbers , handler)
	{
		if( typeof(numbers) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-break-delete " + numbers , handler);
	}
			
	gdbMI.prototype.breakDisable = function (numbers , handler)
	{
		if( typeof(numbers) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-break-disable " + numbers , handler);
	}
			
	gdbMI.prototype.breakEnable = function (numbers , handler)
	{
		if( typeof(numbers) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-break-enable " + numbers , handler);
	}
		
	gdbMI.prototype.breakInfo = function (number , handler)
	{
		if( typeof(number) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-break-info " + number , handler);
	}
		
	gdbMI.prototype.breakList = function ( handler)
	{

		this.command("-break-list" , handler);
	}

	gdbMI.prototype.breakInsert = function (location, options , handler)
	{
		if( typeof(location) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		if( typeof(options) != 'object' )
		{
			throw("Wrong argument type");
		}
		
		/* Lets parse options */
		var args = "";
		
		if( options.temporary == true )
		{
			args += " -t";
		}
		
		if( options.hardware == true )
		{
			args += " -h";
		}
		
		if( options.force == true )
		{
			args += " -f";
		}
		
		if( options.disabled == true )
		{
			args += " -d";
		}
		
		if( options.tracepoint == true )
		{
			args += " -a";
		}
		
		if( options.condition )
		{
			if( typeof(options.condition) != 'string' )
				throw("Wrong argument type");
			
			args += " -c " + options.condition;
		}
		
		if( options.ingnoreCount )
		{
			if( typeof(options.ingnoreCount) != 'string' )
				throw("Wrong argument type");
			
			args += " -i " + options.ingnoreCount;
		}
		
		if( options.threadId )
		{
			if( typeof(options.threadId) != 'string' )
				throw("Wrong argument type");
			
			args += " -p " + options.threadId;
		}
		
		this.command("-break-insert " + args + " " + location , handler);
	}


	gdbMI.prototype.dprintf = function (location, format, arguments, options , handler)
	{
		if( typeof(location) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		if( typeof(format) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		if( typeof(arguments) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		if( typeof(options) != 'object' )
		{
			throw("Wrong argument type");
		}
		
		/* Lets parse options */
		var args = "";
		
		if( options.temporary == true )
		{
			args += " -t";
		}

		if( options.force == true )
		{
			args += " -f";
		}
		
		if( options.disabled == true )
		{
			args += " -d";
		}

		if( options.condition )
		{
			if( typeof(options.condition) != 'string' )
				throw("Wrong argument type");
			
			args += " -c " + options.condition;
		}
		
		if( options.ingnoreCount )
		{
			if( typeof(options.ingnoreCount) != 'string' )
				throw("Wrong argument type");
			
			args += " -i " + options.ingnoreCount;
		}
		
		if( options.threadId )
		{
			if( typeof(options.threadId) != 'string' )
				throw("Wrong argument type");
			
			args += " -p " + options.threadId;
		}
		
		this.command("-dprintf-insert " + args + " " + location + " " + format + " " +  arguments, handler);
	}
			
	gdbMI.prototype.breakPasscount = function (number, passcount, handler)
	{
		if( typeof(number) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		if( typeof(passcount) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-break-passcount " + number + " " + passcount , handler);
	}
	
			
	gdbMI.prototype.watch = function (location, mode, handler)
	{
		if( typeof(location) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		/* By default we are in write mode */
		var arg = "";
		
		switch( mode )
		{
			case "rw":
				args = " -a";
			break;
			case "r":
				args = " -r";
			break;
		}
		
		this.command("-break-watch " + mode + " " + location , handler);
	}

	/*#######################
	# Catchpoints           #
	#######################*/		
	
	gdbMI.prototype.catchLoad = function (regexp, options, handler)
	{
		if( typeof(regexp) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		if( typeof(options) != 'object' )
		{
			throw("Wrong argument type");
		}
		
		var args = "";
		
		if( options.temporary == true )
			args += " -t";
		
		if( options.disabled == true )
			args += " -d";
	
		this.command("-catch-load " + args + " " + regexp , handler);
	}
	
	gdbMI.prototype.catchUnload = function (regexp, options, handler)
	{
		if( typeof(regexp) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		if( typeof(options) != 'object' )
		{
			throw("Wrong argument type");
		}
		
		var args = "";
		
		if( options.temporary == true )
			args += " -t";
		
		if( options.disabled == true )
			args += " -d";
	
		this.command("-catch-unload " + args + " " + regexp , handler);
	}

	/*#######################
	# Program CTX           #
	#######################*/	
	 
	gdbMI.prototype.setArgs = function (args , handler)
	{
		if( typeof(args) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-exec-arguments " + args , handler);
	} 
	 
	gdbMI.prototype.setWorkingDirectory = function (wdir , handler)
	{
		if( typeof(wdir) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-environment-cd " + wdir , handler);
	} 
	 	
	 
	gdbMI.prototype.setSourcePath= function (paths, reset, handler)
	{
		if( typeof(paths) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		var args = "";
		
		if( reset )
		{
			args += " -r";
		}
		
		this.command("-environment-directory " + args + " " + paths , handler);
	} 
	 
	gdbMI.prototype.setObjectPath= function (paths, reset, handler)
	{
		if( typeof(paths) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		var args = "";
		
		if( reset )
		{
			args += " -r";
		}
		
		this.command("-environment-path " + args + " " + paths , handler);
	} 
	 
	gdbMI.prototype.pwd= function ( handler)
	{	
		this.command("-environment-pwd" , handler);
	}

	/*#######################
	# Thread Management     #
	#######################*/	
	
	gdbMI.prototype.threadInfo= function (id, handler)
	{
		var args = "";
		
		if( id )
		{
			if( typeof(id) != 'string' && typeof(id) != 'number' )
			{
				throw("Wrong argument type");
			}
			
			args = id;
		}
		
		this.command("-thread-info " + args , handler);
	} 
	 
	gdbMI.prototype.threadListIds= function (id, handler)
	{
		this.command("-thread-list-ids" , handler);
	}
	
	gdbMI.prototype.threadSelect = function (id , handler)
	{
		if( typeof(id) != 'string' && typeof(id) != 'number' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-thread-select " + id , handler);
	} 

	/*#######################
	# Frames Management     #
	#######################*/
	 
	gdbMI.prototype.frame = function ( handler)
	{
		this.command("-stack-info-frame" , handler);
	}
	 
	gdbMI.prototype.stackDepth = function (maxDepth, handler)
	{
		var args = "";
		
		if( maxDepth )
		{
			if( typeof(maxDepth) != 'string' && typeof(maxDepth) != 'number' )
			{
				throw("Wrong argument type");
			}
				
			args = maxDepth;
		}
		
		this.command("-stack-info-depth " + args , handler);
	}
	
	gdbMI.prototype.stackListArguments = function (printValues, options, handler)
	{
		var print = "";
		
		if( printValues == undefined )
		{
			throw("Wrong argument type");
		}
		
		if( printValues )
		{
			print = 1;
		}
		else
		{
			print = 0;
		}
		
		if( typeof(options) != 'object' )
		{
			throw("Wrong argument type");
		}	
		
		var skip = "";
		
		if( options.skipUnavailable == true )
		{
			skip = "--skip-unavailable";
		}

		var lf = "";
		var hf = "";

		if( options.lowFrame )
		{
			if( typeof(options.lowFrame) != 'number' )
				throw("Wrong argument type");
			
			lf = options.lowFrame;
		}

		if( options.highFrame )
		{
			if( typeof(options.highFrame) != 'number' )
				throw("Wrong argument type");
			
			hf = options.highFrame;
		}
		
		this.command("-stack-list-arguments " + skip + " " + print + " " + lf + " " + hf, handler);
	}

	gdbMI.prototype.stackListFrames = function (options, handler)
	{
		if( typeof(options) != 'object' )
		{
			throw("Wrong argument type");
		}

		var lf = "";
		var hf = "";

		if( options.lowFrame )
		{
			if( typeof(options.lowFrame) != 'number' )
				throw("Wrong argument type");
			
			lf = options.lowFrame;
		}

		if( options.highFrame )
		{
			if( typeof(options.highFrame) != 'number' )
				throw("Wrong argument type");
			
			hf = options.highFrame;
		}
		
		this.command("-stack-list-frames " + lf + " " + hf, handler);
	}

	
	gdbMI.prototype.stackListLocals = function (printValues, options, handler)
	{
		var print = "";
		
		if( printValues == undefined )
		{
			throw("Wrong argument type");
		}
		
		if( printValues )
		{
			print = 1;
		}
		else
		{
			print = 0;
		}
		
		if( typeof(options) != 'object' )
		{
			throw("Wrong argument type");
		}	
		
		var skip = "";
		
		if( options.skipUnavailable == true )
		{
			skip = "--skip-unavailable";
		}
		
		this.command("-stack-list-locals " + skip + " " + print, handler);
	}
	
	gdbMI.prototype.stackListVariables = function (printValues, options, handler)
	{
		var print = "";
		
		if( printValues == undefined )
		{
			throw("Wrong argument type");
		}
		
		if( printValues )
		{
			print = 1;
		}
		else
		{
			print = 0;
		}
		
		if( typeof(options) != 'object' )
		{
			throw("Wrong argument type");
		}	
		
		var skip = "";
		
		if( options.skipUnavailable == true )
		{
			skip = "--skip-unavailable";
		}
		
		this.command("-stack-list-variables " + skip + " " + print, handler);
	}

	gdbMI.prototype.frameSelect = function (id , handler)
	{
		if( typeof(id) != 'string' && typeof(id) != 'number' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-stack-select-frame " + id , handler);
	} 
	
	/*#######################
	# TODO VARIABLE         #
	#######################*/

	/*#######################
	# TODO DATA             #
	#######################*/

	/*#######################
	# TODO TRACEPOINT       #
	#######################*/

	/*#######################
	# Symbol query          #
	#######################*/
	 
	gdbMI.prototype.symbolList = function (filename , handler)
	{
		if( typeof(filename) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-symbol-list-lines " + filename , handler);
	} 

	/*#######################
	# File commands         #
	#######################*/

	gdbMI.prototype.executableAndSymbols = function (filename , handler)
	{
		if( typeof(filename) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-file-exec-and-symbols " + filename , handler);
	}
	
	gdbMI.prototype.executable = function (filename , handler)
	{
		if( typeof(filename) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-file-exec-file " + filename , handler);
	}
	
	gdbMI.prototype.symbols = function (symbolfile , handler)
	{
		if( typeof(symbolfile) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-file-symbol-file " + symbolfile , handler);
	}
	
	gdbMI.prototype.sourceCtx = function (handler)
	{
		this.command("-file-list-exec-source-file" , handler);
	}
	
	gdbMI.prototype.listSourceFiles = function (handler)
	{
		this.command("-file-list-exec-source-files" , handler);
	}

	/*#######################
	# Target manipulation   #
	#######################*/
 
	gdbMI.prototype.attach = function (pidorfile , handler)
	{
		if( typeof(pidorfile) != 'string' && typeof(pidorfile) != 'number' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-target-attach " + pidorfile , handler);
	} 
  
	gdbMI.prototype.detach = function (pid , handler)
	{
		if( typeof(pid) != 'string' && typeof(pid) != 'number' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-target-detach " + pid , handler);
	}

	gdbMI.prototype.disconnect = function ( handler)
	{	
		this.command("-target-disconnect" , handler);
	} 

	gdbMI.prototype.download = function ( handler)
	{	
		this.command("-target-download" , handler);
	} 

	gdbMI.prototype.targetSelect = function ( type, params, handler)
	{
		if( typeof(type) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		if( typeof(params) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-target-select " + type + " " + params , handler);
	}
	
	/*######################
	#  TODO FILE TRANSFER  #
	######################*/
	
	/*#######################
	# Support Commands      #
	#######################*/	

	gdbMI.prototype.commandExists = function (commandWithNoDash , handler)
	{
		if( typeof(commandWithNoDash) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-info-gdb-mi-command " + commandWithNoDash , handler);
	} 	

	gdbMI.prototype.listFeature = function (handler)
	{
		this.command("-list-features" , handler);
	} 	

	gdbMI.prototype.listTargetFeature = function (handler)
	{
		this.command("-list-target-features" , handler);
	} 	

	/*#######################
	# Misc Commands         #
	#######################*/	
	
	gdbMI.prototype.exit = function (handler)
	{
		this.command("-gdb-exit" , handler);
	} 		

	gdbMI.prototype.set = function ( name, value, handler)
	{
		if( typeof(name) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		if( typeof(value) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-gdb-set $" + name.trim() + "=\"" + value.trim() + "\"" , handler);
	}
	
	gdbMI.prototype.show = function ( name , handler)
	{
		if( typeof(name) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-gdb-show " + name , handler);
	}
	
	gdbMI.prototype.version = function (handler)
	{
		this.command("-gdb-version" , handler);
	} 	
	
	gdbMI.prototype.listThreadGroups = function (options, handler)
	{
		if( typeof(options) != 'object' )
		{
			throw("Wrong argument type");
		}
		
		var args = "";
		
		if( options.available == true )
		{
			args += " --available";
		}
		
		if( options.recurse == true )
		{
			args += " --recurse";
		}
		
		var groups = "";
		
		if( options.groups )
		{
			if( typeof(options.groups) != 'string' )
			{
				throw("Wrong argument type");
			}
			
			groups = options.groups;
		}
		
		this.command("-list-thread-groups " + args + " " + groups, handler);
	}

	
	gdbMI.prototype.os = function ( type, handler)
	{
		if( typeof(type) != 'string' )
		{
			throw("Wrong argument type");
		}
			
		this.command("-info-os " + type , handler);
	} 		
	
	gdbMI.prototype.addInferior = function ( handler)
	{	
		this.command("-add-inferior" , handler);
	} 		
	
	gdbMI.prototype.exec = function ( interpreter, command, handler)
	{
		if( typeof(interpreter) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		if( typeof(command) != 'string' )
		{
			throw("Wrong argument type");
		}
		
		this.command("-interpreter-exec " + interpreter + " " + command , handler);
	} 
		
	gdbMI.prototype.ttySet = function ( tty, handler)
	{
		if( typeof(tty) != 'string' )
		{
			throw("Wrong argument type");
		}
			
		this.command("-inferior-tty-set " + tty , handler);
	}
	
	gdbMI.prototype.ttyShow = function ( handler)
	{	
		this.command("-inferior-tty-show" , handler);
	} 			
	
	gdbMI.prototype.enableTimings = function ( truth, handler)
	{
		var t = "yes";
		
		if( !truth )
		{
			t = "no";
		}
		
		this.command("-enable-timings " + t , handler);
	} 			
		
	/*######################*/
	/*######################*/
	/*######################*/
	/*######################*/
	/*######################*/
	/*######################*/
	
	/* Output handling
	 * retrieve last n lines from either gdb 
	 * or the program itself */
	gdbMI.prototype.gdbOutput = function( length )
	{
		return rebuildString( this.gdb_log, length );
	}
	
	gdbMI.prototype.programOutput = function( length )
	{
		return rebuildString( this.app_log, length );	
	}
	
	/* Handlers management */
	gdbMI.prototype.command = function( command, handler )
	{
		this.gdb_state.state = "command";
		this.gdb_state.status = {};
		this.push_back_handler = handler;
		
		if( command.length )
			this.wrapper.write(command + "\n");
	}

	/* ############################################## */
	/* ############################################## */
	/* Constructor */
	
	/*
	 *  Inherit from EventEmitter
	 */
	
	events.EventEmitter.call(this);
	gdbMI.prototype.__proto__ = events.EventEmitter.prototype;
	
	/*
	 *  gdbWrapper
	 */
	
	if( !gdbWrapper )
	{
		gdbWrapper = gdbProcessWrapper;
	}
	
	this.wrapper = new gdbWrapper();
	
	/* Initialize */
	this.wrapper.init(command_and_args);
	
	/* We use this to tranpoline in the anaonymous handlers
	 * in order to go back to object methods as it is cleaner */
	var pthis = this;
	
	/* Attach wrappers */
	this.wrapper.onData( function( data )
	{
		pthis.onData( data );
	});
	
	this.wrapper.onClose( function( return_code, signal )
	{
		pthis.onClose( return_code, signal );
	});
	this.wrapper.onExit( function( return_code, signal )
	{
		pthis.onClose( return_code, signal );
	});
	this.wrapper.onError( function( error )
	{
		pthis.onError( error );
	});
	
	/*
	 *  gdbMi context
	 */

	/* Option object */
	this.opt = options;
	/* Gdb log */
	this.gdb_log = [];
	this.gdb_log_max_len = 256;

	if( this.getOpt("gdb_log_max_len") )
		this.gdb_log_max_len = this.getOpt("gdb_log_max_len");

	/* Application log */
	this.app_log = [];
	this.app_log_max_len = 256;

	if( this.getOpt("app_log_max_len") )
		this.app_log_max_len = this.getOpt("app_log_max_len");
	
	/* Input buffer
	 * It is used to store incomplete lines as only lines ending with \n
	 * are pushed to the parser otherwise they are stored here until
	 * being terminated by an upcomming call of onData */
	this.input_buffer = "";
	
	/* Running ctx
	 * this is what we update at each step
	 * in this gdbMI implementation */
	this.gdb_state = {};
	this.gdb_state.state = "idle";
	this.gdb_state.status = {};
	
	/* Pid list of target processes when interupting 
	 * this list is built with thread groups notifications */
	this.pid_list = [];
	
	/* Push back handler
	 * This handler is provided by command blocks in order
	 * to signal event completion.*/
	 this.push_back_handler = undefined;
	
}

/* Export the whole thing =) */
module.exports = gdbMI;


