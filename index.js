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

//打包一个文件
//@param entry{path} 目标文件的完整路径/相对pkgroot的相对路径(不能以/号开头)
exports.bundle = function(entry, options){  //pkgroot执行工程根目录
	if(!entry){
		throw new Error('没指定入口文件');
	}

	if( ! options instanceof Object ){
		//TODO: 加载配置文件
	}

	//传递给Segment用的函数
	var resolver = function(cid, file, m){
		return Resolver(cid, file, m, options.root, options.src, options.domains);
	};

	//过程信息
	var mTree = [];  //记录模块依赖树,倒序,最基础的模块在最前面
	var mAll = {};  //记录所有涉及的模块
	var errors = [];

	var collect = function(id , src){
		//决定这个模块的名字
		//var src = path.join(pkgroot, id);
		var module = new Segment( id, src, resolver, function(err, deps){
			if( err ){
				errors.push(err);
				return;
			}
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
	
	//计算entry的完整路径
	var entrysrc;
	if(entry.charAt(0) != '/'){
		entrysrc = path.join(options.root, options.src, entry);
	}else{
		entrysrc = entry;
		entry = path.relative(path.join(options.root, options.src), entry);
	}
	collect(entry, entrysrc);

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
		output.push( mAll[id].wrap(options.prefix) );
		loader_map.push( options.prefix +'/'+ id );
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

//bundle过程参数
var options = {
	prefix: 'webpager',  //所有模块命名的id前缀(objectjs中的域概念)
	wrapper: 'objectjs',  //适配浏览器端环境
	root: '/Users/Lijicheng/works/webpager.git/',  //pkg根目录
	src: './src',
	domains: { //管理代码的域
		'shared': '../lib'  //基于src目录的相对路径
	}
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
	
	//var tool_root = __dirname;  //被执行的这个脚本所在目录
	exports.bundle(fullpath, options);
}
