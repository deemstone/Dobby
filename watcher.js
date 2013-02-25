#!/usr/bin/env node
/*
 * W&C
 * 监视文件改动，自动拷贝到发布目录
**/

var fs = require('fs');
var path = require('path');
var util = require('util');
var exec = require('child_process').exec;
var fsx = require('fs-extra');

//用命令行第一个参数指定工程目录
var project_path = (__filename == process.argv[1]) ? process.argv[2] : process.argv[1];  //如果直接node watcher.js方式运行的argv[0]是node
//project_path = path.resolve(__dirname, project_path);//

var project_config;
//读取工程下的wc.json配置文件
try{
	project_config = require(project_path +'/wc.json');	
}catch(e){
	console.error('\n貌似你的工程下wc.json配置文件有问题... ~_- \n');
	console.error(e.stack);
	process.exit(1);
}

//开始监听工程目录下的任何改动
//用fs.watch监视文件，（注意回调中filename没有提供为null）
//对于目录的监听 cp rm mv 全都是rename
//TODO:如果wc.json配置文件被改动，要重新添加监听

//为列表中所有文件添加监听
project_watching = {};  //watching list, 保存watch方法返回的对象，可以调用取消监听

var addFile = function(filename) {
	if(project_watching[filename]) return; //去重
	
	var fullpath = path.join(project_path, project_config.src, filename);
	//先检查文件是否存在，是目录还是文件
	fs.stat(fullpath, function(err, stat) {
		if(err){
			console.error( util.format('不存在的文件：<%s>', filename) );
			return;
		}
		//目录，递归进去
		if(stat.isDirectory()){
			fs.readdir(fullpath, function(err, filelist) {
				if(err) return console.error(err);
				filelist.forEach(function(child) {
					addFile(filename+'/'+child);
				});
			});
		}else if(stat.isFile()){
			//为看清每次change触发是哪一次绑定，为闭包添加随机数标号
			//var _t = parseInt(Math.random()*10);
			var w = fs.watch( fullpath, function(action, target) { //这个target就是被改动的文件名，Mac上实测为null
				//实测文件被改名会先触发renmae然后紧接着一个change
				//文件改回原名，只会触发rename
				//文件呗删除，只会触发rename
				//console.log('change : ', _t);
				//w.close();
				//console.log('close done');
				onAnyChange(filename, fullpath, action);
				//立即restart监听，也会收到上一次的change事件
				//貌似是底层库专门做了“暂存”在事件触发后的一小段时间里绑定的监听还可以收到这个事件。
				setTimeout(function() {
					w.start(fullpath, true);
					//console.log('restart done');
				}, 1000);//1s钟可以，200ms不行，具体暂存多长时间以后再研究
				//重新监视
				//project_watching[filename] = null;
				//process.nextTick(function() {					
				//	addFile(filename);
				//});
			});
			//编辑文件只收到一次改动事件，是否有错误报出？
			//w.on('error', function(err){console.log(err)});
			project_watching[filename] = w;
			console.log('monitoring '+ filename);
		}else{
			console.error( '这个文件有问题：', filename );
		}
	});
};

//任何文件改动调用onAnyChange处理
//这里触发dobby的build操作
var onAnyChange = function(filename, fullpath, action) {
	console.log( util.format('[%s] - %s', action, filename) );
	var target = path.join(project_path, project_config.copy, filename);
	var dirpath = path.dirname(target);
	//console.log('dirpath '+ dirpath)
	if( !fs.existsSync(dirpath) ){
		fsx.mkdirsSync(dirpath);
		console.log('mkdir '+ dirpath);
	}
	//console.log('copying '+ target);
	fsx.copy(fullpath, target, function(err) {
		if(err){
			console.error( util.format('Failed! copy "%s"', filename) );
		}else{
			console.info( util.format('Copied "%s"', filename) );
		}
	});
	//var cmd = util.format('cp %s %s', filename, project_config.copy);
	//console.log('excute shell command : ', cmd);
	//exec(cmd, {'PWD':project_path}, function(err, stdout, stderr) {
	//	if(err) console.error(err);
	//	console.log(stderr)
	//	stderr.on('data', function(data) {
	//		console.error(data.toString());
	//	});
	//});
};

//var watcher = fs.watchFile(project_path+'/README.md',{interval: 2003}, function(curr, prev) {
//	 );
//});

//setInterval(function() {
//	fs.appendFileSync(project_path+'/README.md', 'lala\n', 'utf8');
//	console.log('file data appended');
//}, 1000);
project_config.watch.forEach(function(filename, i) {
	addFile(filename);
});

console.info('watching <'+ project_path +'> ...');