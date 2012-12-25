/*
 * 矿石,原材料
 * 从矿石中提取出各种有价值的物质编译合并后发布到浏览器运行
 */
var Code = require('./code.js');
var fs = require('fs');
var path = require('path');

//支持的引用方式
var Code_Carves = {
	//用引用的源文件编译结果替换import语句
	'import': {
		regexp: /@import\s+('|")(.*?)\1/g,
		f: function(rs, string){
			var data = {
				kind: 'dependence',  // witch kind this match belong to
				tag: 'import',  // the key word of this statement
				refer: rs[2],
				origin: rs[0]
			};
			return {data: data, l: rs[0].length};
		}
	},
	//'frame': ,  //frame声明静态文件引用
	//commonJS模块引用
	'require': {
		regexp: /require\(('|")(.*?)\1\)/g,
		f: function(rs, string){
			var data = {
				kind: 'dependence',
				tag: 'require',
				refer: rs[2],
				origin: rs[0]
			};
			return {data: data, l: rs[0].length};
		}
	},
	// #segment[css]  #segment[ejs]
	'segment': {
		regexp: /(^|\n)#segment\s+\[(.+)\](\s*-\s*)?/g,
		f: function(rs, string){
			var end = string.indexOf('\n', rs.index + 1);
			var origin = string.substr(rs.index, end - rs.index);
			var optstr = null;
			if(rs[3]){ //we need string after ' - '...
				optstr = origin.substr(rs[0].length);
			}
			var data = {
				kind: 'mark',
				tag: 'segement',
				name: rs[2].replace(' ', ''),  //remove any space
				option: option,
				origin: origin
			};
			return {data: data, l: origin.length};
		}
	}
};


var Ore = function(filepath){
	this.filepath = filepath;
	this.filename = path.basename(filpath);
	this.code = new Code();
	this.segments = null;  //如果是复合矿,会有这个存储分离的片段 {'css': code, 'ejs': code, 'js': code}
};

Ore.prototype = {
	//加载文件内容,提取tag到this.code中
	load: function(callback){
		var self = this;
		var code = this.code;
		
		console.log3('Ore > load : ', this.filepath);
		//读取文件内容,异步的处理
		fs.readFile( this.filepath, 'utf8', function(err, source){
			console.log3('Ore > load > readFile: ', self.filepath);
			if(err){
				console.error('Ore: an error occured fs.read ore file : ', err);
				callback(err);
				return;
			}
			
			code.input(source, [ Code_Carves['import'], Code_Carves['require'], Code_Carves['segment'] ]);
			self.getSegments();
			callback();
		});
	},

	//从tag中过滤出依赖
	eachDeps: function(fn){
		var self = this;
		self.code.filter('dependence', fn);
	},

	getSegmentMarks: function(){
		var mks = {};
		code.filter('mark', function(mark){
			if(mark.tag == 'segment'){
				mks[mark.name] = {
					name: mark.name,
					optstr: mark.option  //options will passed to compiler of this kind
				};
			}
		});
		this.segments = mks;
		return mks;
	},
	
	//return a Code instance
	getSegmentCode: function(name){
		var _enter = false;  //set flag when step enter target code sections.
		var sections = this.code.dig(function(mark){
			if(mark.tag == 'segment'){
				if(_enter || name == mark.name){
					_enter = true;
					return 1;  //tell this is a begin/end
				}
			}else{
				return 0; //dont care this mark
			}
		});
		var subcode = new Code();
		subcode.sections = segments;
	},

	//will be written to cache
	toJSON: function(){
	
	}

	//TODO: 分离的多个segments编译结果该怎样暂存起来 以Ore为单位? 还是segment为单位?
};

//sourceKeeper 负责代码读取和缓存管理,可以提供Ore方法的
//common sence for all projects, maintain raw ore collection
//return: 
//{id: '', deps: '', }
//Error
var oreKeeper = {
	init: function(){
		var self = this;
		//监听寄存失效
		registor.addEvent('modified', function(info){
			var source = info['source'];
			if( source in self.files ){
				delete self.files[ source ];
			}
		});
	},
	//原始代码的相关信息运行时缓存
	cache: {
		//'/.../src/im/index.js': {id: '..', deps: [], }
	},

	//TODO: 问题: Ore在resolve的时候怎样获得足够的信息
	getById: function(id, callback){
		var self = this;
		var filepath = path.join('/Users/Lijicheng/works/webpager.test/src', id);
		self.getByPath(filepath, callback);
	},
	getByPath: function(filepath, callback){
		var self = this;
		var ore = self.cache[filepath];
		if(ore){
			callback(null, ore);
			return;
		}
		//缓存中没有,新建一个,load完成后回调
		ore = new Ore(filepath);
		console.log3('oreKeeper > getByPath : ', filepath);
		ore.load(function(err){
			if(!err){
				err = null;
				self.cache[filepath] = ore;
			}
			callback(err, ore);
		});
	},
	//从一个起点计算依赖树,完备的模块列表
	calDepTree: function(id, resolver, callback){
		var self = this;
		//var mentions = [];  //所有提到的模块
		var uni = {};  //去重 content is an Array, dep subTree

		//中途的报错
		var errors = [];
		//var t = 0;  //异步任务计数 开始异步时+1 完成任务-1 完成时检查计数为0 全部结束
		//更换异步完成策略: 每一个层级自己收齐deps的信息,调用回调

		//递归收集所有require信息,生成依赖树
		//支持利用register暂存结果
		var docollect = function(id, fn, _d){
		_d++;
			//TODO: 如果force,或者当前模块被改变,重新计算依赖
			
			if(uni[id]){
				fn( id );
				return;  //去重
			}
			uni[id] = [id];
			console.log3('oreKeeper > calDepTree > docollect : ', id);
			
			//t++;
			self.getById(id, function(err, ore){
				if(err){
					errors.push(err);
					fn(id);  // !! this is a unnormal module
					return;
				}
				var _gl = 0,
					_over = false;
				var tree = uni[id];
				var basedir = path.dirname(ore.filepath);
				ore.eachDeps(function(dep, next){
					if(dep == null && next == null){
						console.log3('eachDeps > = ', id , ' ', _gl);
						fn(id);  //没有依赖任何其他模块,直接返回自己的id
						return;
					}
					if(next == null) _over = true;
					_gl++;
					var m = resolver.resolve(dep.refer, basedir);
					console.log3('eachDeps('+ _d +') > + ', id, '->', m.id , ' ', _gl);
					docollect(m.id, function(subtree){
						if(typeof subtree == 'string') subtree = uni[subtree];  // unnormal situation just return id
						tree.push(subtree);
						_gl--;
						if(_gl < 0){
							console.error('eachDeps('+ _d +') > NOT!! ', _gl, ' ', id, ' <depend on> ', m.id, '\n', subtree, '\n\n');
							var err = new Error('Let me see!');
							throw err;
						}
						if(_gl == 0 && _over) fn(tree);
					}, _d);
				});
				//TODO: 模块出现的顺序,影响最终合并发布代码的顺序
			});

			//TODO: 检测循环依赖
		};

		var m = resolver.resolve(id);
		id = m.id;
		console.log('Start calTree : ', id);
		docollect(id, function(tree){
			//这个tree的数组[0]元素是该模块的id
			callback({
				incs: Object.keys(uni),
				tree: tree
			});
		}, 0);
	}
};


exports.Ore = Ore;
exports.keeper = oreKeeper;
