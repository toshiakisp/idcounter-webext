// ==UserScript==
// @name           Futaba ID Counter
// @version        0.20111113
// @description    ID表示のスレにIDカウンタを追加したりする
// @namespace      https://github.com/toshiakisp
// @author         toshiaki.sp
// @license        MIT
// @grant          none
// @downloadURL    https://github.com/toshiakisp/idcounter-userscript/raw/master/futaba_id_counter.user.js
// @include        http://*.2chan.net/*/res/*.htm
// @include        unmht://www.nijibox2.com/http.5/futalog/*/src/*.mht/
// @include        http://www.nijibox2.com/futalog/*/src/*.mht
// @include        http://nijibox.ohflip.com/futalog/*/src/*.mht
// @include        http://magmag.ath.cx/cgi-bin/futaba/log/*/res/*.htm
// ==/UserScript==

(function(){

/**** カスタマイズ ****/
var USE_THREAKI_SIGN = true; // スレあきのIDに印を付ける
var THREAKI_SIGN = '*'; // スレあき印
var USE_SOLO_ID_EXCEPTION = true; // 単発IDはカウンタ非表示にする
var USE_ID_JUMP_ON_CLICK = true; // IDカウンタクリックで次/前(Shift)のID出現箇所へスクロールする
// ポップアップ
var USE_ID_POPUP = true; // IDカウンタでレスをポップアップ
var USE_ID_POPUP_FOR_TEXT = true; // テキスト中のIDからポップアップ(テスト)
var ID_POPUP_ALWAYS_OTHERS = false; // ポップアップは常に全レス
var ID_POPUP_FIRST_OTHERS = true; // ID初登場時のポップアップは全レス表示
var ID_POPUP_IMG_SCALE = 0.5; // ポップアップ中の画像のサイズ比
var ID_POPUP_FONTSIZE = '75%'; //ポップアップの文字サイズ
// 赤福騙し(旧式)
var USE_AKAFUKU_ID_CITE = false; // >ID:xxx 形式引用でも赤福で無理矢理ポップアップ

var WORK_IN_NON_ID_THREAD = true; // 非IDスレでもIDをカウントしたりIDレスの追加に備えたりする

////

var identifier = 'ID';
var idcThreaki = scanThreakiId();
if (!idcThreaki && !WORK_IN_NON_ID_THREAD) {
  return; // スレあきID/IPが見つからなければなにもせず終了
}

//レスの動的追加時に再スキャンするようイベント登録 (赤福の「続きを読む」などへの対応)
var form = document.evaluate('/html/body/form[@action and not(@enctype)]',document,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null).singleNodeValue;
if (form) {
  var timer;
  function idScanOnModified(ev) {
    if(ev.target.tagName != 'TABLE') {
      return; //追加されたレス以外はスルー
    }
    //console.info('idScanOnModified() called for a TABLE.');
    clearTimeout(timer); //scanIdを無駄に何度も実行しないように(デバウンス)
    timer = setTimeout(scanId, 100);
  }
  setTimeout(function(e){
    if (e.tagName != 'FORM') console.error('idScanOnModified() was registered as an event listener of %s, not of "FORM".',e.tagName);
    e.addEventListener('DOMNodeInserted',idScanOnModified,false);
  }, 100, form);
}

scanId();

/**** 関数 ****/

function getElementByTagNameInAncestors(e,tagname){
  if (!e) return null;
  var ep = e.parentNode;
  while ( ep && ep.tagName != tagname) {
    ep = ep.parentNode;
  }
  if (ep && ep.tagName == tagname) {
    return ep;
  }else{
    return null;
  }
}
function getPositionY(e){
  return (e.offsetTop + (e.offsetParent ? getPositionY(e.offsetParent) : 0) );
}
//空のテキストノードを無視して前後の要素を参照する
function isIgnorable(node) {
  return ( node.nodeType == 8 //コメントか
    || ( node.nodeType == 3 && node.length == 0) //長さ0のテキストノード
  );
}
function getNodeAfter(node) {
  while ( (node = node.nextSibling) ) {
    if (!isIgnorable(node)) return node;
  }
  return null;
}
function getNodeBefore(node) {
  while ( (node = node.previousSibling) ) {
    if (!isIgnorable(node)) return node;
  }
  return null;
}


function scanThreakiId(){
  var text = document.evaluate('/html/body/form[@action and not(@enctype)]/input[@type="checkbox"]/following-sibling::text()[contains(normalize-space(.)," ID:") or starts-with(normalize-space(.),"ID:")]',document,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null).singleNodeValue;
  if (!text) {
    text = document.evaluate('/html/body/form[@action and not(@enctype)]/input[@type="checkbox"]/following-sibling::text()[contains(normalize-space(.)," IP:") or starts-with(normalize-space(.),"IP:")]',document,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null).singleNodeValue;
    if (!text) return null;
    identifier = 'IP';
  }else{
    identifier = 'ID';
  }
  //console.info('Identifier detected is "%s".',identifier);
  var n = text.nodeValue.indexOf(identifier+':');
  var nn = text.nodeValue.indexOf(' No.',n+3);
  if (nn<0) {
    nn = text.nodeValue.indexOf(' ',n+3);//No.が次のテキストノードの場合
    if (nn<0) nn = text.nodeValue.length;
  }else{
    text.splitText(nn+1);
  }
  if (nn<0) {
    console.error('スレあきIDの抽出に失敗. (n='+n+', nn='+nn+') in "'+text.nodeValue+'"');
    return null;
  }
  var idThreaki = text.nodeValue.substring(n+3,nn);
  return appendIdCounter(text,idThreaki,1,1);//透明カウンタを生成
}

function scanId() {
  //console.time('scanId()');

  function tryAppendFIDCParts() {
    if (_appended) return;
    _appended = true;
    appendFIDCStyle();
    // 末尾にステータス表示
    var target = document.evaluate('/html/body/form[@action and not(@enctype)]/br[@clear="left"]',document,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null).singleNodeValue;
    if (!target) { target = document.evaluate('/html/body/form[@action and not(@enctype)]/hr[following-sibling::div[@class="delform"]]/preceding-sibling::*[1]',document,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null).singleNodeValue; }
    if (target) appendFIDCStatus(target);
  }
  var _appended = false

  var idCounts = {};
  var idFirstNodes = {};
  var idOtherNodes = {};
  var numUniqId = 0;

  idcThreaki = idcThreaki || scanThreakiId();
  var idThreaki = (idcThreaki ? idcThreaki.getAttribute('__gm_fidc_id') : '');
  if (idThreaki) {
    numUniqId ++;
    idCounts[idThreaki] = 1;
    idFirstNodes[idThreaki] = idcThreaki.previousSibling;
  }

  //ID探索&カウンタ挿入ループ(破壊的)
  var eRes = document.evaluate('/html/body/form[@action and not(@enctype)]/table//td/input[@type="checkbox"]/following-sibling::text()[contains(.,"'+identifier+':")]',document,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,null);
  for (var i=0; i < eRes.snapshotLength; i++) {
    var t = eRes.snapshotItem(i);
    var n = t.nodeValue.indexOf(identifier+':');
    var nn = t.nodeValue.indexOf(' No.',n);
    if (nn<0) nn = t.nodeValue.indexOf(' ',n+3);//No.が次のテキストノードの場合など
    if (nn<0) {
      nn = t.nodeValue.length;//空白が無い時はテキストノードの終わりまで(AnimationGIFコメントが入る場合がある)
      t.nodeValue = t.nodeValue + ' ';
    }
    var id = t.nodeValue.substring(n+3,nn);
    var no = document.evaluate('preceding-sibling::input',t,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue.name;
    if (id in idCounts) {
      idCounts[id]++;
      if (!USE_ID_POPUP) idOtherNodes[id+'-'+idCounts[id]] = t;
    } else {
      numUniqId++;
      idCounts[id] = 1;
      idFirstNodes[id] = t;
    }

    if (USE_AKAFUKU_ID_CITE) {//やっつけ：透明テキストを仕込んで赤福にID引用でもポップアップさせる
      e = document.evaluate('blockquote[not(font[@class="gm_fidc_faketext"])]',t.parentNode,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;
      if (e) {
	tryAppendFIDCParts();
	var fake = document.createElement('font');
	fake.setAttribute('class','gm_fidc_faketext');
	fake.innerHTML = '<br/>'+identifier+':'+id+' No.'+no;
	e.appendChild(fake);
      }
    }

    // IDカウンタ挿入
    if ( t.nodeValue.indexOf(' No.',n) >= 0 ) {
      t.splitText(nn+1); //注：赤福動作後は日時+IDとNo.が既に別テキストノードっぽい。同じ場所で切る。
    } else if (t.nextSibling.className == 'gm_fidc_a') {
      continue; //既にIDカウンタがある場合はそのままにしておく
    }
    if ( idCounts[id] > 1 ) {
      tryAppendFIDCParts();
      appendIdCounter(t,id,idCounts[id]);
    }
  }

  //あらためて初出IDへのカウンタ挿入
  //初出にはレス数情報付きで ※countTotalValidIDC()が参照する
  for (var id in idFirstNodes) {
    tryAppendFIDCParts();
    appendIdCounter(idFirstNodes[id],id,1,idCounts[id]);
  }
  if (!USE_ID_POPUP) {//ポップアップ無しの時は"全xレス"を全てに付ける
    for (var id_c in idOtherNodes) {
      var id  = id_c.substring(0,id_c.lastIndexOf('-'));
      tryAppendFIDCParts();
      appendIdCounter(idOtherNodes[id_c],id,-1,idCounts[id]);//ラベルの更新だけ
    }
  }

  //ステータス更新
  e = document.getElementById('gm_fidc_uid');
  if (e){ e.firstChild.nodeValue = numUniqId; }
  var numSoloId = 0; //単発IDカウント
  for (var k in idCounts) { if (idCounts[k] == 1){ numSoloId++; } }
  e = document.getElementById('gm_fidc_soloid');
  if (e){ e.firstChild.nodeValue = numSoloId; }

  //テキスト中のIDポップアップ用イベント登録
  //ここで行うのはUSE_ID_POPUP_FOR_TEXTが動的に変わる可能性があるため。
  e = document.getElementsByTagName('body')[0];
  if (USE_ID_POPUP_FOR_TEXT && numUniqId > 0) {
    e.addEventListener('mousemove',onMouseMove,false);
  } else {
    e.removeEventListener('mousemove',onMouseMove,false);
  }

  //console.timeEnd('scanId()');
}

//IDカウンタを追加(既にある時は更新)
//・count <= 0 時は関係情報は設定しない
//・optTotal 次第でカウンタを透明にする(USE_SOLO_ID_EXCEPTION)
function appendIdCounter(target, id, count, optTotal) {
  var idThreaki = (idcThreaki ? idcThreaki.getAttribute('__gm_fidc_id') : '');
  var label = '[' + count + (USE_THREAKI_SIGN && id==idThreaki ? THREAKI_SIGN+'] ' : '] ');
  var e;
  if (target.nextSibling.className == 'gm_fidc_a') {
    e = target.nextSibling; //既存カウンタをターゲット
  } else {
    e = document.createElement('a');
    e.setAttribute('class','gm_fidc_a');
    e.setAttribute('__gm_fidc_id',id);
    target.parentNode.insertBefore(e,target.nextSibling);
  }
  if (count > 0) {
    e.setAttribute('id','gm_fidc_id'+id+'_'+count);
    e.setAttribute('__gm_fidc_count',count);
    e.innerHTML = label;
  }
  if (USE_SOLO_ID_EXCEPTION && count == 1 && optTotal == 1) {
    suspendNodeInnerHTML(e);
  } else if (count > 0) {
    putbackNodeInnerHTML(e);
  }
  if (optTotal > 0) {
    e.setAttribute('title','全'+optTotal+'レス');
    e.setAttribute('__gm_fidc_total',optTotal);
  }

  //イベント登録(再登録)
  //クリックでジャンプ(スクロール)するイベント
  if (USE_ID_JUMP_ON_CLICK) {
    e.addEventListener('click',jumpToUpDownFID, false);
  } else {
    e.removeEventListener('click',jumpToUpDownFID, false);
  }
  //IDカウンタ部でのポップアップイベント(単発以外に)
  if (USE_ID_POPUP && (!optTotal || optTotal != 1) ){
    e.addEventListener('mouseout', popupHandlerMouseOut, false);
    e.addEventListener('mousemove',popupHandlerMouseIn, false);
  } else {
    e.removeEventListener('mouseout', popupHandlerMouseOut, false);
    e.removeEventListener('mousemove',popupHandlerMouseIn, false);
  }

  return e;
}

function suspendNodeInnerHTML(node) {
  node.setAttribute('__text', node.innerHTML);
  node.innerHTML = null;
  return node;
}
function putbackNodeInnerHTML(node) {
  if (!node.hasAttribute('__text')) return node;
  node.innerHTML = node.getAttribute('__text');
  node.removeAttribute('__text');
  return node;
}

//レスに埋め込んだ物を消去
function clearId() {
  destoroyPopup();
  var es = document.evaluate('//*[@class="gm_fidc_a" or @class="gm_fidc_faketext" or contains(" "+@class+" "," gm_fidc_popup ")]',document,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,null);
  for(var i=0; i < es.snapshotLength; i++){
    es.snapshotItem(i).parentNode.removeChild(es.snapshotItem(i));
  }
  //カウンタ表示の初期化
  es = document.evaluate('//span[@id="gm_fidc_uid" or @id="gm_fidc_soloid"]',document,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,es);
  for(var i=0; i < es.snapshotLength; i++){
    es.snapshotItem(i).firstChild.nodeValue='?';
  }
  idcThreaki = null;
}

//全消
function clearAll() {
  clearId();
  var e = document.getElementById('gm_fidc_status');
  e.parentNode.removeChild(e);
  e = document.getElementById('gm_fidc_style');
  e.parentNode.removeChild(e);
  e = document.evaluate('/html/body/form[@action and not(@enctype)]',document,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null).singleNodeValue;;
  e.removeEventListener('DOMNodeInserted',idScanOnModified,false);
  e = document.getElementsByTagName('body')[0];
  e.removeEventListener('mousemove',onMouseMove,false);
}

function appendFIDCStatus(target) {
  var e = document.getElementById('gm_fidc_status');
  if (e) return;
  var div = document.createElement('div');
  div.setAttribute('id','gm_fidc_status');
  div.innerHTML='<b>'+identifier+'カウンタ:</b> ユニーク<span id="gm_fidc_uid">?</span> (単発<span id="gm_fidc_soloid">?</span>)';//
  
  //操作ボタンを生成
  var buttons = [
    {label:'再', func:scanId, desc:identifier+'を再走査します'},
    {label:'消', func:clearId, desc:identifier+'カウンタを消去します'},
    {label:'完全消去', func:clearAll, desc:identifier+'カウンタの全ての要素を消去します(ログ保存時等)'},
    {label:'設定', func:toggleConfigVisibility, desc:'設定を表示／非表示(一時的)'},
  ];
  for (var i=0; i < buttons.length; i++) {
    var a = document.createElement('a');
    a.setAttribute('class','gm_fidc_a_btn');
    a.setAttribute('title',buttons[i].desc);
    a.innerHTML=buttons[i].label;
    a.addEventListener('click',buttons[i].func,false);
    div.appendChild(a);
  }

  //設定ボタンを生成
  var conf = document.createElement('span');
  conf.setAttribute('id','gm_fidc_conf');
  conf.setAttribute('style','display:none;');
  div.appendChild(conf);
  var confs = [
    {label:'単発は別', varname:'USE_SOLO_ID_EXCEPTION', desc:'単発IDにはIDカウンタを付けない'},
    {label:'スレあき印', varname:'USE_THREAKI_SIGN', desc:'スレあきのIDに印"'+THREAKI_SIGN+'"を付ける'},
    {label:'ジャンプ', varname:'USE_ID_JUMP_ON_CLICK', desc:'IDカウンタクリックで次/前のレスへスクロール'},
    {label:'カウンタポップ', varname:'USE_ID_POPUP', desc:'IDカウンタのマウスオーバーで同IDのレスをポップアップ表示'},
    {label:'テキストポップ', varname:'USE_ID_POPUP_FOR_TEXT', desc:'テキスト中のIDマウスオーバーで同IDのレスをポップアップ表示'},
    {label:'最初は全レス', varname:'ID_POPUP_FIRST_OTHERS', desc:'最初のレスのIDポップアップでは他の全てのレス表示'},
    {label:'常に全レス', varname:'ID_POPUP_ALWAYS_OTHERS', desc:'IDポップアップは常に他の全てのレス表示（最初のレスだけでなく）'},
    {label:'赤福ID引用', varname:'USE_AKAFUKU_ID_CITE', desc:'赤福にID引用もポップアップしてもらうために全レスに透明テキストを仕込む'},
  ]; 
  conf.appendChild(document.createTextNode('={ '));
  for (var i=0; i < confs.length; i++) {
    if (i!=0) conf.appendChild(document.createTextNode(', '));
    var a = document.createElement('a');
    a.setAttribute('__var',confs[i].varname);
    if ( eval(confs[i].varname) ) {
      a.setAttribute('class','gm_fidc_conf_enb');
    }else{
      a.setAttribute('class','gm_fidc_conf_dis');
    }
    a.innerHTML=confs[i].label;
    if ('desc' in confs[i]) a.setAttribute('title',confs[i].desc);
    a.addEventListener('click',togglePopupConf,false);
    conf.appendChild(a);
  }
  conf.appendChild(document.createTextNode('}'));

  target.parentNode.insertBefore(div,target.nextSibling);
}
function toggleConfigVisibility(ev){
  var conf = document.getElementById('gm_fidc_conf');
  if (conf.offsetHeight == 0) {
    conf.setAttribute('style','display:inline;');
  } else {
    conf.setAttribute('style','display:none;');
  }
}
function togglePopupConf(ev) {
  var c = ev.target.getAttribute('class');
  var varname = ev.target.getAttribute('__var');
  if (!varname) return;
  if (c == 'gm_fidc_conf_enb') {
    ev.target.setAttribute('class','gm_fidc_conf_dis');
    eval(varname+'=false');
  } else if (c == 'gm_fidc_conf_dis') {
    ev.target.setAttribute('class','gm_fidc_conf_enb');
    eval(varname+'=true');
  } else {
    return;
  }
  clearId();
  scanId();
}

//スタイル埋め込み
function appendFIDCStyle(){
  var h = document.getElementsByTagName('head')[0];
  var style = document.getElementById('gm_fidc_style');
  if (style) return;
  style = document.createElement('style');
  style.setAttribute('id','gm_fidc_style');
  style.innerHTML='div#gm_fidc_status {font-size:small;}'
    +'div.gm_fidc_popup {position:absolute; z-index:402; border: 1px solid #117743; background-color:#FFFFEE; font-size:75%;}'
    +'div.gm_fidc_popup>table{border:0px;}'
    +'div.gm_fidc_popup>div:first-child{background-color:#117743;color:#ffffee;margin:0px;padding:2px;}'
    +'div.gm_fidc_popup>table tr>td{vertical-align:top;background-color:#f0e0d6;font-size:'+ID_POPUP_FONTSIZE+';}'
    +'div.gm_fidc_popup>table tr>td:first-child{background-color:#FFFFEE;}'
    +'div.gm_fidc_popup>table tr>td input{display:none;}'
    +'font.gm_fidc_faketext{display:none;}'
    +'a.gm_fidc_a{color:#117743;cursor:pointer;}'
    +'a.gm_fidc_aj{color:blue;cursor:pointer;text-decoration:underline;}a.gm_fidc_aj:hover{color:red;}'
    +'a.gm_fidc_a_btn{color:blue; cursor:pointer;}a.gm_fidc_a_btn:hover{color:red;}'
    +'a.gm_fidc_a_btn:before{content:" ["; color:#800000;}'
    +'a.gm_fidc_a_btn:after{content:"] "; color:#800000;}'
    +'a.gm_fidc_conf_enb{color:#800000;cursor:pointer;}'
    +'a.gm_fidc_conf_dis{color:#a0a0a0;cursor:pointer;}';
  h.appendChild(style);
}


// ID出現箇所へジャンプ
function jumpToPreviousFID(ev){
  jumpToUpDownFID(ev,-1);
}
function jumpToNextFID(ev){
  jumpToUpDownFID(ev,+1);
}
function jumpToUpDownFID(ev,opt_dir){
  opt_dir = opt_dir || false;
  var id = ev.target.getAttribute('__gm_fidc_id');
  var count = parseInt(ev.target.getAttribute('__gm_fidc_count'));
  var count_org = count;
  var dir = 1;
  if (!id || !count){ alert('No id or count information @'+ev.target); return; }
  if (opt_dir){
    opt_dir > 0 ? count++ : count--;
  }else{
    ev.shiftKey ? count-- : count++;
  }
  if ( ev.ctrlKey != 'undefined' && ev.ctrlKey) count = 1;
  if ( count == 0 ) count = countTotalValidIDC(id); //最後の要素へ飛ぶように同IDを数える

  scrollToNthFID(id,count,ev.target);
}
function jumpToThisFID(ev) {
  var id = ev.target.getAttribute('__gm_fidc_id');
  var count = parseInt(ev.target.getAttribute('__gm_fidc_count'));
  scrollToNthFID(id,count,ev.target);
}
function scrollToNthFID(id,n,origin) {
  var target = document.getElementById('gm_fidc_id'+id+'_'+n);
  if (!target) target = document.getElementById('gm_fidc_id'+id+'_1');//なければ最初にワープ(最後の次とか)
  if (!target) { console.warn('ジャンプするべき %s:%s [%s] が見つからない',identifier,id,n); return; }

  if (target.offsetHeight == 0){//表示されていないレスは表示させる
    var e = getElementByTagNameInAncestors(target,'TABLE');
    if (e) {
      if (e.style){
	e.style.display = 'block';
      } else {
	e.setAttribute('style','display: block;');
      }
    } else {
      console.warn('非表示レスを表示できなかった。(想定外のHTML構造?)'); 
      return;
    }
  }

  //元となる要素のY位置にターゲットが来るようにスクロール
  var posOrg = getPositionY(origin);
  var posDst = getPositionY(target);
  var posOld = document.documentElement.scrollTop;
  var pos = posDst - (posOrg - posOld);
  //console.info('scrollToNthFID(): jumping to %s:%s [%s] (%d -> %d ; origin=%d, target=%d)',identifier,id,n,posOld,pos,posOrg,posDst);
  document.documentElement.scrollTop = pos;
  //失敗したら後方互換モード用のコードでスクロール (UnMHT対策)
  if (pos != posOld && document.documentElement.scrollTop == posOld){
    pos = posDst - (posOrg - document.body.scrollTop);
    document.body.scrollTop = pos;
  }
}

/**** IDカウンタ参照・カウント関数群 (XPath) ****/
function findFirstValidIDC(id) {
  var e = document.getElementById('gm_fidc_id'+id+'_1');//この方が速い
  if (e) return e;
  return document.evaluate(
    '/html/body/form[@action and not(@enctype)]//td/a[@class="gm_fidc_a"][@__gm_fidc_id="'+id+'"]',
    document,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null
  ).singleNodeValue;
}
function findValidIDCWithNo(id,no) {
  return document.evaluate(
    '/html/body/form[@action and not(@enctype)]'
      +'//td/input[@name="'+no+'"]'
      +'/following-sibling::a[@class="gm_fidc_a"][@__gm_fidc_id="'+id+'"]',
    document,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null
  ).singleNodeValue;
}
function countTotalValidIDC(id) {
  var e = findFirstValidIDC(id);
  var c = e.getAttribute('__gm_fidc_total');
  if (c) return c;
  return document.evaluate(
    'count(/html/body/form[@action and not(@enctype)]/table//td/a[@__gm_fidc_id="'+id+'"])',
    document,null,XPathResult.NUMBER_TYPE,null
  ).numberValue;
}

/**** ポップアップ制御関係（ひどくやっつけ）****/
var popupCreateTimer;
var popupDestoroyTimer;
var popupSource;
var popupElement;
var popupPosition = {x:0,y:0};
var popupAkahukuReloadStatus;

function popupHandlerMouseIn(ev){
  if (popupElement) {
    clearTimeout(popupDestoroyTimer); popupDestoroyTimer = null;
  }else{
    popupPosition.x = ev.pageX;
    popupPosition.y = ev.pageY;
    clearTimeout(popupCreateTimer);
    popupCreateTimer = setTimeout(createPopup, 500);
  }
  if (popupSource != ev.currentTarget) {
    var id = ev.currentTarget.getAttribute('__gm_fidc_id');
    if (id) {
      if (popupElement && popupElement.getAttribute('__gm_fidc_id') != id){
	destoroyPopup();//別IDを指した時に前のを即消す（もう一度イベントが起きるのを期待）
      }
      popupSource = ev.currentTarget;
    }
  }
}
function popupHandlerMouseOut(ev){
  if (popupElement) {
    clearTimeout(popupDestoroyTimer);
    popupDestoroyTimer = setTimeout(destoroyPopup, 500);
  }else{
    clearTimeout(popupCreateTimer);
    popupSource = null;
  }
}
function destoroyPopup(){
  clearTimeout(popupCreateTimer);
  if (popupElement && popupElement.parentNode){
    popupElement.parentNode.removeChild(popupElement);
  }
  popupElement = null;
  popupSource = null;
  popupDestoroyTimer = null;
}
function createPopup(params){
  if (popupElement) return null;
  var id, count, targetNo;
  if (params && params.id) {
    id = params.id;
    count = params.count || 0;
    targetNo = params.no;
  } else if (popupSource) {
    id = popupSource.getAttribute('__gm_fidc_id');
    count = popupSource.getAttribute('__gm_fidc_count');
  } else {
    console.error('createPopup() failed because no ID information specified.');
    return null;
  }
  //console.time('createPopup()');

  //ポップアップ用要素の作成
  appendFIDCStyle(); //スタイル確認
  var newPopupElement =  document.createElement('div');
  newPopupElement.setAttribute('class','gm_fidc_popup');
  newPopupElement.setAttribute('__gm_fidc_id',id);
  if (targetNo) newPopupElement.setAttribute('__gm_fidc_no',targetNo);

  var elmOrigin;
  if (ID_POPUP_ALWAYS_OTHERS || (ID_POPUP_FIRST_OTHERS && count == '1') ) {
    elmOrigin = appendOtherIdsInPopup(newPopupElement,id,count);
  } else if (parseInt(targetNo) > 0) {
    elmOrigin = appendTargetIdNoInPopup(newPopupElement,id,count,targetNo);
    if (!elmOrigin) {
      elmOrigin = appendFirstIdInPopup(newPopupElement,id,count);
    }
  } else {
    elmOrigin = appendFirstIdInPopup(newPopupElement,id,count);
  }
  if (!elmOrigin) {
    console.error('createPopup() failed because of no valid elmOrigin.');
    //console.timeEnd('createPopup()');
    return null;
  }

  popupElement = newPopupElement;
  document.body.appendChild(popupElement);

  //ポップアップ内にマウスを移動させてもポップアップを維持するためのイベント登録
  popupElement.addEventListener('mouseover',popupHandlerMouseIn, false);
  popupElement.addEventListener('mousemove',popupHandlerMouseIn, false);
  //ポップアップ外にマウスが移動したときにポップアップを消すためのイベント登録
  popupElement.addEventListener('mouseout', popupHandlerMouseOut, false);

  //ポップアップの位置調整
  adjustPopupPosition(elmOrigin);

  //IDポップアップと赤福の「続きを読む」との問題
  //IDポップアップを開いたままだとポップアップもレスだと誤解されるのか、スレが壊れる。
  //場当たり的な対策として、続きを読む系のアクションを察知したらIDポップアップを即消すこととする
  if (!popupAkahukuReloadStatus) {
    popupAkahukuReloadStatus = document.getElementById('akahuku_reload_status');
    if (popupAkahukuReloadStatus) {
      popupAkahukuReloadStatus.addEventListener('DOMSubtreeModified',function(){destoroyPopup();}, false);
    }
  }
  
  //console.timeEnd('createPopup()');
  return popupElement;
}

function clearPopup(popup) {
  if (!popup) return;
  while ( popup.childNodes.length >= 1 ) {
    popup.removeChild(popup.lastChild);
  }
}

function appendTargetIdNoInPopup(popup,id,count,no) {
  var res = createResElementByFIDC(id,count,no);
  if (res) {
    var div_title = document.createElement('div');
    div_title.innerHTML = identifier+':'+id+' No.'+no;
    popup.appendChild(div_title);
    popup.appendChild(res);
    appendPopupFooter(popup,id,count);
    return popup;
  } else {
    return null;
  }
}

function appendFirstIdInPopup(popup,id,baseCount) {
  var total = countTotalValidIDC(id);
  if (total == 0) return null;
  //baseCountが不正(ダミー要素からのポップアップとか)の時は全レス数をcountへ
  var count = (baseCount < 2 ? total : baseCount);
  if (count == 0){
    console.warn('appendFirstIdInPopup() counts id='+id+' => count='+count+'.');
    return null;
  }

  //表示するにふさわしいレスを探す（削除された本分無しは回避）
  var res;
  var info='(全'+total+'個)';
  var first = getElementByTagNameInAncestors(findFirstValidIDC(id),'TABLE');
  if (count > 1 && (!first || first.className == 'deleted') ) {
    for (var i=1; i < count; i++) {
      res = createResElementByFIDC(id,i);
      if (!res) break;
      var n = document.evaluate('count(//blockquote/*[@color!="#ff0000"])+count(//blockquote/text())',res,null,XPathResult.NUMBER_TYPE,null).numberValue;
      if (n == 0) { continue; }else{ break; }
    }
  } else {
    res = createResElementByFIDC(id,1);
  }
  if (res) {
    var div_title = document.createElement('div');
    div_title.innerHTML = identifier+':'+id+' の最初のレス '+info;
    popup.appendChild(div_title);
    popup.appendChild(res);
    appendPopupFooter(popup,id,baseCount,total);
    return popup;
  }else{
    console.warn('appendFirstIdInPopup() could not found a res');
    return null;
  }
}

function appendPopupFooter(popup,id,optCount,optTotal) {
  optTotal = optTotal || countTotalValidIDC(id);
  var div = document.createElement('div');
  div.setAttribute('style','text-align:center;');

  var a;

  if (optCount > 0) {
    a = document.createElement('a');
    a.setAttribute('class','gm_fidc_a_btn');
    a.innerHTML = '前';
    a.setAttribute('__gm_fidc_id',id);
    a.setAttribute('__gm_fidc_count',optCount);
    a.setAttribute('title','この'+identifier+'の前の出現位置へスクロールします(カウンタShift+クリックと同じ)');
    a.addEventListener('click',jumpToPreviousFID,false);
    div.appendChild(a);
  }

  a = document.createElement('a');
  a.setAttribute('class','gm_fidc_a_btn');
  a.setAttribute('__gm_fidc_id',id);
  if (optCount > 0) a.setAttribute('__gm_fidc_count',optCount);
  if (optTotal > 0) {
    a.innerHTML = '全て表示(全'+optTotal+'個)';
  } else {
    a.innerHTML = 'レスを全て表示';
  }
  a.addEventListener('click',reloadPopupWithOtherRes,false);
  div.appendChild(a);

  if (optCount > 0) {
    a = document.createElement('a');
    a.setAttribute('class','gm_fidc_a_btn');
    a.innerHTML = '次';
    a.setAttribute('__gm_fidc_id',id);
    a.setAttribute('__gm_fidc_count',optCount);
    a.setAttribute('title','この'+identifier+'の次の出現位置へスクロールします(カウンタクリックと同じ)');
    a.addEventListener('click',jumpToNextFID,false);
    div.appendChild(a);
  }

  popup.appendChild(div);
  return div;
}

function reloadPopupWithOtherRes(ev) {
  if (!popupElement) return;
  var id = ev.target.getAttribute('__gm_fidc_id');
  var count = parseInt(ev.target.getAttribute('__gm_fidc_count'));
  //消滅タイマはいったん停止
  clearTimeout(popupDestoroyTimer);
  popupDestoroyTimer = null;
  //中身をクリアしてからレス収集
  clearPopup(popupElement);
  var e = appendOtherIdsInPopup(popupElement,id,count);
  if (count > 0) adjustPopupPosition(e);//横幅が増えてずれるかもしれないので再調整(ダミー(cound<0)の時は不要)
}
function appendOtherIdsInPopup(popup,id,count) {
  var total = countTotalValidIDC(id);
  var divHeader = document.createElement('div');
  if (count > 0) {
    divHeader.innerHTML = identifier+':'+id+' のその他のレス (全'+total+'個)';
  } else {
    divHeader.innerHTML = identifier+':'+id+' のレス (全'+total+'個)';
  }
  popup.appendChild(divHeader);
  var elmOrigin = divHeader;
  for (var i=1; i <= total; i++) {
    var e;
    if (i == count){//ポップアップ元の印
      e = document.createElement('table');
      e.innerHTML = '<tr><td>…</td><td>≪</td></tr>';
      elmOrigin = e;
    }else{
      e = createResElementByFIDC(id,i);
    }
    if (e) popup.appendChild(e);
  }
  return elmOrigin;//座標合わせ用のエレメントを返す
}
//ポップアップの位置調整
function adjustPopupPosition(elmOrigin) {
  if (!elmOrigin) return;
  var yfunc = function(){return popupPosition.y;};
  if (elmOrigin == popupElement) {
    yfunc = function(){
      var y = popupPosition.y - (elmOrigin ? elmOrigin.offsetHeight : 0);
      if (popupSource && popupSource.offsetHeight) {
	y -= popupSource.offsetHeight/2;
      } else if (popupSource) {
	//テキストノードの場合などでは高さはoffsetHeightではわからないから…
        var nn = getNodeAfter(popupSource);
	if (nn) { //次のノードの高さか(BRのように高さが0の時は決め打ち)…
	  y -= (nn.offsetHeight > 0 ? nn.offsetHeight/2 : 6);
	} else { //親のノードの高さで代用する
	  y -= popupSource.parentNode.offsetHeight/2;
	}
      }
      return y;
    };
  } else {
    //elmOrigin が popupPosition にいくように調整(中央揃え)
    yfunc = function(){return popupPosition.y - (elmOrigin ? elmOrigin.offsetTop + elmOrigin.offsetHeight/2 : 0);};
  }
  var y = yfunc();
  popupElement.setAttribute('style','visibility:hidden; top:'+y+'px;left:'+popupPosition.x+'px;');
  setTimeout( function(f){
    //レンダリング後にY座標の再調整（画面端に当たる場合にelmOriginがずれるので）
    var y = f();
    if (y) popupElement.setAttribute('style','visibility:visible; top:'+y+'px;left:'+popupPosition.x+'px;');
  }, 10, yfunc);
}


function createResElementByFIDC(id,count,optNo) {
  var tab = document.createElement('table');

  //ID検索
  var e;
  if (!optNo) {
    e = document.getElementById('gm_fidc_id'+id+'_'+count);
  } else {
    e = findValidIDCWithNo(id,optNo);
  }
  if (!e) {
    console.warn('createResElementByFIDC() failed: no res for id=%s, count=%s (%s)',id,count,optNo);
    return null;
  }

  var e_ref = getElementByTagNameInAncestors(e,'TD');
  if (e_ref){
    tab.innerHTML = '<tr><td>…</td><td>'+e_ref.innerHTML+'</td></tr>';
  } else { //スレ文
    e_ref = e.parentNode;
    tab.innerHTML = '<tr><td></td></tr>';
    var td = tab.getElementsByTagName('td')[0];
    var e_to = document.evaluate('blockquote',e_ref,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null).singleNodeValue;
    var e_from = document.evaluate('text()[.="画像ファイル名："]',e_ref,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null).singleNodeValue;
    if (!e_from) e_from = document.evaluate('input',e_ref,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null).singleNodeValue;
    if (e_to && e_from) {
      for (var i=0; i < e_ref.childNodes.length; i++) {
	if (e_from && e_ref.childNodes[i] != e_from) continue;
	e_from = null;
	td.appendChild(e_ref.childNodes[i].cloneNode(true));
	if (e_ref.childNodes[i] == e_to) break;
      }
    } else {
      td.innerHTML = '<blockquote>ERROR in createResElementByFIDC()</blockquote>';
    }
  }

  //レス文レイアウト調整＆画像サイズのスケーリング
  var ebq = document.evaluate('//blockquote',tab,null,XPathResult.FIRST_ORDERED_NODE_TYPE ,null).singleNodeValue;
  var ebq_style = 'margin: 1ex 2em;';
  var imgs = document.evaluate('//img[@height][@width]',tab,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,null);
  for (var i=0; i < imgs.snapshotLength; i++) {
    var img = imgs.snapshotItem(i);
    var h = parseInt(img.getAttribute('height'))*ID_POPUP_IMG_SCALE;
    var w = parseInt(img.getAttribute('width'))*ID_POPUP_IMG_SCALE;
    img.setAttribute('height',h);
    img.setAttribute('width', w);
    ebq_style = 'margin: 1ex 2em 1ex '+(w+40)+'px;';
  }
  ebq.setAttribute('style',ebq_style);

  //IDカウンタを疑似アンカーに変換
  var idcs = document.evaluate('//a[@class="gm_fidc_a"]',tab,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,null);
  for (var i=0; i < idcs.snapshotLength; i++) {
    var idc = idcs.snapshotItem(i);
    idc.setAttribute('class','gm_fidc_aj');
    idc.setAttribute('title','このレスにスクロール');
    idc.removeAttribute('id');
    putbackNodeInnerHTML(idc);//透明解除
    idc.addEventListener('click',jumpToThisFID,false);
  }

  return tab;
}


var textTimer;
var focusedTextNode;

function onMouseMove(ev){
  //テキストノードからポップアップした場合の消去タイマー設置(一度だけ)
  if (popupSource && popupSource.nodeType == 3) {
    clearTimeout(popupDestoroyTimer);
    popupDestoroyTimer = setTimeout(destoroyPopup, 500);
    popupSource = null;
  }

  //一つのテキストノード上に一定時間いたときにhandleTextHover()をトリガ
  var node = ev.explicitOriginalTarget; //Mozilla special
  if (node.nodeType != 3) { //3==Node.TEXT_NODE (Greasemonkey's bug?)
    clearTimeout(textTimer);
    focusedTextNode = null;
    return; 
  }
  if (focusedTextNode != node) {
    clearTimeout(textTimer);
    textTimer = setTimeout(handleTextHover, 500, node);
    focusedTextNode = node;
  }
  if (!popupSource) {
    popupPosition.x = ev.pageX;
    popupPosition.y = ev.pageY;
  }
}
function handleTextHover(node) {
  //前後の連続するテキストノードを結合
  var text = '';
  var startNode = node;
  while (startNode.previousSibling && startNode.previousSibling.nodeType == 3 ) {
    startNode = startNode.previousSibling;
  }
  var nextNode = startNode;
  while (nextNode && nextNode.nodeType == 3) {
    text += nextNode.nodeValue;
    nextNode = nextNode.nextSibling;
  }

  //対象テキストノードの場所を考慮
  var count = 0;
  if (nextNode) {
    switch (nextNode.className) {//テキストの次のノードが…
      case 'gm_fidc_a': //IDカウンタなら情報をもらう
        count = parseInt(nextNode.getAttribute('__gm_fidc_count'));
	//単発IDのときはポップアップしない
	var total = nextNode.getAttribute('__gm_fidc_total');
        if (!count || total == 1) return;
	//赤福ポップアップ内だったらカウンタの情報は白紙に
	var nextNextNode = getNodeAfter(nextNode);
	if (nextNextNode && nextNextNode.className == 'akahuku_popup_content_button') count = 0;
        break;
      case 'gm_fidc_aj'://ポップアップ内のIDカウンタ前か
      case 'del'://(内外の)delボタン前からはポップアップしない
        return;
    }
  }

  //検索
  //console.time('handleTextHover()#search');
  var reIdentifiers;
  if (identifier == 'ID') {
    reIdentifiers = [
      /\b(ID:)([A-Za-z0-9.\/]{8})(?:\s+No\.([1-9][0-9]+))?/,
      /\b(ID:)([A-Za-z0-9.\/]{7}\b)/,
      /\b()([A-Za-z0-9.\/]{7,8}\b)/,
    ];
  }else{
    reIdentifiers = [
      /\b(IP:)([-_A-Za-z0-9.*)(]+)(?:\s+No\.([1-9][0-9]+))?/,
    ];
  }
  var sign, id, no;
  for (var i=0; i < reIdentifiers.length; i++) {
    if ( reIdentifiers[i].test(text) ) {
      sign = RegExp.$1; id = RegExp.$2; no = RegExp.$3;
      if (!sign && id == parseInt(id) ) {
	sign = id = no = null;
	continue; //sign無しの数字のみはサクサク除外
      }
      //console.info('RegExp Match! 1="%s",2="%s" : in "%s"',id,no,text);
      if ( findFirstValidIDC(id) ) {
	break;//実在するIDなら検索終了
      }else if ( !no && id.length == 7 && identifier == 'ID') {
	//一文字欠けてるIDなら補完に挑戦
	var idCands = [id+'.', id+'/'];
	if (!sign) idCands.push('.'+id, '/'+id);//前への補完も試す
	for (var j=0; j < idCands.length; j++){
	  if ( findFirstValidIDC(idCands[j]) ) { id=idCands[j]; break; }
	}
	if (j < idCands.length) break; //補完成功
      }
      //console.info('%s%s(%s) is matched as %s, but is not valid. ("%s")',sign,id,no,identifier,text);
      sign = id = no = null;
    }
  }
  //console.timeEnd('handleTextHover()#search');

  if (id) {
    if ( popupElement && popupElement.getAttribute('__gm_fidc_id') == id &&
       (!no || popupElement.getAttribute('__gm_fidc_no') == no) ) {
      return; //同IDの再ポップアップは抑制
    }
    destoroyPopup();
    if ( createPopup({id:id, count:count, no:no}) ) {
      popupSource = node;
      focusedTextNode = null;//またhandleTextHover()がトリガされるように
    }else{
      console.warn('%s:%s (No.%s) matches no res.',identifier,id,no);
    }
  }

}

})();

