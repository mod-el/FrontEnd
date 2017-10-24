/******************************************************************/
/***************** AJAX FUNCTIONS *****************/

function ajax(url, get, post, options){
	options = array_merge({
		'additional': [],
		'bind': true,
		'fullResponse': false,
		'onprogress': null
	}, options);

	if(typeof post==='undefined')
		post = null;

	if(window.fetch && options['onprogress']===null){
		var options = {
			credentials: 'include'
		};
		if(post){
			options['method'] = 'POST';
			options['body'] = post;
			options['headers'] = {'Content-Type' : 'application/x-www-form-urlencoded'};
		}

		return fetch(url+'?'+get, options).then(function(response){
			if(options['fullResponse'])
				return response;
			else
				return response.text();
		}).then(function(text){
			if(!options['fullResponse'])
				text = handleAjaxResponse(text);

			return text;
		});
	}else{
		return new Promise(function(resolve){
			oldAjax(resolve, url, get, post, options['additional'], options['bind'], options['onprogress']);
		});
	}
}

Element.prototype.ajax = function(url, get, post, options){
	return ajax(url, get, post, options).then((function(el){
		return function(r){
			el.innerHTML = r;
			return r;
		};
	})(this));
};

function getElementBindingsForAjax(){
	var bindings = {
		'elements': {},
		'fields': [],
		'methods': []
	};

	var elements = document.querySelectorAll('[data-bind-element]');
	for(var i in elements){
		if(!elements.hasOwnProperty(i)) continue;
		var n = elements[i].getAttribute('data-bind-element').split('-');
		if(n.length==1) continue;

		var k = 'element-'+n[0]+'-'+n[1];
		if(typeof bindings['elements'][k]=='undefined'){
			bindings['elements'][k] = {
				'type': 'element',
				'element': n[0],
				'id': n[1],
				'fields': [],
				'methods': []
			};
		}
		if(elements[i].getAttribute('data-bind-field')){
			if(typeof elements[i].getAttribute('data-bind-admin')){
				var fk = JSON.stringify({'field': elements[i].getAttribute('data-bind-field'), 'admin': elements[i].getAttribute('data-bind-admin')});
			}else{
				var fk = elements[i].getAttribute('data-bind-field');
			}
			if(!in_array(fk, bindings['elements'][k]['fields']))
				bindings['elements'][k]['fields'].push(fk);
		}else if(elements[i].getAttribute('data-bind-method')){
			if(!in_array(elements[i].getAttribute('data-bind-method'), bindings['elements'][k]['methods']))
				bindings['elements'][k]['methods'].push(elements[i].getAttribute('data-bind-method'));
		}
	}

	var elements = document.querySelectorAll('[data-bind-table]');
	for(var i in elements){
		if(!elements.hasOwnProperty(i)) continue;
		var n = elements[i].getAttribute('data-bind-table').split('-');
		if(n.length==1) continue;

		var k = 'element-'+n[0]+'-'+n[1];
		if(typeof bindings['elements'][k]=='undefined'){
			bindings['elements'][k] = {
				'type': 'table',
				'element': n[0],
				'id': n[1],
				'fields': [],
				'methods': []
			};
		}

		if(elements[i].getAttribute('data-bind-field')){
			if(!in_array(elements[i].getAttribute('data-bind-field'), bindings['elements'][k]['fields']))
				bindings['elements'][k]['fields'].push(elements[i].getAttribute('data-bind-field'));
		}
	}

	for(var k in bindings['elements']){ // Accorpo gli array di metodi e/o campi che si ripetono in un'unico oggetto che fa da cache, per risparmiare lunghezza del post, specie nell'admin
		if(!bindings['elements'].hasOwnProperty(k)) continue;

		if(bindings['elements'][k]['fields'].length>0){
			var idx = false;
			for(var i in bindings['fields']){
				if(!bindings['fields'].hasOwnProperty(i)) continue;
				if(JSON.stringify(bindings['fields'][i])==JSON.stringify(bindings['elements'][k]['fields'])){
					idx = i;
					break;
				}
			}
			if(idx===false)
				idx = bindings['fields'].push(bindings['elements'][k]['fields'])-1;

			bindings['elements'][k]['fields'] = idx;
		}
		if(bindings['elements'][k]['methods'].length>0){
			var idx = false;
			for(var i in bindings['methods']){
				if(!bindings['methods'].hasOwnProperty(i)) continue;
				if(JSON.stringify(bindings['methods'][i])==JSON.stringify(bindings['elements'][k]['methods'])){
					idx = parseInt(i);
					break;
				}
			}
			if(idx===false)
				idx = bindings['methods'].push(bindings['elements'][k]['methods'])-1;

			bindings['elements'][k]['methods'] = idx;
		}
	}

	return bindings;
}

