/*
 * 缓存编译中间文件
 * 
 * register - 寄存器
 * 所有query操作都不写
 * 目前,所有query操作都是同步的,reg操作可以异步
 */
var fs = require('fs');
var path = require('path');

var BuildDIR = '.build';  //编译过程的中间文件存放目录

var Register = function(root) {
	if (!path.existsSync(root)) {
		throw new Error('Pkg root directory not exist!');
	}
	this.dir = path.join(root, BuildDIR);
	this.root = root;
	this.checkModify();
};

Register.prototype.checkModify = function(){
	
};

//按照这个路径建立目录
function mkdirs(dirpath, mode, callback) {
	path.exists(dirpath, function(exists) {
		if (exists) {
			callback(dirpath);
		} else {
			//尝试创建父目录，然后再创建当前目录
			mkdirs(path.dirname(dirpath), mode, function() {
				//console.log( 'make dir ---> : ', dirpath, mode, callback);
				fs.mkdir(dirpath, mode, callback);
			});
		}
	});
};

//没有就创建新文件,有就直接覆盖
function overwrite(filepath, content){
console.log('Overwrite path: ', filepath);
	mkdirs( path.dirname(filepath) , null, function(dir){
		fs.open(filepath, 'w', function(err, fd){
			if(err){
				throw err;
			}
			fs.writeSync(fd, content, 0);
		});
	});
};

//按id取寄存的文件内容
Register.prototype.queryWrapped = function(id, src, wrapper) {
	var filename = path.basename( id, '.js');
	var regpath = path.join( this.dir, path.dirname(id), filename +'.'+wrapper+'.wp' );
	//返回内容 模仿Segment的格式
	var reg = {
		id: id,
		src: src,
		modified: false,  //是否有改动
		wrapped: regpath
	};
	//console.log('query Wrapped: ', regpath, ' -> ', src);
	//如果暂存wp文件存在,比较时间
	if( path.existsSync(regpath) ){
		//首先确认源文件是否存在,然后比较最后更改时间
		if( !path.existsSync(src) || (fs.statSync(src).mtime.getTime() > fs.statSync(regpath).mtime.getTime()) ){
			//被更改,需要重新编译
			reg.modified = true;
		}
	}else{
		reg.modified = true;
	}

	return reg;
};

//暂存包装过的文件
Register.prototype.regWrapped = function(id, content, wrapper) {
	var filename = path.dirname(id) + '/' + path.basename( id, '.js');
	var regpath = path.join( this.dir, filename +'.'+wrapper+'.wp' );
	overwrite(regpath, content);
	//mkdirs( path.dirname(regpath) , null, function(dir){
	//	fs.open(regpath, 'w', function(err, fd){
	//		if(err){
	//			throw err;
	//		}
	//		fs.writeSync(fd, content, 0);
	//	});
	//});
};

//按entry查询是否有编辑
//检查某个文件的所有依赖是否有改动
//return deps [ {id, src, modified, wrapped, }, ... ]
//这个deps只包含没有修改过的模块引用
Register.prototype.queryBundled = function(id, src, wrapper) {
	var self = this;
	//找到.bl文件,加载成为列表
	var regpath = path.join( this.dir, id+'.'+wrapper );
	var blpath = path.join( this.dir, path.dirname(id), path.basename(id, '.js') + '.'+wrapper+'.bl' );  //bl文件是跟wrapper无关的

	console.log( 'BL path : ',id, blpath);

	if( !path.existsSync(regpath) || !path.existsSync(blpath) ){
		return false;
	}
	//取出.bl文件的JSON
	var dmap = JSON.parse( fs.readFileSync(blpath, 'utf8') );
	//检查每一个依赖的包是否有改动
	var deps = {};
	var ismodified = false;  //只要有一个被改动,就modified
	Object.keys(dmap).forEach(function(id){
		var wm = self.queryWrapped(id, dmap[id].src, wrapper);
		if(wm.modified){
			ismodified = true;
		}else{
			deps[id] = wm;
		}
	});

	return {
		deps: deps,
		modified: ismodified,
		bundled: regpath
	};
};

//暂存bundled输出和依赖列表
//@param dpes{Array} [{id, src, wrapped }, ... ]
Register.prototype.regBundled = function(id, content, deps, wrapper) {
	//bundle内容保存到对应的wrpaaer后缀文件中
	console.log('This Build Dir: ', this.dir);
	var regpath = path.join( this.dir, id+'.'+wrapper );
	//console.log('To Be Overwrite : ', regpath);
	overwrite( regpath, content);
	//bundled list : id -> src
	var blpath = path.join( this.dir, path.dirname(id), path.basename(id, '.js') + '.'+wrapper+'.bl' );

	var dmap = {};
	Object.keys(deps).forEach(function(id){
		dmap[id] = {
			src: deps[id].src,
			deps: deps[id].deps
		};
	});
	overwrite( blpath, JSON.stringify( dmap , null, '\t'));
};

module.exports = Register;
