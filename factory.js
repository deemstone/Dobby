//receive ore , output compiled file content
//cache all result in register
var fs = require('fs');
var path = require('path');

//manage all supported fitup step (every file type less,jade,coffescript... )
//read workman from a specialed dir
//var workman = {name: 'less', exts: ['.less'], process: function(code){};}
var workmen = {
	'less': workman,
	'jqtpl': workman
};
//extname to workman type
var exts = {
	'.less': 'less',
	'.tmp': 'jqtpl',
	'.js': ''
};

//fetch and valid built target
var queryCachedTarget = function(target, registor){
	var rfile = path.dirname(target) +'~'+ path.basename(target);
	var ret = registor.fetch(rfile);
	if(ret){
		//ret.info
		//check deps
	}else{
		return null;
	}
};

//lookup target in publish plan map, run compile and cache output to registor. 
var buildTarget = function(target, pjt, callback){

	//query registor if there someone ready for use
	var ret = queryCachedTarget(target, pjt.registor);
	if(ret){
		callback(ret.content);	
		return;
	}
	
	var extname = path.extname(target);  //this build only focus on {extname} type of segments
	var orelist = pjt.getTargetConstruct(target);
	var resolver = pjt.resolver;
	
	var sections = [];
	orelist.forEach(function(o){
		var filepath = resolver.resolve(o).src;
		oreKeeper.getByPath(filepath, function(ore){
			var mks = ore.getSegmentMarks();
			mks.forEach(function(m){
				if( path.extname(m.name) == extname ){
					var code = ore.getSegmentCode(m.name);
					//new segment instance
					//follow workflow for every segment instance
					//cache segment output to register
					//combine target output ande cache to register
				}
			});
		});
	});
	//TODO: 建造一个工厂,把ore放进去,分离出segments,挨个compile然后又工厂记录到registor中
	//所有registor的存储和查询工作都由工厂完成,ore只负责源代码初步处理,workman由工厂管理

};
