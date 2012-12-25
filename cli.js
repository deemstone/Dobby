//command line booter
var path = require('path');
var fs = require('fs');
var program = require('../../github/commander.js/');
var cmds = require('./command.js');

program
  .version('0.0.1')
  //.option('-C, --chdir <path>', 'change the working directory')
  //.option('-c, --config <path>', 'set config path. defaults to ./deploy.conf')
  //.option('-T, --no-tests', 'ignore test hook')

program
  .command('plan [cmd]')
  .description('All about publist plan, how these release files combined.')
  //.option("-e, --exec_mode <mode>", "Which exec mode to use")
  .option("-p, --project_path <mode>", "Which project to use.")
  .action(function(cmd, options){
  	var p;
	if(options.project_path){
		p = path.resolve( options.project_path );
	}else{
		p = path.resolve( './' );
	}
	p = fs.realpathSync(p);

  	switch(cmd){
		case 'recal':
			console.log('Calculating deploy plan ... ');
			cmds.plan.recal(function(err, map){
				if(!err){
					console.log('Calculating finished ... ');
				}else{
					console.log(err);
				}
			}, {p:p});
			break;
		case 'show':
		default:
			if(cmd != '' && cmd != 'show'){
				console.log('No command named : plan ', cmd);
				return;
			}
			//param "opts" putted down there, the second param;
			cmds.plan.show(function(err, map){
				console.log(map);
			}, {p: p, render: 'commandline'});

			console.log('show pubTable from registor.');
	}
  }).on('--help', function() {
    console.log('  Examples:');
    //console.log();
    //console.log('    $ deploy exec sequential');
    //console.log('    $ deploy exec async');
    //console.log();
  });

//发布整个工程
program
  .command('publish <target_dir>')
  .description('publish whole project into target_dir')
  .option("-s, --static_only [mode]", "dont generate no static files")
  .action(function(target_dir, options){
  	//
  });

//build a target file, print output to console, or special a output file with option -o
program
  .command('build <target>')
  .description('build a specialed file')
  .option("-o, --output <filepath>", "special a file to save build output")
  .action(function(target, options){
  	var param = {target: target};
  	cmds.build(function(err, output){
		if(err){
			console.log(err);
			return;
		}
		if(options['output']){
			fs.writeFileSync(options.output, output);
		}else{
			console.log(output);
		}
	}, param);
  });

program
  .command('register [action]')
  .description('operate on local register')
  //.option("-s, --setup_mode [mode]", "Which setup mode to use")
  .action(function(action, options){
  	switch(action){
		case 'clean':  //remove reged file that had no source file

			break;
		default:

	}
    var mode = options.setup_mode || "normal";
    env = env || 'all';
    console.log('setup for %s env(s) with %s mode', env, mode);
  });

program
  .command('exec <cmd>')
  .description('execute the given remote cmd')
  .option("-e, --exec_mode <mode>", "Which exec mode to use")
  .action(function(cmd, options){
    console.log('exec "%s" using %s mode', cmd, options.exec_mode);
  }).on('--help', function() {
    console.log('  Examples:');
    console.log();
    console.log('    $ deploy exec sequential');
    console.log('    $ deploy exec async');
    console.log();
  });

program
  .command('*')
  .action(function(env){
    console.log('deploying "%s"', env);
  });

program.parse(process.argv);

//如果是直接运行的,接收命令行参数
//if( require.main === module ){
//	var argv = process.argv;
//	if(argv[2] == 'plan'){
//		var p;
//	}else{
//		var fullpath = fs.realpathSync(path.resolve( argv[2] ));
//		//var output = argv[3];
//
//		if( !path.existsSync( fullpath ) ){
//			console.log('指定入口文件不存在');
//			process.exit(1);
//		}
//
//
//		var entry = path.relative( path.join( fs.realpathSync(options.root), options.src), fullpath );
//		var bundled = exports.bundle(entry, options); //, null, ['tpl::buddy/aBuddy.html.js', 'tpl::buddy/buddy_groups.html.js']);
//		fs.writeFileSync('/Users/Lijicheng/htdocs/xn.static/webpager/im.js', bundled);
//	
//	}
//}

