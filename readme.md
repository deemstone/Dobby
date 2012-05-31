使用方法

指定一个文件,console.log编译后的内容

研究object的resolve规则  实现编译时候的resolve方法
wrap实现, 从resolve中取得相关信息填充模版

模块的属性:
id 决定引用方式
file 磁盘上的位置,读取代码
relative path 从当前模块出发的相对路径,是一个已知条件,有域方式引用

源码写法:

- /src/im/index.js -
require('dom');
require('./im/chatroom');
require('shared::jqtpl');

发布文件:
/im.js

格式:
define( $root + $module, $dependencis.join(), function(require, exports, module){

require('./shared/jqtpl');
});

解析依赖的时候需要记录的信息:
define了哪些模块 [$module, ...]
每个模块依赖了哪些模块(相对路径) {$module: [$module], …}


针对object的模块命名策略: 目录模块命名/xx/index  引用的时候直接/xx  object会自动去找index
这样可以在index模块内部获得合理的 ./  ../ 
生成的模块描述script标签也要写index
定义模块时id必须是文件(../xx/index), 引用的时候可以省略index

还要支持内置模块 require('dom');