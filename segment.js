/*
 * 模块封装类
 */
var fs = require('fs');

var RegExp_require = /require\(('|")(.*?)\1\)/g;

/*
 * Segment => Module
 *
 * 每个依赖Module都创建一个Segment管理自己的依赖
 * 若返回的是null创建失败,callback回调中会带有err信息
 */
function Segment(id, src, resolver, callback){
	console.log('\nParsing : ', id);
	this.id = id;
	this.src = src;
	this.resolve = resolver;
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
	//?? 同一个正则对象,交叉对多个字符串执行,会乱吗?
	RegExp_require.lastIndex = 0;  //归零

	var uni = {}; //去重标志位
	var deps = [];  //目标,依赖列表
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
			//暂时所有此工程模块的引用都用./ ../ 凡是不以.开头的依赖都视为系统内置模块 
			//TODO: 今后做到配置文件的dependencs列举
			//包含::的是域功能,需要处理引用
			if( m.indexOf('.') == 0 || m.indexOf('::') > 0){
				m = this.resolve(this.id, this.src, m);
				//如果是::域引用,替换成模块id引用
				if(m.domain){
					codes.push( this.code.substr( codei , rs.index - codei ) );
					codei = RegExp_require.lastIndex;
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
		codes.push( this.code.substr( codei ) );  //把剩下的一片代码截出来拼在后面
		this.code = codes.join('');
	}
};
//包装当前模块适配浏览器环境
Segment.prototype.wrap = function(prefix){
	var deps = this.deps;
	var deps_refs = [];
	deps.forEach(function(d){
		deps_refs.push( d.ref );
	});

	// object.define( '$prefix/$id', '$deps.join(',')', function(require, exports, module){ ... });
	var mdopen = 'object.define("'+ prefix +'/'+ this.id +'", "'+ deps_refs.join(',') +'", function(require, exports, module){\n',
		mdclose = '\n});';  //module define ...
	
	return mdopen + this.code + mdclose;
};

module.exports = Segment;
