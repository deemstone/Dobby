/*
 * 前端js工程管理工具
 *
 * @author jicheng.li
 * 用nodejs的方式管理源代码,自定义灵活的发布到各种浏览器环境
 * 
 * 只发布指定的文件
 * 解析require的依赖关系
 * 把代码wrap适配到特性浏览器端环境
 * bundle成单个js文件
 * 提供Dproxy扩展method直接处理某个库的文件请求
 */
var path = require('path');
var fs = require('fs');

var Segment = require('./segment.js');
var Resolver = require('./resolver.js');
var Register = require('./register.js');
var WatchFile = require('./watching.js').WatchFile;


//负责生成和保存publist
//记录所有bundles列表
//维护所有依赖关系树各节点的详细信息
//提供判断某节点寄存是否失效的方法
//TODO: 第一个版本的BigMap暂时只做Registor的一层便利封装,不提供树节点智能判断的功能
//基于文件mtime时间判断
var BigMap = function(registor){
	var self = this;
	this.registor = registor;
	this.segments = {};
	this.bundles = {};  //只有保存了寄存文件的bundles才会记录到这里
	this.load();
};
BigMap.prototype = {
	regkey: 'bigmap.json',
	schema: {
		segment: ['id', 'extname', 'deps', 'src'],
		bundle: ['id', 'type', 'incs']
	},

	load: function(){
		var ret = this.registor.fetch( this.regkey );

		if(ret){
			ret = JSON.parse(ret);
			this.segments = ret.segments;
			this.bundles = ret.bundles;
		}
	},
	filterKV: function(obj, schema){
		var ret = {};
		var valid = true;
		this.schema[schema].forEach(function(p, i){
			
			ret[p] = obj[p];  //可以判断是否是function 调用取得数据
		});
		return ret;
	},
	//把积累的map数据保存
	save: function(){
		var self = this;
		var ret = {
			segments: {},
			bundles: {}
		};
		var segments = this.segments;
		var bundles = this.bundles;
		Object.keys(segments).forEach(function(seg){
			ret.segments[seg] = self.filterKV( segments[seg], 'segment');
		});
		Object.keys(bundles).forEach(function(bdl){
			ret.bundles[bdl] = self.filterKV( bundles[bdl], 'bundle');
		});
		this.registor.replace( this.regkey, JSON.stringify( ret, null, '\t') );
	},

	//获取某个segment有效的寄存信息
	//bundle 参数是标志位,标示取得bundle实例
	//return Segment数据对象
	fetch: function(id){
		var obj;
		if( obj = this.segments[id] ){
			var regged = this.registor.isEffective(id, obj.src, '.sego', obj.extname);
			if(regged){
				obj.output = this.registor.fetch(regged.key);
				obj.mtime = regged.mtime;
				return obj;
			}else{
				return null;
			}
		}
	},
	//替换新版本
	//obj是segment实例,通过不同的schema指定提取哪些字段存储
	//segment和bundle分别用不同的postfix和extname配置,写入不同的寄存文件中
	//按照不同的schema校验对象的属性,不完整的对象会被丢弃
	replace: function(obj, schema){
		var postfix;
		//该segment信息添加到bigmap数据中
		if(schema == 'bundle'){
			this.bundles[ obj.id ] = obj;
			postfix = '.bundle';
			//编译结果寄存
			this.registor.replace( obj.id, obj.output, postfix);
		}else{
			this.segments[ obj.id ] = obj;
			postfix = '.sego';
			//编译结果寄存
			this.registor.replace( obj.id, obj.output, postfix, obj.extname);
		}

	},
	//查看源文件是否没有改动过,可以直接使用map中提供的寄存信息
	//@param id{string} 只要提供节点的id,将会在map中查询所有依赖
	//如果有效可用,返回
	isUp2date: function(id, postfix){
		//要确认每个incs中的segment寄存有效
		//最后还要确认bundle的寄存比所有segment都新
		//按照id在map中取出对应的节点
		var bundle = this.bundles[id];
		if(!bundle) return false;
		var entry = this.registor.isEffective(id, null, '.bundle');
		if(!entry) return false;

		var inc, reg, obj;
		for(var i = 0; i < bundle.incs.length; i++){
			inc = bundle.incs[i];
			obj = this.fetch(inc); //确认每个inc的寄存有效
			if( !obj || !(obj.output) ){  //对每个segment寄存确认比
				return false;
			}
			//确认bundle的时间最新
			if( obj.mtime > entry.mtime ){
				return false;
			}
		};

		//目前的策略是,只要有一个inc改变了,重新计算incs(为了防止被改变的inc中取消了对某个模块的依赖,留存了垃圾代码...)
		//TODO: 可以通过逐个判断该inc新提取的每个dep 是否被其他模块依赖的办法来确认是否需要从列表中删除某个inc

		//直接返回对应的寄存key
		console.log(' Bundle is Up to Date ! ');
		return entry.key;
	}
};

