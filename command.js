
//var path = require('path');
//var fs = require('fs');

var projects = require('./projects.js');
var factory = require('./factory.js');

//cmds for calculate and maintain publish plan
var Plan = {
	pjt: function(p){
		return projects.getProject(p);
	},
	recal: function(callback, opts){
		var pjt = this.pjt(opts.p);
		
		pjt.calPublishPlan(function(pubTable){
			callback(null, pubTable);
		});
	},
	show: function(callback, opts){
		//prepare every path info in this project
		var map = this.pjt(opts.p).getPublishPlan();

		if(opts['render']){
			callback(null, JSON.parse(map) );
		}else{
			callback(null, map);
		}
	}
};


// compile a target file
var build = function(callback, opts){
	var pjt = projects.getProject(opts.p);

	factory.buildTarget(target, callback);
	//function(err, output){
	//	if(opts.output){
	//		fs.writeFileSync(opts.output, output, 'UTF8');
	//	}else{
	//		console.log(output);
	//	}
	//});
};

exports.plan = Plan;

//show DepTree
	// -- Test calDepTree
	//var ret = oreKeeper.calDepTree( argv[2] , function(ret){
	//	//console.log('Incs = ', ret.incs.join('\n'));

	//	var tt = ['|   ', '|   ', '|   ', '|   ', '|   '];
	//	var tp = '|-- ';
	//	var uni = {};
	//	var rprint = function(tree, _d){
	//		uni[ tree[0] ] = true;  //mark appeared
	//		var prefix = _d == 0 ? '-- ' : tt.slice(0,_d-1).join('')+ tp;
	//		console.log( prefix, tree[0]);

	//		_d++; //depth of this tree
	//		for(var i = 1; i < tree.length; i++){
	//			if(tree[i].length > 1){
	//				//if this module has appeared above, and current depth over level 3, just display Ore id
	//				if( _d >= 3 && uni[ tree[i][0] ]){
	//					console.log(tt.slice(0,_d-1).join('')+ tp, '<'+ tree[i][0] +'>');
	//				}else{
	//					rprint(tree[i], _d);
	//				}
	//			}else{
	//				console.log( tt.slice(0,_d-1).join('')+ tp, tree[i][0] );
	//			}
	//		};
	//	};
	//	rprint(ret.tree, 0);
	//});
