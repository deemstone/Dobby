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


提供服务
缓存编译好的文件,只有源文件改动过才重新编译
.build
src

wrap的时候自动将当前模块保存到.build对应的.build/im/index.objectjs.wp文件中
bundle的结果保存到 ./src/im/index.js -> .build/im.js
模块依赖树保存到 .build/im.js.bl
任何一个模块被编辑,它的依赖都需要重新计算
操作逻辑: 
上一次生成的依赖列表中如果没有任何编辑操作,直接返回bundle的文件;
如果有任何一个被编辑了, 重新计算依赖, 保存新的依赖树

每个寄存文件有效的判断,只要比较修改时间就可以
为了实现bundled的寄存,需要同时保存由entry开始的所有涉及到的模块的列表,所有的模块都没变才能断定bundled也不变

考虑Dproxy调用的时候参数
重新设计register,对segment和index抽象 文件路径名 不负责解析内容