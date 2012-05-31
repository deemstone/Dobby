/*
 * 通过ref的方式找到被依赖的模块
 */
var path = require('path');
var fs = require('fs');
// 当前模块的 id src 查询字串 m 包root src目录
var Resolver = function(cid, file, m, root, sdir, domains){
	//拼出路径,如果是目录,查找index.js
	var cwd = path.dirname(file);  //当前模块文件所在目录的路径
	var domain = null,  //::号前面的一个单词
		ref = m,  //引用字串  ../shared/jqtpl.js
		id,  //被引用模块的统一标识  shared/jqtpl.js
		src;  //基于pkg根的文件路径

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
	//处理域引用
	var c;
	if( (c = m.indexOf('::')) > 0 ){
		domain = m.substr(0, c);  //域的名字
		id = m.replace('::', '/'); //path.join(domain, m.substr(c+2));
		//var root = path.join(  , );
		ref = path.relative( cwd, id );
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
