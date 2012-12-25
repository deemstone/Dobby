/*
 * frame处理对象
 * 每个对象处理一个frame文件
 */
var fs = require('fs');
var path = require('path');
var Code = require('./code.js');
var register = require('./register.js');
var Ore = require('./ore.js');
var Resolver = require('./resolver.js');

console.log3 = function(){};
console.log2 = function(){};
console.log1 = function(){};

var RegExp_Refer = /(^|\n)@(lazy|load)/g;

//用regex正则表达式匹配string,每个结果调用f做处理
//f是同步回调
var gothrough = function(string, regexp, f){

	//?? 同一个正则对象,交叉对多个字符串执行,会乱吗?
	regexp.lastIndex = 0;  //归零

	var deps = [];  //目标,依赖列表
	var rs = null;
	var codei = 0;  //标记上次替换截取到哪个字符
	var index = 0;
	while( rs = regexp.exec(string) ){
	/*
	 * [ 'require(\'../lib/base\')',
	 * '\'',
	 * '../lib/base',
	 * index: 11,
	 * input: '整个code字串' ]
	 */
		index = rs.index;  //与cutoff共享这个数字
		f(rs, cutoff);
		//console.log( ' => ', rs[0]);
	}

	//把剩下的最后一截传给回调
	f(null, string.substr( codei ) );

	//在当前匹配处将字符串截断,将之前的部分返回
	//@param length 从匹配处开始剪掉的长度
	function cutoff(length){
		var ret = string.substr( codei , index - codei );
		codei = regexp.lastIndex + length;
		return ret;
	};
	
};
var Frame = function(filepath){
console.log('new Frame : ', filepath);
	this.filepath = filepath;
	//this.refers = {};
	//保存处理的frame代码
	this.code = new Code();
};

Frame.prototype = {
	extract: function(callback){
		var self = this;
		var code = this.code;

		//将一条@lazy引用语句解析成对象 {kind:'refer', tag: 'lazy', target: 'xxx.js', include: ['module1', 'module2', 'module3'] }
		function parseRefer(string, rs){
			var ret = {'kind': 'refer'};
			if(rs[2]){
				ret.tag = rs[2];
			}
			//用空格分割字符串,  target_file[ --include module1 module2 ... ]
			var ls = string.substr(rs[1].length).split(/\s+/);
			//if(ls[0] == '') ls.shift();  //去除开头的空格
			ls.shift();
			ret.target = ls.shift();
			if(ls[0] == '--include'){
				if(ls.length == 1 || ls[1] == '') throw new Error('Frame中引用配置--include参数没有指定模块列表.');
				ret.include = ls.splice(1);
			}
			return ret;
		}

		//读取文件内容,异步的处理
		fs.readFile( this.filepath, 'utf8', function(err, source){
			if(err){
				console.error('Frame: an err returned when fs.read Frame file : ', err);
				throw err;
			}
			
			//将frame代码顺序处理成code列
			gothrough(source, RegExp_Refer, function(rs, cutoff){
				if(rs == null){
					code.push(cutoff);
					return;
				}
				var br = source.indexOf('\n', rs.index + 1);  //引用语句到换行处结束
				var statement = source.substr(rs.index, br - rs.index);  //截取出整个引用语句
				//将之前的代码截取push到code列中
				var prev = cutoff(statement.length);
				if(prev != '') code.push( prev );
				//将引用语句解析成一条记录push到code列中
				var refer = parseRefer(statement, rs);
				code.push( refer );
				//self.refers.push( code.length - 1 );
				//self.refers[ refer.target ] = refer.include;
			});

			callback();
		});
	},

	//装配
	fitup: function(map){
		//根据map中的合并方案,替换掉Code中的所有refer
		var code = this.code;
		code.filter('refer', function( refer ){
			//根据refer的src文件名,查询到对应的合并模块列表,拼接<script>语句
			return '<script src= ... >';
		});
	}
};


//以一个目录初始化一个frame集合
var FrameCollection = function(dirpath){
	//读取目录内的文件
	var frames = this.frames = [];
	var list = fs.readdirSync(dirpath);
	list.forEach(function(filename){
		var filepath = path.join(dirpath, filename);
		if(filepath != '.' && filepath != '..'){
			frames.push(new Frame( filepath ));
		}
	});
};
FrameCollection.prototype = {
	//所有frames执行extract, 所有refer条目调用f, 全部执行完毕调用ondone
	extract: function(f, ondone){
		var num = this.frames.length;
		var done = function(){
			num--;
			if(num == 0){
				ondone();
			}
		};

		//遍历逐个调用extract
		this.frames.forEach(function(frame){
			frame.extract(function(){
				frame.code.filter('refer', f);
				done();
			});
		});
	},

	eachFrame: function(f){
		var frames = this.frames;
		var num = frames.length;
		for(var i = 0; i < frames.length; i++){
			f(frames[i], num);
		};
	},
	//实现策略,回调的方式将每个处理完的文件输出
	//需要实现缓存
	fitup: function(){
	
	}
};

//缓存已经创建的collection
var collections = {

};
//用文件路径创建一个Frame对象
exports.Frame = Frame;
//取用一个collection
exports.getCollection = function(dirpath){
	var coll = collections[dirpath];
	if(coll){
		return coll;
	}else{
		coll = collections[dirpath] = new FrameCollection(dirpath);
		return coll;
	}
};

