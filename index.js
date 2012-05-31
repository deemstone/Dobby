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

var RegExp_require = /require\(('|")(.*?)\1\)/g;

//bundle过程参数
var options = {
	prefix: 'webpager',  //所有模块命名的域
	wrapper: 'objectjs',  //适配浏览器端环境
	root: '/Users/Lijicheng/works/webpager.git/'  //pkg根目录
};
//这个工程所有id前缀(objectjs中的域概念)
var prefix = 'webpager';
//管理代码的域
var domains = {
	'shared': '../lib'
};


/*
 * Segment => Module
 *
 * 每个依赖Module都创建一个Segment管理自己的依赖
 * 若返回的是null创建失败,callback回调中会带有err信息
 */
function Segment(id, src, callback){
	console.log('\nParsing : ', id);
	this.id = id;
	try{
		this.code = fs.readFileSync(src, 'utf8');
	}catch(e){
		callback({
			msg: 'Cant load module file : '+ id +' => '+ src,
			err: e
		});
		return null;
	}
	this.deps = [];
	this.extract();
	callback(null, this.deps);
}

//从代码中提取出所有require语句
Segment.prototype.extract = function (){
	RegExp_require.lastIndex = 1;  //从1开始到0为止

	var uni = {}; //去重
	var deps = [],
		rpls = [];  //需要被替换的字串 {from, to}
	var rs = null;
	var codes = [];  //代码片段,为了支持替换
	var codei = 0;  //标记上次替换截取到哪个字符
	while( rs = RegExp_require.exec(this.code) ){
	/*
	 * [ 'require(\'../lib/base\')',
	 * '\'',
	 * '../lib/base',
	 * index: 11,
	 * input: '整个code字串' ]
	 */
		var m = rs[2];
		var stat = rs[0];
		if(!uni[m]){
			uni[m] = stat;
			//暂时所有此工程模块的引用都用./ ../ 凡是不以.开头的依赖都视为系统内置模块 TODO: 
			//包含::的是域功能,需要处理引用
			if( m.indexOf('.') == 0 || m.indexOf('::') > 0){
				m = this.resolve(m);
				if(m.domain){
					codes.push( this.code.substr( codei , RegExp_require.lastIndex - stat.length - codei ) );
					codei = RegExp_require.lastIndex;
					//rpls.push( {from: new RegExp( 'require\(("|\')'+  +'\), 'g'), to: } );
					codes.push( 'require(\''+ m.ref +'\')' );
				}
				deps.push( m );
			}else{
				deps.push({ref: m});  //没有src属性的依赖不会被处理
			}
		}
		console.log( stat, ' => ', m.ref || m);
	}
	this.deps = deps;

	if(codes.length){
		codes.push( this.code.substr( codei ) );
		this.code = codes.join('');
	}
	//TODO: 执行替换操作
	//if(rpls.length){
	//	rpls.forEach(function(rpl){
	//		
	//	});
	//}
};
//基于当前id的路径解出依赖的模块的id,带js扩展名
Segment.prototype.resolve = function(m){
	//拼出路径,如果是目录,查找index.js
	var cwd = path.dirname(this.id);
	var domain = null,  //::号前面的一个单词
		ref = m,  //引用字串  ../shared/jqtpl.js
		id,  //被引用模块的统一标识  shared/jqtpl.js
		src;  //基于pkg根的文件路径

	//文件夹下默认使用index.js
	function locate(f, index, ext){
		if( path.existsSync(f) && fs.statSync(f).isDirectory() ){
			//是个目录
			return path.join(f, index);
		}else{
			//是文件,判断是否有扩展名
			var r = RegExp( '\.'+ ext +'$');
			return r.test(f) ? f : f+'.'+ext ;
		}
	}
	//处理域引用
	var c;
	if( (c = m.indexOf('::')) > 0 ){
		domain = m.substr(0, c);
		//var d = domains[domain];
		id = path.join(domain, m.substr(c+2));
		ref = path.relative( cwd, id );
	}else{
		id = path.join( cwd, m);
	}
	//加工上面的半成品id
	id = locate(id, 'index.js', 'js');

	//处理src
	if(domain){
		src = path.join( domains[domain] , m.replace(/^[^:]+::/, '') ); //path.join( domains[domain], id );  //rp -> relative path
		src = locate(src, 'index.js', 'js');
	}

	return {
		id: id,
		src: src || id,
		ref: ref,
		domain: domain
	};
};
//包装当前模块适配浏览器环境
Segment.prototype.wrap = function(){
	var deps = this.deps;
	var deps_refs = [];
	this.deps.forEach(function(d){
		deps_refs.push( d.ref );
	});

	// object.define( '$prefix/$id', '$deps.join(',')', function(require, exports, module){ ... });
	var mdopen = 'object.define("'+ prefix +'/'+ this.id +'", "'+ deps_refs.join(',') +'", function(require, exports, module){\n',
		mdclose = '\n});';  //module define ...
	
	return mdopen + this.code + mdclose;
};

//打包一个文件
exports.bundle = function(entry, pkgroot){  //pkgroot执行工程根目录
	if(!entry){
		throw new Error('没指定入口文件');
	}
	//完整路径,相对root的路径,

	//过程信息
	var mTree = [];  //记录模块依赖树,倒序,最基础的模块在最前面
	var mAll = {};  //记录所有涉及的模块
	var errors = [];

	var collect = function(id , src){
		//决定这个模块的名字
		//var src = path.join(pkgroot, id);
		var module = new Segment( id, src, function(err, deps){
			if( err ){
				errors.push(err);
				return;
			}
			//此模块extract完成,可以处理
			//var deps = module.deps;
			//处理被依赖模块
			deps.forEach(function(d, i){
				if( d.src && !mAll[d.id] ) collect(d.id, d.src);
			});

		});

		//记录到依赖树中
		mAll[id] = module;
		if(module) mTree.push(module);  //如果出错会返回null的

		//TODO: 检测循环依赖
	};
	
	collect(entry, entry);

	//失败的原因
	if(errors.length){
		console.log('Failed!');
		errors.forEach(function(e){
			console.log(e.msg);
		});
	}else{
		console.log('Success!');
	}

	console.log('mAll : ', Object.keys(mAll));
	//console.log('mTree : ', mTree);
	
	var loader_map = [];
	//实验生成合并文件
	var output = [];
	Object.keys(mAll).forEach(function(id, i){
		output.push( mAll[id].wrap() );
		loader_map.push( prefix +'/'+ id );
	});
	fs.writeFileSync('/Users/Lijicheng/htdocs/xn.static/webpager/im.js', output.join('\n'));

	console.log( loader_map.join(' ') );
};

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

//如果是直接运行的,接收命令行参数
if( require.main === module ){
	var argv = process.argv;
	var fullpath = path.join( process.cwd(), argv[2] );
	var output = argv[3];

	if( !path.existsSync( fullpath ) ){
		console.log('指定入口文件不存在');
		process.exit(1);
	}

	//var pkg = findRoot(fullpath);
	//if(!pkg){
	//	console.log('在指定路径中没找到publist');
	//	process.exit(1);
	//}
	//console.log('PKG: ', pkg);
	
	//暂时只支持在工程目录下运行
	var pkg = {
		root: process.cwd()

	};
	//处理路径
	var id = path.relative( pkg.root, fullpath);
	//var tool_root = __dirname;  //被执行的这个脚本所在目录
	exports.bundle(id, pkg.root);
}
