/*
 * 通过ref的方式找到被依赖的模块
 */
var path = require('path');
var fs = require('fs');

//支持::形式的域解析
//@param srcdir{path} src目录完整路径
//@param domains{k-v} 域声明
var Resolver = function(srcdir, domains, index){
	this.srcdir = srcdir;
	this.domains = domains;
	this.index = index;  // 指定的是目录 找什么样的问题代替  index.js  index.incs
}; 

//从当前目录按照指定ref引用,定位到那个模块
//@param basedir{path} 当前所在完整路径
//@param ref{string} 引用require()
Resolver.prototype.resolve = function(ref, basedir){
console.log('resolveing .. ', ref);
	var domain = null,  //::号前面的一个单词
		//ref = m,  //引用字串  ../shared/jqtpl.js
		id,  //被引用模块的统一标识  shared/jqtpl.js
		src;  //基于pkg根的文件路径
	var srcdir = this.srcdir;
	basedir = basedir || srcdir;  //如果没有指定basedir,认为与srcdir同目录

	//处理域引用
	var c;
	if( (c = ref.indexOf('::')) > 0 ){
		domain = ref.substr(0, c);  //域的名字
		id = ref.replace('::', '/');  //这些模块id放在以domain名字命名的虚拟目录下
		src = path.join( srcdir, this.domains[domain] , ref.replace( domain +'::', '') );  //这里src路径都是从源码src目录算起的
		src = locate(src);
		ref = path.relative( basedir, path.join(srcdir, id) );
		
	}else{
		src = path.join( basedir , ref );
		src = locate(src);
		id = path.relative( srcdir , src );
	}

	return {
		id: id,
		src: src,
		ref: ref,
		domain: domain
	};
};

// im.js -> im/index.js
// channel.js -> channel/index.cjs
function findIndex(d){
	var indexs = ['index.js', 'index.cjs'];
	for(var i = 0; i < indexs.length; i++){
		file = path.join( d, indexs[i] );
		if( path.existsSync(file) ){
			return path.join(d, indexs[i]);
		}
	}
	return path.join( d, indexs[0] );
};
//文件夹下默认使用index.js
function locate(f){
	//首先判断该文件是否存在
	if( path.existsSync(f) ){
		//存在,并且是文件,直接返回f
		if( fs.statSync(f).isFile() ){
			return f;
		}else{
			return findIndex(f);
		}
	}else{
		//不存在,尝试去掉.js的扩展名,判断是否是目录
		if( /\.js$/.test(f) ){
			var d = f.replace( /\.js$/, '');
			if( path.existsSync(d) ){
				return findIndex(d);
			}
		}else if(path.existsSync(f + '.js')){
			return f+'.js';
		}
	}
	return f;
		//
	if( path.existsSync(f) && fs.statSync(f).isDirectory() ){
		//是个目录
		var file;
	}else{
		//是文件,判断是否有扩展名
		var r = RegExp( '\.'+ ext +'$');
		return r.test(f) ? '' : '.'+ext ;
	}
}

module.exports = Resolver;

//如果是直接运行的,接收命令行参数
if( require.main === module ){
	var srcdir = '/Users/Lijicheng/works/webpager.git/src';
	var cases = [
		{bdir: '/Users/Lijicheng/works/webpager.git/src', ref: 'im'},
		{bdir: '/Users/Lijicheng/works/webpager.git/src/im', ref: '../lib'},
		{bdir: '/Users/Lijicheng/works/webpager.git/src/im', ref: '../lib/channel_api'},
		{bdir: '/Users/Lijicheng/works/webpager.git/src/lib', ref: './uikit'},
		{bdir: '/Users/Lijicheng/works/webpager.git/src/im', ref: '../service'},
		{bdir: '/Users/Lijicheng/works/webpager.git/src/buddy', ref: '../lib'},
		{bdir: '/Users/Lijicheng/works/webpager.git/src/im', ref: '../lib'},
	];

	cases.forEach(function(p){
		console.log( Resolver(p.bdir, p.ref, srcdir) );
	});
}
