/*
 * 模块封装类
 */
var fs = require('fs');
var path = require('path');

var RegExp_require = /require\(('|")(.*?)\1\)/g;
var Split_string = '\nalert("Deps Info JSON above, Source Code below.")\n';

/*
 * Segment => Module
 *
 * 每个依赖Module都创建一个Segment管理自己的依赖
 * 若返回的是null创建失败,callback回调中会带有err信息
 */
function Segment(id, src, registor){
	console.log('\nParsing : ', id);
	this.id = id;
	this.src = src;
	this.deps = [];
	this.registor = registor;
	//this.extract();
	//this.resolve = resolver;
	this.regkey = path.join( path.dirname(this.id), path.basename(this.id, '.js') +'.objectjs.wp');
	this.loadRegged('objectjs');
}

//从寄存区加载判断是否编辑过
//影响的标志位: modified
Segment.prototype.loadRegged = function(wrapper){
	var srcStat = fs.statSync( this.src );
	var regged = this.registor.fetch(this.regkey, srcStat.mtime);
	if(!regged){
		this.modified = true;
		return;
	}
	//用分隔符解开字符串 deps wrapped
	var i = regged.indexOf( Split_string );
	if(i<0){
		console.log( ' NO Splist_string Found ');
		this.modified = true;
		return;
	}
	
	this.deps = JSON.parse( regged.substr(0, i) );
	this.wrapped = regged.substr( i + Split_string.length );
};

//从代码中提取出所有require语句,并解析所有::形式的域引用
Segment.prototype.extract = function (resolve, callback){
	try{
		this.code = fs.readFileSync(this.src, 'utf8');
	}catch(e){
		callback({
			msg: 'Cant load module file : '+ this.id +' => '+ this.src,
			err: e
		});
		return null;
	}
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
				m = resolve(this.src, m);
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
	callback(null, this.deps);
};
//包装当前模块适配浏览器环境
//调用registor寄存包装结果
Segment.prototype.wrap = function(prefix){
	//已经有了,直接返回
	if(this.wrapped) return this.wrapped;
	//没有的话 替换 
	var deps = this.deps;
	var deps_refs = [];
	deps.forEach(function(d){
		deps_refs.push( d.ref );
	});

	// object.define( '$prefix/$id', '$deps.join(',')', function(require, exports, module){ ... });
	var mdopen = 'object.define("'+ prefix +'/'+ this.id +'", "'+ deps_refs.join(',') +'", function(require, exports, module){\n',
		mdclose = '\n});';

	var wrapped = this.wrapped = mdopen + this.code + mdclose;
	//先返回结果,稍后再异步保存
	//setTimeout(function(){
		console.log('Reg Wrapped!! ', this.regkey);
		this.registor.replace( this.regkey, JSON.stringify(this.deps) + Split_string + wrapped);
	//});
	return wrapped;
};

Segment.prototype.toJSON = function(){
	return {
		id: this.id,
		src: this.src
	};
};

module.exports = Segment;
