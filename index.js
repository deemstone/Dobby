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

//从某个入口开始打包
//支持使用register暂存中间结果
//每个暂存的模块内容必须包含它的依赖列表
//@param entry{string} 绝对完整路径
var Bundle = function(entry, options){
	options.srcdir = path.join(options.root, options.src)
	this.options = options;
	this.entry = entry;
	//针对这个pkg的寄存器
	var registor = this.registor = new Register(options.root+ '/.build');
	//计算entry的id
	console.log('Srcdir : ', options.srcdir, ' entry : ', entry);
	var id = this.id = path.relative( fs.realpathSync(this.getopt('srcdir')), fs.realpathSync(entry) );
	var ps = this.calpaths(id);
};
//取得配置
Bundle.prototype.getopt = function(key){
	return this.options[key] || null;
};
//计算出此工程下该id模块所有相关的路径
Bundle.prototype.calpaths = function(id){
	var paths = {
		bdlist: path.join( path.dirname(id), path.basename(id, '.js') + '.bl' ),  //bl文件是跟wrapper无关的
		regged: id+'.'+ this.getopt('wrapper'),  //寄存的打包好的文件
	};
	
	this.paths = paths;
	return paths;
};
//打包
Bundle.prototype.bundle = function(force){
	//判断寄存内容是否有效
	if( !force && !this.anyModified() ){
		//直接返回寄存的文件
		console.log(' Not Modified ! ');
		return this.bundled;
	}
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
	}

	//合并文件记录结果
	var output = [];
	var mAll = this.mAll;
	Object.keys(mAll).forEach(function(id, i){
		if(mAll[id].wrapped){
			//console.log('编译好的模块: ', mAll[id].wrapped)
			output.push( mAll[id].wrap() );
		}else{
			var wrapped = mAll[id].wrap(options.prefix);
			output.push( wrapped );
		}
	});
	bundled = output.join('\n');
	//寄存打包结果
	this.registor.replace(this.paths.regged, bundled);
	this.registor.replace(this.paths.bdlist, JSON.stringify(mAll, null, '\t'));
	return bundled;
};
//这个bundle涉及的所有模块是否有任何文件被改过
//在segments属性中暂存所有segment对象
Bundle.prototype.anyModified = function(){
	var self = this;
	this.segments = {};
	//需要在bundle中保存的信息 id列表 src源文件  最后保存时间  合并后的文件
	//需要在wrapped中保存的信息  
	//var regpath = path.join( this.dir, id+'.'+wrapper );
	console.log( 'BL path : ',this.id, this.paths.bdlist);
	
	var reg = this.registor.fetch( this.paths.bdlist );
	if(!reg){
		return true;  //没有寄存,需要重新打包,认为改动过
	}

	//取出.bl文件的JSON
	var dmap = JSON.parse( reg );
	//检查每一个依赖的包是否有改动
	var deps = {};
	var ismodified = false;  //只要有一个被改动,就modified
	Object.keys(dmap).forEach(function(id){
		//Segment对象自己调用Registor判断是否可用
		var segment = new Segment(id, dmap[id].src, self.registor);
		deps[id] = segment;
		//var wm = self.queryWrapped(id, dmap[id].src, wrapper);
		if(segment.modified){
			ismodified = true;
		}
	});
	this.segments = deps;

	var bundled = this.bundled = this.registor.fetch( this.paths.regged );
	return ismodified && bundled;  //确认寄存的文件存在
};
//收集所有依赖模块
Bundle.prototype.collect = function(force){
	var self = this;
	//传递给Segment用的函数
	var resolver = function(cid, file, m){
		return Resolver(cid, file, m, self.getopt('root'), self.getopt('src'), self.getopt('domains'));
	};
	//针对这个pkg的寄存器
	var registor = this.registor;

	//过程信息
	var segments = self.segments || {};
	var mAll = {};  //记录所有涉及的模块
	var mList = [];
	var errors = [];

	//递归收集所有require信息,生成依赖树
	//支持利用register暂存结果
	var docollect = function(id , src){
		//决定这个模块的名字
		if(segments[id]){
			var segment = segments[id];
		}else{
			var segment = new Segment(id, src, self.registor);
		}

		//遍历被依赖的模块
		function eachdeps(err, deps){
			if( err ){
				errors.push(err);
				return;
			}
			//处理被依赖模块
			deps.forEach(function(d, i){
				if( d.src && !mAll[d.id] ) docollect(d.id, d.src);  //没有src属性的依赖是系统内置模块
			});
		}
		//如果force,或者当前模块被改变,重新计算依赖
		if( force || segment.modified ){
			//TODO: 重新提取模块依赖信息
			segment.extract( resolver , eachdeps);
		}else{
			eachdeps(null, segment.deps);
		}
		//记录到依赖树中
		mAll[id] = segment;
		mList.push(segment);

		//TODO: 检测循环依赖
	};
	docollect(this.id, this.entry);
	
	this.mAll = mAll;
	return errors ;

};


//打包一个文件
//@param entry{path} 目标文件的完整路径/相对pkgroot的相对路径(不能以/号开头)
exports.bundle = function(entry, options, force){  //pkgroot执行工程根目录
	if(!entry){
		throw new Error('没指定入口文件');
	}
	var bundle = new Bundle(entry, options);
	return bundle.bundle(force);
};

//发布一整个工程
//@param pkgroot{path} 工程完整路径
//@param publist{path} 发布文件描述
//@param target{path} 发布路径
exports.build = function(pkgroot, target, publist){
	//取出publist内容
	//按列表指定,挨个创建bundle,发布文件到target
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
	var fullpath = path.resolve( argv[2] );
	var output = argv[3];

	if( !path.existsSync( fullpath ) ){
		console.log('指定入口文件不存在');
		process.exit(1);
	}

	var bundled = exports.bundle(fullpath, options);
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

