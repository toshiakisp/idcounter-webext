// ==UserScript==
// @name           Futaba ID Counter
// @namespace      http://jun.2chan.net/
// @include        http://*.2chan.net/*/res/*.htm
// @description    スレ内IDの出現数をカウントし表示します。やっつけ。赤福共存可？
// ==/UserScript==

(function(){

// スレあきIDが見つからなければなにもせず終了
var e = document.evaluate('//form[@action="futaba.php"]/input[@type="checkbox"]/following-sibling::text()[contains(.,"ID:")]',document,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null);
if (e.singleNodeValue == null) { return; }

var n = e.singleNodeValue.nodeValue.indexOf('ID:');
var id_threaki = e.singleNodeValue.nodeValue.substring(n+3,n+11);

function idscan()
{
	var ref_length = 30; // コメント参照の制限文字数

	var ids = new Array;
	var ids_c = new Array;
	var num_ids = 1;
	ids[id_threaki] = 1;
	ids_c[id_threaki] = '[スレあき]';

	// レスのID探索
	e = document.evaluate('//form[@action="futaba.php"]/table//td/input[@type="checkbox"]/following-sibling::text()[contains(.,"ID:")]',document,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,null);
	for (var i=0; i < e.snapshotLength; i++)
	{
		var t = e.snapshotItem(i);
		var n = t.nodeValue.indexOf('ID:');
		var id = t.nodeValue.substring(n+3,n+11);
		var no = document.evaluate('preceding-sibling::input',t,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue.name;
		if (id in ids) {
			ids[id] += 1;
		} else {
			ids[id] = 1;
			num_ids += 1;

			// やっつけコメント参照
			var ec = document.evaluate('blockquote/text()',t.parentNode,null,XPathResult.ORDERED_NODE_ITERATOR_TYPE,null);
			ids_c[id] = '';
			var eci = ec.iterateNext();
			while (eci)
			{
				if (ids_c[id].length > ref_length){
					ids_c[id] += '...';
					break;
				}
				ids_c[id] += eci.nodeValue+' ';
				eci = ec.iterateNext();
			}
			if (ids_c[id].length == 0){
				ec = document.evaluate('blockquote//text()',t.parentNode,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null);
				if (ec.singleNodeValue){
					ids_c[id] = ec.singleNodeValue.nodeValue;
				}
			}
			ec = document.evaluate('a/img[@src]',t.parentNode,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null);
			if (ec.singleNodeValue){
				ids_c[id] = '[IMG] '+ids_c[id];
			}

			//透明テキストを仕込んで赤福にID引用でもポップアップさせる
			ec = document.evaluate('blockquote[not(font[@name="gm_fidc_faketext"])]',t.parentNode,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null);
			if (ec.singleNodeValue){
				var fake = document.createElement('font');
				fake.setAttribute('name','gm_fidc_faketext');
				fake.setAttribute('style','display:none;');
				fake.innerHTML = ' ID:'+id+' No.'+no+' del ';
				ec.singleNodeValue.appendChild(fake);
			}

			//最初の出現時はカウンタを挿れない
			continue;
		}

		// IDカウンタ挿入位置の確保
		if ( t.nodeValue.indexOf('No.',n+11) >= 0 ){
			// メモ：赤福動作後は日時+IDとNo.が既に別テキストノードになってる
			no = t.splitText(n+12);
		}else if (t.nextSibling.name == 'gm_fidc_a') {
			//既にIDカウンタがある場合はそのままにしておく
			//TODO:カウンタを作り直すべき？
			continue;
		}

		// IDカウンタを挿入
		var elm = document.createElement('a');
		elm.setAttribute('name','gm_fidc_a');
		elm.setAttribute('style','color:#117743;');
		if (id in ids_c){
			elm.setAttribute('title',ids_c[id]);
		}
		if (id == id_threaki) {
			elm.appendChild(document.createTextNode('['+ids[id]+'*] '));
		}else{
			elm.appendChild(document.createTextNode('['+ids[id]+'] '));
		}
		t.parentNode.insertBefore(elm,t.nextSibling);
	}

	//ステータスのユニークID数を更新
	e = document.getElementById('gm_fidc_uid');
	if (e){ e.firstChild.nodeValue = num_ids; }

	var n = 0;
	for (var k in ids) { if (ids[k] == 1){ n++; } }
	e = document.getElementById('gm_fidc_soloid');
	if (e){ e.firstChild.nodeValue = n; }
}

function idclear()
{
	var e=document.evaluate('//*[@name="gm_fidc_a" or @name="gm_fidc_faketext"]',document,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,null);
	for(var i=0; i < e.snapshotLength; i++){
		e.snapshotItem(i).parentNode.removeChild(e.snapshotItem(i));
	}
}
function clearall()
{
	idclear();

	var e=document.getElementById('gm_fidc_status');
	e.parentNode.removeChild(e);

	e = document.evaluate('//form[@action="futaba.php"]',document,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null);
	e = e.singleNodeValue;
	document.removeEventListener('DOMNodeInserted',idscan_onmodified, false);
}



// ページ末尾にステータス表示
var e = document.evaluate('//body',document,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null);
var body = e.singleNodeValue;
var div = document.createElement('div');
div.setAttribute('id','gm_fidc_status');
div.setAttribute('style','font-size:small;');
div.innerHTML='<b>IDカウンタ:</b> ユニーク<span id="gm_fidc_uid">?</span> (単発<span id="gm_fidc_soloid">?</span>)';//
var a = document.createElement('a');
a.setAttribute('style','color:blue;');
a.innerHTML='[再]';
a.addEventListener('click',idscan,false);
div.appendChild(a);

a = document.createElement('a');
a.setAttribute('style','color:blue;');
a.innerHTML='[消]';
a.addEventListener('click',idclear,false);
div.appendChild(a);

a = document.createElement('a');
a.setAttribute('style','color:blue;');
a.innerHTML='[保存用に全消]';
a.addEventListener('click',clearall,false);
div.appendChild(a);

body.appendChild(div);

//初期スキャン
idscan();


//赤福の「続きを読む」「同期」など
//ダイナミックに要素が変更された時にスキャンし直すようイベント登録
var timer;
function idscan_onmodified(e) {
	//追加されたレス以外はスルー
	if(e.target.tagName != 'TABLE'){ return; }
	//何度も実行されないように(デバウンス)
	clearTimeout(timer);
	timer = setTimeout(idscan, 100);
}
e = document.evaluate('//form[@action="futaba.php"]',document,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null);
e = e.singleNodeValue;
//赤福が最初に動くのを待ってから登録したほうが安全そうだから３秒待ってみる
setTimeout(function(){e.addEventListener('DOMNodeInserted',idscan_onmodified,false);}, 3000 );

})();