/******************************************************************/

function getMouseCoords(event){ // Funzione che ricava le coordinate in pixel del cursore nella pagina
	if (!event) var event = window.event;
	if(typeof event.touches!='undefined')
		return {'x':event.touches.item(0).clientX,'y':event.touches.item(0).clientY};
	if(document.all){
		tempX = event.clientX + document.documentElement.scrollLeft;
		tempY = event.clientY + document.documentElement.scrollTop;
	}else{
		tempX = event.pageX;
		tempY = event.pageY;
	}
	if (tempX<0) tempX = 0;
	if (tempY<0) tempY = 0;
	return {'x':tempX,'y':tempY};
}

function getElementCoords(id){ // Funzione che ricava la posizione assoluta di un elemento all'interno della pagina
	if(typeof id=='object') var element = id;
	else var element = _(id);
	if(!element) return false;
	var elementCoords = {'x':0,'y':0};
	do{
		elementCoords['x'] += element.offsetLeft;
		elementCoords['y'] += element.offsetTop;
		element = element.offsetParent;
	}while(element);
	return elementCoords;
}

function getMouseCoordsInElement(e, element){
	var c = getMouseCoords(e);
	var c_e = getElementCoords(element);
	return {'x':c.x-c_e.x, 'y':c.y-c_e.y};
}

function makePrice(n, show_currency, decimals){ // Formatto un prezzo
	if(typeof show_currency=='undefined') show_currency = true;
	if(typeof decimals=='undefined') decimals = 2;

	var r = n.toFixed(decimals);
	if(show_currency) r += '&euro;';
	return r;
}

function in_array(needle, haystack, argStrict){ // Uguale all'"in_array" del PHP
	var key = '',
		strict = !! argStrict;

	if (strict) {
		for (key in haystack) {
			if (haystack[key] === needle) {
				return true;
			}
		}
	} else {
		for (key in haystack) {
			if (haystack[key] == needle) {
				return true;
			}
		}
	}

	return false;
}

asort = function(obj, type, rev, caseSensitive){ // Uguale all'"asort" del PHP
	var temp_array = [];
	for (var key in obj) {
		if (obj.hasOwnProperty(key)) {
			if (!caseSensitive) {
				key = (key['toLowerCase'] ? key.toLowerCase() : key);
			}
			temp_array.push(key);
		}
	}
	if (typeof type === 'function') {
		temp_array.sort(type);
	} else if (type === 'value') {
		temp_array.sort(function(a,b) {
			var x = obj[a];
			var y = obj[b];
			if (!caseSensitive) {
				x = (x['toLowerCase'] ? x.toLowerCase() : x);
				y = (y['toLowerCase'] ? y.toLowerCase() : y);
			}
			return ((x < y) ? -1 : ((x > y) ? 1 : 0));
		});
	} else {
		temp_array.sort();
	}
	if(typeof rev!='undefined' && rev) temp_array.reverse();
	var temp_obj = {};
	for (var i=0; i<temp_array.length; i++){
		temp_obj[temp_array[i]] = obj[temp_array[i]];
	}
	return temp_obj;
};

var cache_isDateSupported = null;
function isDateSupported(){
	if(cache_isDateSupported!==null)
		return cache_isDateSupported;

	var input = document.createElement('input');
	input.setAttribute('type','date');

	var notADateValue = 'not-a-date';
	input.setAttribute('value', notADateValue);

	cache_isDateSupported = (input.value !== notADateValue);
	return cache_isDateSupported;
}

/******************************************************************/
/************ FUNZIONI PER IL PRELOAD DELLE IMMAGINI *************/

function pre_addImageSet(path, n, s, ext){ // Funzione utile ad accorciare l'aggiunta di url di immagini
	if(typeof s=='undefined') s = 1;
	if(typeof ext=='undefined') ext = 'png';
	for(c=s;c<=n;c++)
		pre_imagesPaths.push(path+c+'.'+ext);
}

var pre_imagesPaths = [], pre_imageSet = {}, pre_imagesInLoading = 0, pre_nextImgN = 0; // Numero di immagini contemporaneamente in caricamento
function pre_imageLoad(){
	if(typeof pre_imagesPaths[pre_nextImgN]=='undefined') return false;
	if(pre_imagesInLoading==6) return false;
	var path = pre_imagesPaths[pre_nextImgN];
	pre_imagesInLoading++;
	pre_nextImgN++;

	pre_imageSet[path] = new Image();
	pre_imageSet[path].onload = function(){
		pre_imagesInLoading--;
		if(typeof pre_imagesPaths[pre_nextImgN]!='undefined') pre_imageLoad();
	}
	pre_imageSet[path].src = path;
	if(pre_imagesInLoading<6) pre_imageLoad();
}