//生成最终发布文件的通用对象
//@param entry{string} 源模块id (index.js / index.cob)
//@param options{project} 工程对应的project对象
var Combine = function(entry, options){
	this.options = options;
	this.id = entry;
};

Combine.prototype = {
	//从entry开始计算需要打包的所有模块
	//要兼容bigmap中的信息
	collect: function(entry, force){
		var self = this;

		//过程信息
		var segments = {};  //记录所有涉及的Segment实例
		var incs = [];  //记录所有涉及的Segment id,供判断寄存有效
		var errors = [];

		//遍历被依赖的模块
		function depsEach(err, deps){
			if( err ){
				errors.push(err);
				return;
			}
			//处理被依赖模块
			deps.forEach(function(d, i){
				if( d.src && !segments[d.id] ){
					var s = self.newSegment(d, force);
					docollect(s, d.src);  //没有src属性的依赖是系统内置模块
				}
			});
		}
		//递归收集所有require信息,生成依赖树
		//支持利用register暂存结果
		var docollect = function(segment){
			//如果force,或者当前模块被改变,重新计算依赖
			if( force || !segment.deps ){
				//重新提取模块依赖信息
				segment.extractDeps( self.getopt('resolver'), depsEach);
			}else{
				depsEach(null, segment.deps);
			}
			//记录到依赖树中
			segments[segment.id] = segment;
			incs.push(segment.id);

			//TODO: 检测循环依赖
		};
		docollect(this.entry);

		this.incs = incs;
		this.segments = segments;

		return errors;
	},

	//取得一个对应类型的Segment实例
	//这里决定了它可以支持的源代码语言种类 jade less ...
	//参数id可以是字符串id, 也可以是resolve的结果对象
	newSegment: function(id, force){
		var src;
		if(typeof id == 'object'){
			src = id.src;
			id = id.id;
		}
		//充分利用bigmap
		var seg = this.getopt('bigmap').fetch(id);
		if(!seg){
			//判断类型
			var type = path.extname(id);
			if(!type || type.length < 2){
				//TODO: 扩展名不符合要求,查看文件第一行的类型声明
				type = '.js';
			}
			//var Proto = getProtoByExtname(type);
			var Proto = Segment;
			src = src || this.getopt('resolver').resolve(id).src;
			seg = new Proto(id, src);
		}
		return seg;
	},

	//将收集的文件编译打包
	bundle: function(force){
		var bigmap = this.getopt('bigmap');
		var key;

		if(force || !(key = bigmap.isUp2date(this.id)) ){
			this.entry = this.newSegment(this.id, force);
			//重新打包被改动过的模块
			var errors = this.collect(force);
			//失败的原因
			if( errors && errors.length){
				console.log('Failed!');
				errors.forEach(function(e){
					console.log(e.msg);
				});
			}else{
				console.log('Success!');
				//连接所有文件
				this.linkup();
				var bigmap = this.getopt('bigmap');
				bigmap.replace( this, 'bundle' );
				bigmap.save();
				return this.output;
			}
		}else{
			return this.getopt('registor').fetch(key);
		}
	},

	//把collect收集来的所有incs节点挨个拼接到一起
	linkup: function(){
		var incs = this.incs;  //TODO: 
		var segments = this.segments;
		var bigmap = this.getopt('bigmap');

		var output = [];
		incs.forEach(function(id, i){
			var obj = segments[id];
			//if(i == 0) return;
			if(!obj.output){
				obj.compile('webpager/');
				//更新bigmap
				bigmap.replace( obj, 'segment' );
			}
			output.push( obj.output );
		});

		//把entry的编译结果放到最后面
		//if(!this.entry.output) this.entry.compile();
		//output.push( this.entry.output );

		this.output = output.join('\n');
		//return this.output;
	},

	getopt: function(key){
		return this.options[key] || null;
	}
};
//所有支持的Segment类型
var segTypes = {
	commonjs: Segment
};
//运行时存储所有工程相关资源
var projects = {};
//工程相关信息
var Project = function(opts){
	this.srcdir = path.join( opts.root, opts.src );
	var registor = this.registor = new Register(opts.root);
	this.bigmap = new BigMap(registor);
	this.resolver = new Resolver(this.srcdir, opts.domains, ['index.js']);
	//var publist = 
};
var getProject = function(opts){
	var pj;
	if( pj = projects[opts.root] ){
		return pj;
	}else{
		//计算和准备相关资源
		pj = new Project(opts);
		projects[opts.root] = pj;
		return pj;
	}
};
//@param request{path} 请求,publist中的某个文件,不带/开头是id, 带/开头是完整文件路径
exports.bundle = function(request, options, force){
	//这里,在调用Combine组件之前,将所有参数标准化
	if(!request){
		throw new Error('没指定入口文件');
	}
	//处理所有路径变成真实路径(展开符号链接)
	options.root = fs.realpathSync(options.root);
	//根据options指定的工程信息,加载相应配置
	var pjt = getProject( options );

	//如果是完整路径,计算对srcdir的相对路径
	//if(request.charAt(0) != '/'){
	//	request = path.relative(pjt.srcdir, request);
	//}

	//resolve得到entry id
	var entry = pjt.resolver.resolve( request ).id;

	console.log(' Entry : ', entry)

	// Oh, Come On !
	var comeon = new Combine( entry , pjt );
	var output = comeon.bundle(force);
	return output;
};

