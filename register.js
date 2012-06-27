/*
 * 缓存编译中间文件
 * 
 * register - 寄存器
 * 所有query操作都不写
 * 目前,所有query操作都是同步的,reg操作可以异步
 */
var fs = require('fs');
var path = require('path');

//var BuildDIR = '.build';  //编译过程的中间文件存放目录

//把root目录开辟成一块寄存区
var Register = function(root) {
	if (!path.existsSync(root)) {
		throw new Error('Pkg root directory not exist!');
	}
	this.dir = path.join(root, '.build'); //path.join(root, BuildDIR);
};

//设置某个寄存文件的内容
Register.prototype.replace = function(key, content, postfix, extname){
	if(postfix){
		key = this.key( key, postfix, extname );
	}
	var filepath = path.join( this.dir, key);
	overwrite(filepath, content);
	return filepath;
};
//取出某个寄存文件的内容
//@param key{string} 文件绝对路径
Register.prototype.fetch = function(key, postfix, extname){
	if(postfix){
		key = this.key( key, postfix, extname );
	}
	var filepath = path.join( this.dir, key );
	if( path.existsSync(filepath) ){
		return fs.readFileSync(filepath, 'utf8');
	}else{
		return null;
	}
};

//检查某个寄存文件是否有效
//@param after{Date()} 在这个时间之后的内容有效,可以是int, Date, 文件路径
Register.prototype.isEffective = function(key, srcfile, postfix, extname){
	//if(!WatchFiles.isModified(srcfile)) return false;
	if(!srcfile){
		var after = 0;
	}else if( typeof srcfile == 'string' ){
		var after = path.existsSync(srcfile) ? fs.statSync(srcfile).mtime.getTime() : 0;
	}else{
		var after = parseInt( srcfile );
	}
	if(postfix){
		key = this.key( key, postfix, extname );
	}
	var filepath = path.join( this.dir, key );
	if( path.existsSync(filepath) ){
		var mtime = fs.statSync(filepath).mtime.getTime();
		if(mtime >= after - 0){
			//WatchFiles.watch(srcfile, );
			return {
				key: key,
				mtime: mtime
			};
		}
	}
	return false;
};
//替换文件后缀得到真正的key
//@param id{string} 这个寄存文件关联的那个源文件id 可以不带.js扩展名
//@param postfix{string} 用来替换扩展名的后缀
Register.prototype.key = function(id, postfix, extname){
	var fname; 
	if(extname){
		fname = path.basename(id, extname) + postfix;
	}else{
		fname = path.basename(id) + postfix;
	}
	var key = path.join( path.dirname(id), fname );  //bl文件是跟wrapper无关的
	return key;
};

//按照这个路径建立目录
function mkdirs(dirpath, mode, callback) {
	path.exists(dirpath, function(exists) {
		if (exists) {
			callback(dirpath);
		} else {
			//尝试创建父目录，然后再创建当前目录
			mkdirs(path.dirname(dirpath), mode, function() {
				fs.mkdir(dirpath, mode, callback);
			});
		}
	});
};

//没有就创建新文件,有就直接覆盖
//@param filepath{string} 绝对路径
function overwrite(filepath, content){
	mkdirs( path.dirname(filepath) , null, function(dir){
	
		fs.open(filepath, 'w', function(err, fd){
			if(err){
				throw err;
			}
			console.log('Overwrite path: ', filepath);
			fs.writeSync(fd, content, 0);
		});
	});
};

module.exports = Register;


//监视文件改动
//根据查询时间/传入的时间 判断指定的文件是否有改动
//监视所有被关注文件的改动
//被修改时做标记
//程序退出保存文件状态,结束监视
var WatchFiles = exports.WatchFiles = {
	watching: {},  //
	//breaks: [],  //上次保存的记录,如果文件最后修改时间不晚于这个时间,可以视为没改动过,之后会被加入watchinglist

	init: function(){
		//读取上次寄存的列表,里面包含了所有监视过的文件的最后查询时间
		//process.onexit()  取消所有关注的监视
	},
	//查询某个文件在after之后是否编辑过
	//after参数可选
	isModified: function(file, after){
		after = after ? after - 0 : 0;  //after如果是0,或者undefined 只判断是否查询过,不判断时间
		//每次查询过一个文件,为这个文件建立一个条目,直到该文件被编辑过
		if( this.watching[file] ){
			//如果 after==0 不需要判断时间 直接返回false
			//如果 after!=0 判断时间
			return ( after && (this.watching[file] > after) );
		}
		
		var ret = true;
		if(after){
			var mtime = fs.statSync(filepath).mtime.getTime();
			//如果after为0,而且到这时已经确定watching列表中没有该文件,认为被改了
			if( mtime < after ){
				ret = false;
			}
		}
		
		//watch这个文件
		this.watch(file, mtime);
		return ret;
	},
	//某个文件被改动了
	fileModified: function(filepath){
		var self = this;
		delete self.watching[filepath];
		self.fireEvent('modified', {filename: name});
	},
	watch: function(filepath, mtime){
		var self = this;
		self.watching[filepath] = mtime;
		fs.watch(filepath, function(){
			self.fileModified(filepath);
		});
	}
};
