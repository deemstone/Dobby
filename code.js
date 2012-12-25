/*
 * 代码分段管理的数据对象
 */
var Code = function(){
	this.sections = null;
	//this.source_code = null;  //源代码
};

Code.prototype = {
	push: function(string){
		if(this.sections == null) this.sections = [];
		this.sections.push(string);
	},
	//滤出所有type的section,用f的结果替换原内容
	filter: function(kind, f){
		var n = this.sections.length;
		var row, ret;

		//supporting knowing whether has a next in eachDeps()
		var hold = null,
			holdi = 0;
		for(var i = 0; i < n; i++){
			row = this.sections[i];
			if(typeof row != 'string' && row.kind == kind){
				//dont fn() until found next row
				if(hold == null){
					hold = row;
					continue;
				}
				ret = f(hold, row);
				if(ret) this.section[i] = ret;  //用f的结果替换原内容,替换引用语句
				hold = row;
				holdi = i;
			}
		};
		
		//the last one!
		ret = f(hold, null);
		if(hold){
			if(ret) this.section[i] = ret;  //用f的结果替换原内容,替换引用语句
		}
	},
	//装配输出
	fitup: function(){
		//可能需要做一些检查
		return this.sections.join();
	},

	//用regex正则表达式匹配string,每个结果调用f做处理
	//carves = { regex: , f: }
	input: function(string , carves){
		var self = this;
		
		console.log3('Code > input : ', string.substr(0, 20) + '...');
		var sections = [];
		var cuts = [],  // cut point
			r;  // used for reveiving cv.f returning, length to cut;
		var rs = null;
		var cv;

		for(var i = 0; i < carves.length; i++){
			cv = carves[i]
			console.log3('Code > input > carve : ', cv);
			cv.regexp.lastIndex = 0;  //归零
			while( rs = cv.regexp.exec(string) ){
			/*
			 * [ 'require(\'../lib/base\')',
			 * '\'',
			 * '../lib/base',
			 * index: 11,
			 * input: '整个code字串' ]
			 */
				r = cv.f(rs, string);  //just need return how long to cut, if 0 returned that means ignore this match.
				if(r) cuts.push({b: rs.index, l: r.l, data: r.data});
			}
		};

		//sort cuts from little to large
		cuts.sort(function(x,y){
			return x.b - y.b;
		});
		
		console.log3('Code > input > cuts : ', cuts);
		//按照上面找到的分割点,将字符串分割到sections中
		var c;
		var codei = 0;   //标记上次替换截取到哪个字符
		//var sections = self.sections;
		while( c = cuts.shift() ){
			if(codei > c.b) throw new Error('There has tow cutting superposition!');
			sections.push( string.substr( codei , c.b - codei ) );  //cut substr before this point
			c.data.statement = string.substr( c.b , c.l );  //cut current matching statement
			sections.push( c.data );  //desire formate : { type: 'require', statement: 'code...', otherInfo_generateBy_carveParser}
			codei = c.b + c.l;
		}
		//cut rest of the string
		sections.push( string.substr(codei) );
		self.sections = sections;
	},

	//find out sub code sections by special marks.
	dig: function(check){
		var n = this.sections.length;
		var row;

		var begin = null, end;
		for(var i = 0; i < n; i++){
			row = this.sections[i];
			if(typeof row != 'string' && row.kind == 'mark'){
				if( check(row) ){
					if(begin != null){
						begin = i;
					}else{
						end = i;
						break;
					}
				}
			}
		};
		
		if(begin != null){
			if(end){
				return this.sections.slice(begin);
			}else{
				return this.sections.slice(begin, end - begin);
			}
		}
		return '';  //nothing found return blank string
	}
};

module.exports = Code;
