/*
 * 通过ref的方式找到被依赖的模块
 */
var path = require('path');
var fs = require('fs');

//从当前目录按照指定ref引用,定位到那个模块
//支持::形式的域解析
//@param basedir{path} 当前所在完整路径
//@param ref{string} 引用require()
//@param srcdir{path} src目录完整路径
//@param domains{k-v} 域声明
var Resolver = function(basedir, ref, srcdir, domains){
	var domain = null,  //::号前面的一个单词
		//ref = m,  //引用字串  ../shared/jqtpl.js
		id,  //被引用模块的统一标识  shared/jqtpl.js
		src;  //基于pkg根的文件路径
	srcdir = srcdir || basedir;  //如果没有指定srcdir,认为与basedir同目录

	//处理域引用
	var c;
	if( (c = ref.indexOf('::')) > 0 ){
		domain = ref.substr(0, c);  //域的名字
		id = ref.replace('::', '/');  //这些模块id放在以domain名字命名的虚拟目录下
		src = path.join( srcdir, domains[domain] , ref.replace( domain +'::', '') );  //这里src路径都是从源码src目录算起的
		src += locate(src, 'index.js', 'js');
		ref = path.relative( basedir, path.join(srcdir, id) );
	}else{
		src = path.join( basedir , ref );
		src += locate(src, 'index.js', 'js');
		id = path.relative( srcdir , src );
	}

	return {
		id: id,
		src: src,
		ref: ref,
		domain: domain
	};
};

//文件夹下默认使用index.js
function locate(f, index, ext){
	if( path.existsSync(f) && fs.statSync(f).isDirectory() ){
		//是个目录
		//return path.join(f, index);
		return '/'+ index;
	}else{
		//是文件,判断是否有扩展名
		var r = RegExp( '\.'+ ext +'$');
		return r.test(f) ? '' : '.'+ext ;
	}
}

// 当前模块的 id src 查询字串 m 包root src目录
var Resolver0 = function(cid, file, m, root, sdir, domains){
	//拼出路径,如果是目录,查找index.js
	var cwd = path.dirname(file);  //当前模块文件所在目录的路径
	var domain = null,  //::号前面的一个单词
		ref = m,  //引用字串  ../shared/jqtpl.js
		id,  //被引用模块的统一标识  shared/jqtpl.js
		src;  //基于pkg根的文件路径

	//处理域引用
	var c;
	if( (c = m.indexOf('::')) > 0 ){
		domain = m.substr(0, c);  //域的名字
		id = m.replace('::', '/'); //path.join(domain, m.substr(c+2));
		//var root = path.join(  , );
		ref = path.relative( path.dirname(cid), id );
	}else{
		src = path.join( path.dirname(file) , m );
		c = locate(src, 'index.js', 'js');
		src += c;
		id = path.join( path.dirname(cid) , m ) + c;
	}

	//处理src
	if(domain){
	//console.log('domain', root, domains[domain], m.replace(/^[^:]+::/, ''));
		src = path.join( root, sdir, domains[domain] , m.replace(/^[^:]+::/, '') );
		src += locate(src, 'index.js', 'js');
	}

	return {
		id: id,
		src: src || id,
		ref: ref,
		domain: domain
	};
};

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
