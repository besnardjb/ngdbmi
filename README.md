### Purpose

*Quickly interface node.js to a gdb instance while
retrieving state informations in JSON.*

### Warning

This is an early development version which needs to be further
tested.

For the moment, do not include it in your projects for other purpose
than testing. Improvements and stabilisation are to come !

### Overview

ngdbmi is a node.js based gdb wrapper over the gdb/MI interface
(see [here](https://sourceware.org/gdb/current/onlinedocs/gdb/GDB_002fMI.html)).
It allows the wrapping a GDB instance while providing
a JSON based output when a event occurs.

### Documentation

ngdbmi documentation can be found [here](https://github.com/besnardjb/ngdbmi/wiki/Documentation)

### Small Example

**Target program:**

```C
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
```

**ngdbmi based debugger:**

```JavaScript
ngdbmi = require("ngdbmi");

/* Create a new GDB instance over ./a.out with args foo and bar */
gdb = new ngdbmi("./a.out foo bar");

/* Register handlers */

/* Notify event */
gdb.on("notify", function( state )
{
	console.log( "/*-------------------NOTIFY----------------*/" );
	console.log( JSON.stringify(state, null, "\t") );
	console.log( "/*-----------------------------------------*/" );
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
gdb.on("close", function( return_code, signal )
{
	console.log( "GDB closed RET=" + return_code );
});
/*
 *  Debug script
 */

/* Lets insert a breakpoint at "bar" */
gdb.command("breakInsert", function (state)
{
	console.log( "/*----------------BREAKPOINT---------------*/" );
	console.log( JSON.stringify(state, null, "\t") );
	console.log( "/*-----------------------------------------*/" );
	
	/* Launch the debugee */
	gdb.command("run", function( state )
	{
		console.log( "/*---------------------RUN-----------------*/" );
		console.log( JSON.stringify(state, null, "\t") );
		console.log( "/*-----------------------------------------*/" );
			
		/* Generate a backtrace */
		gdb.command("stackListFrames", function( state )
		{
			console.log( "/*----------------FRAMES-------------------*/" );
			console.log( JSON.stringify(state, null, "\t") );
			console.log( "/*-----------------------------------------*/" );
			
			gdb.command("exit");
		});
		
	});
	
	
}, { location : "bar" } );

```
**output when run:**
```JSON
-break-insert  bar
/*-------------------NOTIFY----------------*/
{
	"state": "thread-group-added",
	"status": {
		"id": "i1"
	}
}
/*-----------------------------------------*/
GDB>"Reading symbols from ./a.out..."
GDB>"expanding to full symbols..."
GDB>"done.\n"
/*----------------BREAKPOINT---------------*/
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
			"fullname": "/repo/ngdb/test.c",
			"line": "6",
			"thread-groups": [
				"i1"
			],
			"times": "0",
			"original-location": "bar"
		}
	}
}
/*-----------------------------------------*/
-exec-run 
/*-------------------NOTIFY----------------*/
{
	"state": "thread-group-started",
	"status": {
		"id": "i1",
		"pid": "20479"
	}
}
/*-----------------------------------------*/
/*-------------------NOTIFY----------------*/
{
	"state": "thread-created",
	"status": {
		"id": "1",
		"group-id": "i1"
	}
}
/*-----------------------------------------*/
/*-------------------NOTIFY----------------*/
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
/*-----------------------------------------*/
/*-------------------NOTIFY----------------*/
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
/*-----------------------------------------*/
/*-------------------NOTIFY----------------*/
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
			"fullname": "/repo/ngdb/test.c",
			"line": "6",
			"thread-groups": [
				"i1"
			],
			"times": "1",
			"original-location": "bar"
		}
	}
}
/*-----------------------------------------*/
/*---------------------RUN-----------------*/
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
			"fullname": "/repo/ngdb/test.c",
			"line": "6"
		},
		"thread-id": "1",
		"stopped-threads": "all",
		"core": "1"
	}
}
/*-----------------------------------------*/
-stack-list-frames 
/*----------------FRAMES-------------------*/
{
	"state": "done",
	"status": {
		"stack": [
			{
				"level": "0",
				"addr": "0x0000000000400494",
				"func": "bar",
				"file": "./test.c",
				"fullname": "/repo/ngdb/test.c",
				"line": "6"
			},
			{
				"level": "1",
				"addr": "0x00000000004004a4",
				"func": "foo",
				"file": "./test.c",
				"fullname": "/repo/ngdb/test.c",
				"line": "10"
			},
			{
				"level": "2",
				"addr": "0x00000000004004bf",
				"func": "main",
				"file": "./test.c",
				"fullname": "/repo/ngdb/test.c",
				"line": "16"
			}
		]
	}
}
/*-----------------------------------------*/
-gdb-exit 
/*-------------------NOTIFY----------------*/
{
	"state": "thread-exited",
	"status": {
		"id": "1",
		"group-id": "i1"
	}
}
/*-----------------------------------------*/
/*-------------------NOTIFY----------------*/
{
	"state": "thread-group-exited",
	"status": {
		"id": "i1"
	}
}
/*-----------------------------------------*/
GDB closed RET=0

```

### Licence

ngdbmi is under the [CeCILL-C licence](http://www.cecill.info/index.en.html) which is fully LGPL compatible.