/* ############ FAC SIMILE ###########
 function preloadImmagini(){
 // AGGIUNGO TUTTI GLI URL DELLE IMMAGINI CHE DEVONO ESSERE CARICATE
 for(var s in slides)
 pre_imagesPaths.push('img/sfondi-home/'+slides[s].n+'.jpg');

 pre_imageLoad(); // CARICO LA PRIMA IMMAGINE. LE ALTRE VENGONO CARICATE RICURSIVAMENTE
 }
 */

/**********************************************************************/
/* FUNZIONI PER CONTROLLARE IN TEMPO REALE LA COMPILAZIONE DI UN FORM */

function checkCampo(campo, mancanti, colora){
	if(typeof campo!='object' || campo===null){
		console.log('ZKLIBS Warning: impossibile trovare un elemento passato. (checkCampo - '+campo+')');
		return true;
	}

	if(typeof colora=='undefined') colora = true;

	if(typeof campo=='undefined'){
		var v = '';
	}else{
		var v = campo.getValue();

		if(v==null) v = '';
		if((campo.type=='select-one' || campo.type=='checkbox') && v==0 && !campo.getAttribute('data-0-is-value')) v = '';
	}

	if(v=='' && colora)
		var outline = 'solid #F00 1px';
	else
		var outline = '';

	if(typeof campo!='undefined'){
		if(typeof campo=='object' && campo[0] && campo[0].type=='radio'){
			for(var i=0, length=campo.length; i<length; i++)
				campo[i].style.outline = outline;
		}else if(campo.type=='hidden' && campo.getAttribute('data-zkra')){
			var temp = ricerca_assistita_findMainTextInput(campo.getAttribute('data-zkra'));
			if(temp){
				campo = temp;
				campo.style.outline = outline;
			}
		}else
			campo.style.outline = outline;
	}

	if(v==''){
		console.log('Manca '+campo.name+'.');
		if(!mancanti && typeof campo.focus!='undefined')
			campo.focus();
		mancanti.push(campo.name);
	}
	return mancanti;
}

function checkForm(form, obb){
	var mancanti = [];
	for(var n in obb){
		if(typeof obb[n]=='object'){
			var almeno_uno = false;
			for(var nn in obb[n]){
				var campo = form[obb[n][nn]];
				if(!checkCampo(campo, false, false))
					almeno_uno = true;
			}
			if(!almeno_uno){
				mancanti.push(n);
				for(var nn in obb[n])
					form[obb[n][nn]].style.outline = 'solid #F00 1px';
			}else{
				for(var nn in obb[n])
					form[obb[n][nn]].style.outline = '';
			}
		}else{
			var campo = form[obb[n]];
			mancanti = checkCampo(campo, mancanti);
		}
	}
	if(mancanti.length>0){
		alert("Non hai compilato dei campi obbligatori!\n"+mancanti.join("\n"));
		return false;
	}else{
		return true;
	}
}

function splitScripts(text) {
	var scripts = '';
	var cleaned = text.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, function(){
		scripts += arguments[1] + '\n';
		return '';
	});
	return {'html':cleaned, 'js':scripts};
}

Element.prototype.jsFill = function(text){
	var split = splitScripts(text);
	this.innerHTML = split.html;
	eval(split.js);
}

function simulateTab(current, forward){ // forward = true se voglio andare avanti, false se voglio andare indietro
	if(typeof current.form=='undefined' || !current.form)
		return false;
	if(typeof forward=='undefined')
		forward = true;

	var next = false;
	if(forward){
		var start = 0;
		var end = current.form.elements.length;
		var step = 1;
	}else{
		var start = current.form.elements.length;
		var end = 0;
		var step = -1;
	}
	for(i = start; i*step < end*step; i += step){
		if(next && !current.form.elements[i].readOnly && !current.form.elements[i].disabled && !in_array(current.form.elements[i].type, ['hidden'])){
			current.form.elements[i].focus();
			if (current.form.elements[i].type == "text" || current.form.elements[i].type == "number"){
				current.form.elements[i].select();
			}
			return true;
		}
		if(current.form.elements[i] == current)
			next = true;
	}
	return false;
}

function nextField(current){ // Retrocompatibilit�
	return simulateTab(current, true);
}

function array_merge(obj1, obj2){
	var obj3 = {};
	for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
	for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
	return obj3;
}

function _(id){
	if(typeof id=='object')
		return false;

	var el = document.getElementById(id);
	if(el)
		return el;
	el = document.querySelector(id);
	if(el)
		return el;
	return false;
}

Element.prototype.hasClass = function(name){
	return new RegExp('(\\s|^)' + name + '(\\s|$)').test(this.className);
}

Element.prototype.removeClass = function(name){
	var classi = this.className.split(' ');
	var nuove = [];
	for(var i in classi){
		if(classi[i]!=name)
			nuove.push(classi[i]);
	}
	this.className = nuove.join(' ');
}

