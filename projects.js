//maintain all project info
var path = require('path');

var Register = require('./register.js');
var Resolver = require('./resolver.js');
var frame = require('./frame.js');
var oreKeeper = require('./ore.js').keeper;

//运行时存储所有工程相关资源
var projects = {};

//工程相关信息 maintain all kinds of info about project.
var Project = function(opts){
	//prepare useful paths
	var paths = this.paths = {
		root: opts.root,
		src: path.join( opts.root, opts.src || './src'),
		frame: path.join( opts.root, opts.frame || './frame' ),
		register: path.join(opts.root, '.build')
	};
	var registor = this.registor = new Register( paths.register );
	//this.bigmap = new BigMap(registor);
	var resolver = this.resolver = new Resolver( paths.src, opts.domains, ['index.js']);
	//load publish_plan from disk
	//var plan = load();  //TODO: 
};

Project.prototype = {
	/*
	 * 计算发布方案
	 * 利用frame和srcKeeper计算每个target目标文件需要合并的模块
	 */
	calPublishPlan: function(callback){
		//prepare every path info in this project
		//var pjt = projects.getProject(p);
		var pjt = this;
		//init frameCollection with ./frame dir
		var collection = frame.getCollection( pjt.paths.frame );
		//extract refer info from every frame
		var pubTable = {};
		var fnum = 0;
		collection.eachFrame(function(frame, num){
			frame.extract(function(){
				var combinations = [];
				var exclude = {};  //ores specialed by --include statement  //TODO: how about target has a same name with a ore?
				var entry_ores = [];  //entry ore that would bundle all deps ore expect exclude.
				frame.code.filter('refer', function(row, next){
					if(row == null) return;  //row == null marks filter done for one frame, but maybe there is a next frame.
					if(row.include){
						combinations.push(row);
						var oid;
						for(var i = 0; i < row.include.length; i++){
							oid = row.include[i];
							exclude[oid] = true;
						};
					}else{
						if( entry_ores.indexOf(row.target) < 0 ) entry_ores.push(row.target);
					}
				});
				//cal fitupTable for this frame
				console.log3('entrys tobe collect : ', entry_ores);
				fitupTable(entry_ores, exclude, combinations, pjt.resolver, function(table){
					fnum++;
					Object.keys(table).forEach(function(target){
						if(target in pubTable) throw new Error('Confilct **Target Name** in frame : '+ frame.filepath);
						pubTable[target] = table[target];
					});
					if(fnum >= num){
						//All done , We get the expacted result "buleprint" at last;
						//save to registor
						pjt.registor.replace( 'blueprint', JSON.stringify(pubTable) );
						callback(pubTable);
						//print to console
						//console.log('  =============== pub plan table ================  ');
						//console.log(pubTable);
						//console.log('  ===============================================  ');
					}
				});
			});
		});

	},
	
	//load plan_map from registor, and cache it
	getPublishPlan: function(){
		if(!this.publish_plan){
			this.publish_plan = this.registor.fetch('blueprint');
		}
		return this.publish_plan;
	},
};

//calculate fitupTable for a specialed frame 
//@param combinations{key-map} 
function fitupTable(entrys, exclude, combinations, resolver, callback){
	var n = entrys.length;
	var refers = {};

	if(entrys.length == 0){
		ondone();
		return;
	}
	entrys.forEach(function(oid){
		console.log3('An Entry : ', oid);
		oreKeeper.calDepTree(oid, resolver, function(ret){
			console.log3('calDepTree Result : ', ret);
			var incs = [];
			//exclude
			for(var i = 0; i < ret.incs.length; i++){
				if( ret.incs[i] in exclude ) continue;
				incs.push( ret.incs[i] );
			};
			refers[oid] = incs;
			//detect all done
			n--;
			console.log3('calDepTree Done : ', oid, 'n=', n);
			if(n == 0){ //ondone
				ondone();
			}
		});
	});

	function ondone(){
		combinations.forEach(function(refer){
			refers[refer.target] = refer.include;
		});

		callback(refers);
	}
};

//get a project object by options
var getProject = function(root, opts){
	if(!opts) opts = {};
	var pj;
	if( pj = projects[root] ){
		return pj;
	}else{
		//计算和准备相关资源
		opts.root = root;
		pj = new Project(opts);
		projects[opts.root] = pj;
		return pj;
	}
};

exports.getProject = getProject;
