W&C
===

名字：watching and copy

从这里开始构建一个用于前端工程管理的工具——**Dobby**。

Dobby终极目标：

* 让代码结构对开发者更友好；
* 灵活配置，支持各种针对运行环境优化的发布方案。

本期功能设计：
-----------

命令行程序，在终端运行，指定js工程目录，读取配置文件监视文件改动自动发布到build目录。

```
$ dobby /path/to/project
```

工程配置形式，wc.json指定要监视的文件/目录列表，指定源src和发布copy目录

```
{
	"copy": "./build",
	"src": "tkapi/src",
	"watch":[
		"tkapi.js",
		"tkapi"
	]
}
```

获取&安装
--------

1. git clone ...
2. git checkout wc
3. npm install -g
4. 可以使用dobby命令了