Element.prototype.addClass = function(name){
	var classi = this.className.split(' ');
	for(var i in classi){
		if(classi[i]==name) return;
	}
	this.className = this.className+' '+name;
}

Element.prototype.loading = function(){
	this.innerHTML = '<img src="'+base_path+'model/Output/files/loading.gif" alt="" class="loading-gif" />';
	return this;
}

function setCookie(name,value,days) {
	var expires = "";
	if (days) {
		var date = new Date();
		date.setTime(date.getTime() + (days*24*60*60*1000));
		expires = "; expires=" + date.toUTCString();
	}
	document.cookie = name + "=" + value + expires + "; path=/";
}

function getCookie(name) {
	var nameEQ = name + "=";
	var ca = document.cookie.split(';');
	for(var i=0;i < ca.length;i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') c = c.substring(1,c.length);
		if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
	}
	return null;
}

function deleteCookie(name) {
	setCookie(name,"",-1);
}

/**************************** BACKWARD COMPATIBILITY **************************/

var infoDebugJSON = [];
var myRequest = new Array();

function CreateXmlHttpReq(n, handler, campi_addizionali){
	var xmlhttp = false;
	try{
		xmlhttp = new XMLHttpRequest();
	}catch(e){
		try{
			xmlhttp = new ActiveXObject("Msxml2.XMLHTTP");
		}catch(e){
			xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
		}
	}
	xmlhttp.onreadystatechange = function(){
		if (myRequest[n].readyState==4){
			if(handler!=false){
				var r = handleAjaxResponse(myRequest[n].responseText);

				if(myRequest[n].status===200) handler.call(myRequest[n], r, campi_addizionali);
				else handler.call(myRequest[n], false, campi_addizionali);
			}
			delete myRequest[n];
		}
	}
	return xmlhttp;
}

function oldAjax(handler, indirizzo, parametri_get, parametri_post, campi_addizionali, bindings, onprogress){
	if(typeof campi_addizionali==='undefined' || campi_addizionali==='')
		campi_addizionali = [];

	var r = Math.random();
	n = 0; while(myRequest[n]) n++;
	myRequest[n] = CreateXmlHttpReq(n, handler, campi_addizionali);
	myRequest[n].open('POST', indirizzo+'?zkrand='+r+'&'+parametri_get);
	myRequest[n].setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

	if(onprogress){
		myRequest[n].onprogress = onprogress;
	}

	if(typeof parametri_post=='undefined')
		parametri_post = '';
	if(parametri_post!='')
		parametri_post += '&';

	if(typeof bindings=='undefined')
		bindings = true;

	if(bindings)
		parametri_post += 'zkbindings='+encodeURIComponent(JSON.stringify(getElementBindingsForAjax()));

	myRequest[n].send(parametri_post);

	return n;
}

function ajaxAbort(n){
	if(typeof n=='undefined'){
		for(var i in myRequest){
			if(typeof myRequest[i]=='object')
				myRequest[i].abort();
		}
	}else{
		if(typeof myRequest[n]=='object')
			myRequest[n].abort();
	}
}

function handleAjaxResponse(text){
	try{
		var r = JSON.parse(text);

		if(typeof r.ZKDEBUG!='undefined'){
			infoDebugJSON.push(r.ZKDEBUG);
		}
		if(typeof r.ZKBINDINGS!='undefined'){
			for(var i in r.ZKBINDINGS){
				if(!r.ZKBINDINGS.hasOwnProperty(i)) continue;
				var b = r.ZKBINDINGS[i];
				switch(b['type']){
					case 'element':
						if(typeof b['field']!='undefined'){
							var elements = document.querySelectorAll('[data-bind-element="'+b['element']+'-'+b['id']+'"][data-bind-field="'+b['field']+'"]');
						}else if(typeof b['method']!='undefined'){
							var elements = document.querySelectorAll('[data-bind-element="'+b['element']+'-'+b['id']+'"][data-bind-method="'+b['method']+'"]');
						}
						break;
					case 'table':
						var elements = document.querySelectorAll('[data-bind-table="'+b['table']+'-'+b['id']+'"][data-bind-field="'+b['field']+'"]');
						break;
				}
				for(var il in elements){
					if(!elements.hasOwnProperty(il)) continue;
					var elemType = elements[il].nodeName.toLowerCase();
					if(elemType=='input' || elemType=='textarea' || elemType=='select' || elemType=='radio'){
						elements[il].setValue(b['v'], false);
					}else{
						elements[il].innerHTML = b['v'];
					}
				}
			}
		}
		if(typeof r.ZKDATA!='undefined'){
			r = r.ZKDATA;
		}
	}catch(e){
		var r = text;
	}

	return r;
}