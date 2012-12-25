开发中。。。
==========
两年前的冬天，下班回家的地铁上就在思考怎样维护JS中烦人的HTML片段。再后来烦人的事儿越来越多，终于这个夏天花了些时间开始搞这个Dobby，希望他能像小精灵一样让所有复杂的事情一下子变简单。

现在只是个雏形，现在搞到Github上是为了防止再一次石沉大海。

主要解决的问题：

* 模板文件的管理，提供一种简便的方式在JS中引用模板。
* CSS文件分片，与相关的模板片段放到一起，方便维护。
* 一个UI模块包含所有的源代码（HTML模板、CSS、JS交互逻辑）
* require风格的依赖关系管理
* 在页面中提供一种新的引用静态文件方式，经过dobby处理后会替换成真实发布路径。

目前已经完成：

* require依赖关系的计算
* 源文件的简单预处理
* 自动计算合并方案

---------------- 以下内容请忽略 -------------------

-------------------------------------------------

使用方法
=======
dproxy使用require分支,配置文件使用最新的/pages/imf.htm  
dproxy的build模块指定到本地工程路径

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

考虑Dproxy调用的时候参数
重新设计register,对segment和index抽象 文件路径名 不负责解析内容

替代opm遇到问题:
同样依赖了../lib/base 的模块发布的时候怎样才能确定不需要合并 ../lib/base 进来?
怎样指定合并多个objectjs模块? 比如ugc实时化类型的多个模块
怎样指定合并多个raw的js文件? channel的合并

在基于require模块的bundle概念之上抽象,
风格: 配置文件指定发布的样子 / 所有发布文件都有对应的源文件


问题整理描述:
发布文件跟源文件怎样对应(发布文件是虚拟文件还是直接对应到某个源文件)
怎样引用第三方库(bobug, jqtpl)
怎样引用已经发布的第三方库(base-all, jQuery)
怎样规划模块合并方案(需要人为的按照模块使用频率优化)

方案:

不同的发布target采用不同的"描述文件",用来指定
列举系统内置模块,全局可用,不需要打包进来,也不需要处理依赖

源文件 -> 模块包装 -> 合并 -> 发布文件
      \_________/
      
几种源码组织方式:
CommonJS模块,通过require引用依赖
rawJS,通过@include合并多段js代码

浏览器端加载js的三种方式:
加载某个CommonJS入口模块(会打包所有require模块)
合并加载某几个CommonJS模块
加载某个combine文件

(所有的源文件都可以直接通过路径引用,任何虚拟文件不可以跟源文件命名冲突)
不允许直接发布依赖的第三方模块文件,只能用来包含到自己的发布文件中

确认依赖的模块已经在环境中:
已经在当前环境的其他发布文件中包含
必须知道当前环境的所有发布文件

几种初始化方式:
页面直接引用entry,并执行
动态load到页面上执行

几个特殊对待的目录:
root: 整个工程的根路径,可以访问到工程的所有资源
srcdir: 源码路径,由发布文件定位源文件的路径
pages: 决定发布方案
root下的其他目录: 工程资源,被srcdir下的文件引用

理想的开发过程: 
UI描述(生成模版和css)
pages(加载基础js,可以引用某些UI描述) express模版,发布过程编译成JSP
JS modules
entry

配置文件命名 manifest, 区别: 
nodejs工程下用package.json描述的工程只有js和其他逻辑代码,不包含界面
前端工程中用manifest.json,包含逻辑代码,界面描述…

整个系统基于一个简单的想法: 源文件任意组织,发布文件生成的过程就是从pages某个页面依赖的众多模块和UI绘制列表中,逐个处理提取并编译出浏览器能够执行的js,css片段,合并成为发布文件.

请求某个文件的过程:
---------------
找到对应的工程
加载发布方案
发布的文件暂时只有两种: css , js ; 将来可能有 png gif font ejs…

整个方案是以JS为起始逻辑的思想设计的. 所有其他文件全部都是js程序引用的资源.
如果css未指定发布文件名,与js同名,与js相同的加载方式(load/lazy).

寄存的时机:
---------
工程的配置文件是全局的依赖,被修改后整个工程需要重新编译.
最终发布文件需要寄存.
考虑编辑某个源文件,重新处理ore编译的次数,各ore.segments的编译结果暂时不需要寄存.

segments编译结果寄存的方式: 同一个文件? 分开存储?

寄存的实现策略:
-------------

主要话题: 

寄存形式: 唯一标识 + 内容 + 关联的源文件(失效条件)
标识 -> 路径
内容 -> 字符串
元信息 -> 源文件路径,修改时间

寄存有效的条件: 元信息格式正确,源文件存在(如果有指定源文件),源文件修改时间早于寄存的修改时间
问题: 是否可以指定多个源文件? 暂时不加,对于业务逻辑证明有稳定需求之后再加到库中.

为了实现bundled的寄存,需要同时保存由entry开始的所有涉及到的模块的列表,所有的模块都没变才能断定bundled也不变

寄存文件命名: 连接符 # ,同一个源文件的多个segments单独存储 通过#连接成文件名

计算列表的策略:
-------------
以页面为单位规划模块的发布方案,多个页面公用的发布方案描述可以通过pages文件引用(类似inc文件)实现
includes列表的优先级最高,是人为手工指定的模块组合,其他bundle合并时需要排除includes方式发布的模块
incs方式发布主要针对多个常用模块打包,利用浏览器端缓存提高整体效率

按照依赖计算模块列表
js中可以依赖非js资源,UI模块

需要的信息:
incs方式的模块列表
该页面涉及的所有模块列表(JS,UI..)
几个设计原则:
-----------
工程文件中不记录发布方案相关信息: 发布路径, 前缀, 包装方法...
不重复记录信息: pages中已经描述了发布合并方案,不需要单独的配置文件重新描述

重新描述我们要做的事儿:

配置文件描述工程的公用属性
由一套resolve规则把请求映射到某个源文件上

接到请求之后: 

1. resolve找到对应的源文件
2. 计算依赖(每种类型的segment有不同的方式)
3. 所有的依赖编译处理
4. 合并各依赖的编译结果(各依赖的编译结果可以作为中间产品寄存起来重复利用) 

由此浏览看来,只要提供不同种类的Segment就可以了,每种类型都由扩展名或独特的文件开头来标示类型
TODO:
=====

* 模版自动化打包
* CSS自动打包
* pages自动发布
* 由pages生成publist
* 