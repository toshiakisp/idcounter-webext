// ==UserScript==
// @name           Futaba ID Counter
// @namespace      http://jun.2chan.net/
// @include        http://jun.2chan.net/b/res/*
// ==/UserScript==

(function()
{
	var ref_length = 30; // コメント参照の制限文字数


	var ids = new Array;
	var ids_c = new Array;
	var num_ids = 0;

	// スレあきIDをスキャン
	var e = document.evaluate('//form[@action="futaba.php"]/input[@type="checkbox"]/following-sibling::text()[contains(.,"ID:")]',document,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null);

	// スレあきIDが見つからなければもうなにもしない
	if (e.singleNodeValue == null) { return; }

	num_ids++;
	var n = e.singleNodeValue.nodeValue.indexOf('ID:');
	var id_threadmaster = e.singleNodeValue.nodeValue.substring(n+3,n+11);
	ids[id_threadmaster] = 1;
	ids_c[id_threadmaster] = '[スレあき]';

	// レスのID探索
	e = document.evaluate('//form[@action="futaba.php"]/table//td/input[@type="checkbox"]/following-sibling::text()[contains(.,"ID:")]',document,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,null);
	for (var i=0; i < e.snapshotLength; i++)
	{
		var t = e.snapshotItem(i);
		var n = t.nodeValue.indexOf('ID:');
		var id = t.nodeValue.substring(n+3,n+11);
		if (id in ids) {
			ids[id] += 1;
		} else {
			ids[id] = 1;
			num_ids += 1;

			// やっつけコメント参照
			var ec = document.evaluate('blockquote/text()',t.parentNode,null,XPathResult.ORDERED_NODE_ITERATOR_TYPE,null);
			ids_c[id] = '';
			var eci = ec.iterateNext();
			while (eci){
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

			//最初の出現時は記録しかしない
			continue;
		}

		// 万が一IDとNo.が同じテキストノードに無ければ変更処理はしない
		if ( t.nodeValue.indexOf('No.',n+11) < 0 ){
			continue;
		}

		// IDカウンタを挿入
		var t2 = t.splitText(n+11);
		var elm = document.createElement('a');
		elm.setAttribute('style','color:#cc1105;');
		if (id in ids_c){
			elm.setAttribute('title',ids_c[id]);
		}
		if (id == id_threadmaster) {
			elm.appendChild(document.createTextNode('['+ids[id]+'*]'));
		}else{
			elm.appendChild(document.createTextNode('['+ids[id]+']'));
		}
		t2.parentNode.insertBefore(elm,t2);
	}


	e = document.evaluate('//body',document,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null);
	e.singleNodeValue.appendChild(document.createTextNode('ID-Total:'+num_ids));

})();

