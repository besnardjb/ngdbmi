ngdbmi
======

*Quickly interface node.js to a gdb instance while
retrieving state informations in JSON.*

Overview
--------

ngdbmi is a node.js based implementation of the gdb/MI interface
(see [here](https://sourceware.org/gdb/current/onlinedocs/gdb/GDB_002fMI.html)).
It allows the wrapping a GDB instance while providing
a JSON based output when a event occurs.

Example
-------

Target program:


    #include <stdio.h>
    
    void bar()
    {
    }
    
    void foo()
    {
    		bar();
    }
    
    int main( int argc, char **argv )
    {
    		foo();	
    		return 0;
    }

ngdbmi based debugger:

    ngdbmi = gdb = require("ngdbmi");
    
    /* Create a new GDB instance over ./a.out with args foo and bar */
    gdb = new ngdbmi("./a.out foo bar");
    
    /* Register handlers */
    
    /* Notify event */
    gdb.on("notify", function( state )
    {
    	console.log( "----------------NOTIFY---------------" );
    	console.log( JSON.stringify(state, null, "\t") );
    	console.log( "-------------------------------------" );
    });
    
    /* Application output */
    gdb.on("app", function( line )
    {
    	console.log( "APP>" + line );
    });
    
    /* Gdb output */
    gdb.on("gdb", function( line )
    {
    	console.log( "GDB>" + line );
    });
    
    /* Gdb close event */
    gdb.on("close", function( line )
    {
    	console.log( "GDB closed");
    });
    
    /*
     *  Debug script
     */
    
    /* Lets insert a breakpoint at "bar" */
    gdb.breakInsert("bar", {}, function(state)
    {
    	/* See status message */
    	console.log( "------------BREAK INSERT-------------" );
    	console.log( JSON.stringify(state, null, "\t") );
    	console.log( "-------------------------------------" );
    	
    	/* Lauch the debugee */
    	gdb.run( function(state)
    	{
    			/* Here we just hit the breakpoint
    			 * as handler is called when we are back in interactive mode*/
    			
    			/* See status message */
    			console.log( "---------------RUN-------------------" );
    			console.log( JSON.stringify(state, null, "\t") );
    			console.log( "-------------------------------------" );
    			
    			/* Lets have a look at the stack */
    			gdb.stackListFrames( {}, function(state)
    			{
    				/* See status message */
    				console.log( "------------STACK FRAMES-------------" );
    				console.log( JSON.stringify(state, null, "\t") );
    				console.log( "-------------------------------------" );
    				gdb.exit();
    			});
    	});
    });

output when run:

    ----------------NOTIFY---------------
    {
    	"state": "thread-group-added",
    	"status": {
    		"id": "i1"
    	}
    }
    -------------------------------------
    GDB>"Reading symbols from ./a.out..."
    GDB>"expanding to full symbols..."
    GDB>"done.\n"
    ------------BREAK INSERT-------------
    {
    	"state": "done",
    	"status": {
    		"bkpt": {
    			"number": "1",
    			"type": "breakpoint",
    			"disp": "keep",
    			"enabled": "y",
    			"addr": "0x0000000000400494",
    			"func": "bar",
    			"file": "./test.c",
    			"fullname": "/home/jbbesnard/repo/ngdb/test.c",
    			"line": "6",
    			"thread-groups": [
    				"i1"
    			],
    			"times": "0",
    			"original-location": "bar"
    		}
    	}
    }
    -------------------------------------
    ----------------NOTIFY---------------
    {
    	"state": "thread-group-started",
    	"status": {
    		"id": "i1",
    		"pid": "28402"
    	}
    }
    -------------------------------------
    ----------------NOTIFY---------------
    {
    	"state": "thread-created",
    	"status": {
    		"id": "1",
    		"group-id": "i1"
    	}
    }
    -------------------------------------
    ----------------NOTIFY---------------
    {
    	"state": "library-loaded",
    	"status": {
    		"id": "/lib64/ld-linux-x86-64.so.2",
    		"target-name": "/lib64/ld-linux-x86-64.so.2",
    		"host-name": "/lib64/ld-linux-x86-64.so.2",
    		"symbols-loaded": "0",
    		"thread-group": "i1"
    	}
    }
    -------------------------------------
    ----------------NOTIFY---------------
    {
    	"state": "library-loaded",
    	"status": {
    		"id": "/lib/x86_64-linux-gnu/libc.so.6",
    		"target-name": "/lib/x86_64-linux-gnu/libc.so.6",
    		"host-name": "/lib/x86_64-linux-gnu/libc.so.6",
    		"symbols-loaded": "0",
    		"thread-group": "i1"
    	}
    }
    -------------------------------------
    ----------------NOTIFY---------------
    {
    	"state": "breakpoint-modified",
    	"status": {
    		"bkpt": {
    			"number": "1",
    			"type": "breakpoint",
    			"disp": "keep",
    			"enabled": "y",
    			"addr": "0x0000000000400494",
    			"func": "bar",
    			"file": "./test.c",
    			"fullname": "/home/jbbesnard/repo/ngdb/test.c",
    			"line": "6",
    			"thread-groups": [
    				"i1"
    			],
    			"times": "1",
    			"original-location": "bar"
    		}
    	}
    }
    -------------------------------------
    ---------------RUN-------------------
    {
    	"state": "stopped",
    	"status": {
    		"reason": "breakpoint-hit",
    		"disp": "keep",
    		"bkptno": "1",
    		"frame": {
    			"addr": "0x0000000000400494",
    			"func": "bar",
    			"args": [],
    			"file": "./test.c",
    			"fullname": "/home/jbbesnard/repo/ngdb/test.c",
    			"line": "6"
    		},
    		"thread-id": "1",
    		"stopped-threads": "all",
    		"core": "5"
    	}
    }
    -------------------------------------
    ------------STACK FRAMES-------------
    {
    	"state": "done",
    	"status": {
    		"stack": [
    			{
    				"level": "0",
    				"addr": "0x0000000000400494",
    				"func": "bar",
    				"file": "./test.c",
    				"fullname": "/home/jbbesnard/repo/ngdb/test.c",
    				"line": "6"
    			},
    			{
    				"level": "1",
    				"addr": "0x00000000004004a4",
    				"func": "foo",
    				"file": "./test.c",
    				"fullname": "/home/jbbesnard/repo/ngdb/test.c",
    				"line": "10"
    			},
    			{
    				"level": "2",
    				"addr": "0x00000000004004bf",
    				"func": "main",
    				"file": "./test.c",
    				"fullname": "/home/jbbesnard/repo/ngdb/test.c",
    				"line": "16"
    			}
    		]
    	}
    }
    -------------------------------------
    ----------------NOTIFY---------------
    {
    	"state": "thread-exited",
    	"status": {
    		"id": "1",
    		"group-id": "i1"
    	}
    }
    -------------------------------------
    ----------------NOTIFY---------------
    {
    	"state": "thread-group-exited",
    	"status": {
    		"id": "i1"
    	}
    }
    -------------------------------------
    GDB closed
