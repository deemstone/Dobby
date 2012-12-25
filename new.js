/*
 * 工程编译过程伪代码
 */

//过程说明: 
//有几种使用方法: 编译整个工程发布到某个目录,编译某个文件



/* ========== frame引用解析 ======== */

var frames = {};  //记录每个

//引用的几种方式: 直接指定入口模块, 指定某些模块绑在一起, 直接执行/异步加载
//面向计算发布方案抽象模型: 
//
//关于inc文件的处理方式: inc文件的方法被引入是为了防止重复的写某些常用的模块组合
//所以优先处理inc文件的"发布方案", 在处理包含inc的frame时要支持在inc的"发布方案"信息基础上计算发布方案,保证inc的作用发挥到整个工程上.
//第一版本暂时不支持inc文件

//读取frames文件列表
var pages = fs.readDirSync('./frames');
//逐个处理引用
pages.forEach(function(page){
	frames[page] = Extract_Refer( 'file/path/..html' );  //提取该frame的引用配置
});

//问题: 如果在不同的frame引用了同一个入口模块,合并方案必须相同(路径相同必定是同一个文件)
//如果发现某些"模块集合"导致合并方案不同,要报错!
//每个frame独自计算发布方案,最后合并到一个大表的过程中解决这类问题

/* ========== 计算相关依赖,生成发布方案 ======== */

//计算发布方案的标准: 每个frame中 完备, 不重复
//决定某个模块应该打包在哪个发布文件 指定合并 > 直接执行
//
//计算所有涉及模块的依赖关系
//取得frame里面指定的入口模块,计算他们依赖的模块
var frame = frames['frameName'];
//目标数据结构
var map = {
	'publish1.js' : ['a.js', 'b.js', 'c.js'],
	'publish2.js' : ['d.js']
};
var entrys = [];  //筛出所有入口模块
frame.forEach(function(refer){
	if(refer.type = 'entry'){  //一条指定合并的引用
		entrys.push(refer);
	}else{
		map['publishx.js'] = refer.incs;
	}
});  //入口模块
//多个入口文件可能会有某些共同的依赖模块,顺序也会影响结果
entrys.forEach(function(refer){
	var deps = Calculate_combo_list(refer.filename);  //计算从这个起点开始所有需要打包的资源

});

//计算结果的deps提供给frame,由frame计算各自的合并列表

//缓存发布方案,只要frame没变&&依赖关系没变,缓存有效

/* ========== 预处理替换预设标签,提取片段 ======== */

//替换预设标签: 发布日期,版本号,log级别...
//
//分离内容提取片段
//
//目标格式:
var Module = {
	id: 'xxx/xxx/.js',
	srcfile: '/path/to/src/file.js',
	referMethod: 'require',  //js引用,只需要合并到一起  @import 用内容替换掉import 
	segments: {
		'js': {},
		'less': {},
		'ejs': {}
	}
};

//代码存储结构设计
var code = [
	'code...',
	{type: 'tag', },  //特殊站位
	{type: 'import', },  //特殊站位
	'code.....'
];


/* ========== 编译所有片段,处理资源引用 ======== */

//优先编译referMethod是import的模块,供后面的模块取用内容
//缓存处理过的模块

/* ========== 按发布方案合并代码 ======== */


/* ========== 缓存输出文件,返回结果 ======== */
