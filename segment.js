/*
 * 模块封装类
 */

var Segment = function(statement, code){
	this.name = 'friendbook.tmplate#abuddy.jqtpl';  //identify a uniq segment in a project, also used as id regsiter.
	this.workflow = ['less', ''];  //从源代码到编译结果,需要经过的流程, 顺序调用workman处理代码
	this.workstatement = '#segmentname.tmp workman:inline,...';  //可以在segment声明行中指定一些附加的workman,这些workman会在扩展名(extname)关联的workman处理之后被调用
	this.code = code;
};

Segment.prototype = {
	compile: function(){
	
	}
};


var RegExp_require = /require\(('|")(.*?)\1\)/g;
//Segment原型类
var Segment = function(id, src){
	console.log('\nParsing : ', id);
	this.id = id;
	this.src = src;
	this.deps = null;
	this.output = null;
	this.extname = '.js';
};
Segment.prototype = {
	//生成浏览器可运行的代码
	compile: function(prefix){
		//已经有了,直接返回
		if(this.wrapped) return this.wrapped;
		//没有的话 替换 
		var deps = this.deps;
		var deps_refs = [];
		deps.forEach(function(d){
			deps_refs.push( d.ref );
		});

		// object.define( '$prefix/$id', '$deps.join(',')', function(require, exports, module){ ... });
		var mdopen = 'object.define("'+ prefix + this.id +'", "'+ deps_refs.join(',') +'", function(require, exports, module){\n',
			mdclose = '\n});';

		var wrapped = this.wrapped = mdopen + this.code + mdclose;
		this.output = wrapped;
		return wrapped;
	},
	//提取依赖
	extractDeps: function(resolver, callback){
		try{
		console.log(' Reading src : ', this.src);
			this.code = fs.readFileSync(this.src, 'utf8');
		}catch(e){
			if(callback) callback({
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
					m = resolver.resolve( m, path.dirname(this.src) );
					//如果是::域引用,替换成模块id引用
					if(m.domain){
						codes.push( this.code.substr( codei , rs.index - codei ) );
						codei = RegExp_require.lastIndex;
						codes.push( 'require(\''+ m.ref +'\')' );
					}
					//TODO: 临时滤掉tpl文件
					if(m.domain == 'tpl'){
						deps.push({ref: m.ref});
					}else{
						deps.push( m );
					}
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
		if(callback) callback(null, this.deps);
	},
	toJSON: function(){
		return {
			id: this.id,
			src: this.src
		};
	}
};

module.exports = Segment;