//发布一整个工程
//@param options{object} 工程相关信息
//@param target{path} 发布路径
exports.build = function(options, target){
	//取出publist内容
	//按列表指定,挨个创建bundle,发布文件到target
};

//由pages的引用生成发布文件列表
//exports.mapout = function(){
//	
//};



//打包一个文件
//@param entry{path} 文件的访问路径,需要resolver解释解释一下;  目标文件的完整路径/相对pkgroot的相对路径(不能以/号开头)
//
//流程:
//1. resolve取得对应当前工程的源文件
//2. 如果找到文件,按照文件类型(combine/commonjs)打包
//3. 如果没找到文件,有include参数,按照列表挨个wrap,合并输出
//exports.bundle = function(entry, options, force){  //pkgroot执行工程根目录
//};


//bundle过程参数
var options = {
	prefix: 'webpager',  //所有模块命名的id前缀(objectjs中的域概念)
	wrapper: 'objectjs',  //适配浏览器端环境
	root: '/Users/Lijicheng/works/webpager.git/',  //pkg根目录
	src: './src',
	domains: { //管理代码的域
		'shared': '../shared',  //基于src目录的相对路径
		'tpl': '../tpl_build'
	}
};

//发布文件列表
var publist = [
	{
		path: 'im.js'   //默认是CommonJS模块打包
		//对tpl的引用暂时忽略不打包
	},
	{
		path: 'channel.js',
	},
	{
		path: 'ugc-topics.js',
		include: ['ugc/common', 'ugc/photo', 'ugc/video']
	},
	{
		path: 'buddy.tpl.js',
		include: ['tpl::buddy_win', 'tpl::buddy_groups', 'tpl::aBuddy', 'tpl::buddyLis', 'tpl::noResult' ]
	}
];

//如果是直接运行的,接收命令行参数
if( require.main === module ){
	var argv = process.argv;
	var fullpath = fs.realpathSync(path.resolve( argv[2] ));
	//var output = argv[3];

	if( !path.existsSync( fullpath ) ){
		console.log('指定入口文件不存在');
		process.exit(1);
	}


	var entry = path.relative( path.join( fs.realpathSync(options.root), options.src), fullpath );
	var bundled = exports.bundle(entry, options);
	fs.writeFileSync('/Users/Lijicheng/htdocs/xn.static/webpager/im.js', bundled);
}


//var pkg = findRoot(fullpath);
//if(!pkg){
//	console.log('在指定路径中没找到publist');
//	process.exit(1);
//}
//console.log('PKG: ', pkg);

//var tool_root = __dirname;  //被执行的这个脚本所在目录

//取得模块的root
//TODO: 不兼容windows
function findRoot(fullpath){
	//向上找到 / 有配置文件的就是root
	var cd = path.dirname( fs.realpathSync(fullpath) );
	var publist = '';  //pkg配置文件路径
	do{
		publist = path.join(cd, '/publist');
		if( path.existsSync( publist ) ){
			break;
		}
		cd = path.resolve(cd , '..');
	}while( cd != '/' );
	//根目录视为没找到
	if(cd == '/'){
		return null;
	}

	return {
		pulist: publist,
		root: cd
	};
};

