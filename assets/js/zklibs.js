/******************************************************************/
/***************** AJAX FUNCTIONS *****************/

function ajax(url, get, post, options) {
	options = array_merge({
		'additional': [],
		'bind': true,
		'fullResponse': false,
		'onprogress': null,
		'method': null,
		'json': false,
		'headers': {}
	}, options);

	if (typeof get === 'undefined')
		get = '';
	if (typeof post === 'undefined')
		post = '';

	if (typeof get === 'object')
		get = queryStringFromObject(get);

	if (typeof post === 'object') {
		if (options['json']) {
			if (Object.keys(post).length > 0)
				post = JSON.stringify(post);
			else
				post = null;
		} else {
			post = queryStringFromObject(post);
		}
	}

	if (window.fetch && options['onprogress'] === null) {
		var fetchOptions = {
			'credentials': 'include'
		};
		if (post) {
			if (options['method'] === null)
				options['method'] = 'POST';

			fetchOptions['body'] = post;
			if (options['json'])
				options['headers']['Content-Type'] = 'application/json';
			else
				options['headers']['Content-Type'] = 'application/x-www-form-urlencoded';
		}

		if (options['method'])
			fetchOptions['method'] = options['method'];
		fetchOptions['headers'] = options['headers'];

		return fetch(url + '?' + get, fetchOptions).then(function (response) {
			if (options['fullResponse'])
				return response;
			else
				return response.text();
		}).then(function (text) {
			if (!options['fullResponse'])
				text = handleAjaxResponse(text);

			return text;
		});
	} else {
		return new Promise(function (resolve) {
			oldAjax(resolve, url, get, post, options['additional'], options['bind'], options['onprogress']);
		});
	}
}

function queryStringFromObject(obj) {
	var string = [];
	for (var k in obj) {
		string.push(k + '=' + encodeURIComponent(obj[k]));
	}
	return string.join('&');
}

function objectFromQueryString(string) {
	if (typeof string === 'undefined')
		string = location.search.substring(1);
	if (string === '')
		return {};

	return string.split('&').reduce(function (prev, curr, i, arr) {
		var p = curr.split('=');
		if (p.length === 1)
			prev[decodeURIComponent(p[0])] = '';
		else
			prev[decodeURIComponent(p[0])] = decodeURIComponent(p[1]).replace('+', ' ');
		return prev;
	}, {});
}

Element.prototype.ajax = function (url, get, post, options) {
	return ajax(url, get, post, options).then((function (el) {
		return function (r) {
			el.jsFill(r);
			return r;
		};
	})(this)).then(function (r) {
		return changedHtml().then(function () {
			return r;
		});
	});
};

function getElementBindingsForAjax() {
	var bindings = {
		'elements': {},
		'fields': [],
		'methods': []
	};

	var elements = document.querySelectorAll('[data-bind-element]');
	for (var i in elements) {
		if (!elements.hasOwnProperty(i)) continue;
		var n = elements[i].getAttribute('data-bind-element').split('-');
		if (n.length == 1) continue;

		var k = 'element-' + n[0] + '-' + n[1];
		if (typeof bindings['elements'][k] == 'undefined') {
			bindings['elements'][k] = {
				'type': 'element',
				'element': n[0],
				'id': n[1],
				'fields': [],
				'methods': []
			};
		}
		if (elements[i].getAttribute('data-bind-field')) {
			if (typeof elements[i].getAttribute('data-bind-admin')) {
				var fk = JSON.stringify({
					'field': elements[i].getAttribute('data-bind-field'),
					'admin': elements[i].getAttribute('data-bind-admin')
				});
			} else {
				var fk = elements[i].getAttribute('data-bind-field');
			}
			if (!in_array(fk, bindings['elements'][k]['fields']))
				bindings['elements'][k]['fields'].push(fk);
		} else if (elements[i].getAttribute('data-bind-method')) {
			if (!in_array(elements[i].getAttribute('data-bind-method'), bindings['elements'][k]['methods']))
				bindings['elements'][k]['methods'].push(elements[i].getAttribute('data-bind-method'));
		}
	}

	var elements = document.querySelectorAll('[data-bind-table]');
	for (var i in elements) {
		if (!elements.hasOwnProperty(i)) continue;
		var n = elements[i].getAttribute('data-bind-table').split('-');
		if (n.length == 1) continue;

		var k = 'element-' + n[0] + '-' + n[1];
		if (typeof bindings['elements'][k] == 'undefined') {
			bindings['elements'][k] = {
				'type': 'table',
				'element': n[0],
				'id': n[1],
				'fields': [],
				'methods': []
			};
		}

		if (elements[i].getAttribute('data-bind-field')) {
			if (!in_array(elements[i].getAttribute('data-bind-field'), bindings['elements'][k]['fields']))
				bindings['elements'][k]['fields'].push(elements[i].getAttribute('data-bind-field'));
		}
	}

	for (var k in bindings['elements']) { // Accorpo gli array di metodi e/o campi che si ripetono in un'unico oggetto che fa da cache, per risparmiare lunghezza del post, specie nell'admin
		if (!bindings['elements'].hasOwnProperty(k)) continue;

		if (bindings['elements'][k]['fields'].length > 0) {
			var idx = false;
			for (var i in bindings['fields']) {
				if (!bindings['fields'].hasOwnProperty(i)) continue;
				if (JSON.stringify(bindings['fields'][i]) == JSON.stringify(bindings['elements'][k]['fields'])) {
					idx = i;
					break;
				}
			}
			if (idx === false)
				idx = bindings['fields'].push(bindings['elements'][k]['fields']) - 1;

			bindings['elements'][k]['fields'] = idx;
		}
		if (bindings['elements'][k]['methods'].length > 0) {
			var idx = false;
			for (var i in bindings['methods']) {
				if (!bindings['methods'].hasOwnProperty(i)) continue;
				if (JSON.stringify(bindings['methods'][i]) == JSON.stringify(bindings['elements'][k]['methods'])) {
					idx = parseInt(i);
					break;
				}
			}
			if (idx === false)
				idx = bindings['methods'].push(bindings['elements'][k]['methods']) - 1;

			bindings['elements'][k]['methods'] = idx;
		}
	}

	return bindings;
}

/******************************************************************/

function getMouseCoords(event) { // Cursor coords in page
	if (!event)
		event = window.event;
	if (typeof event.touches != 'undefined')
		return {'x': event.touches.item(0).clientX, 'y': event.touches.item(0).clientY};
	if (document.all) {
		tempX = event.clientX + document.documentElement.scrollLeft;
		tempY = event.clientY + document.documentElement.scrollTop;
	} else {
		tempX = event.pageX;
		tempY = event.pageY;
	}
	if (tempX < 0) tempX = 0;
	if (tempY < 0) tempY = 0;
	return {'x': tempX, 'y': tempY};
}

// Absolute position of element in page
function getElementCoords(id) {
	let element;
	if (typeof id === 'object')
		element = id;
	else
		element = _(id);
	if (!element)
		return false;

	let rect = element.getBoundingClientRect();
	return {
		x: rect.left + window.scrollX,
		y: rect.top + window.scrollY
	};
}

function getMouseCoordsInElement(e, element) {
	let c = getMouseCoords(e);
	let c_e = getElementCoords(element);
	return {'x': c.x - c_e.x, 'y': c.y - c_e.y};
}

Element.prototype.getCoords = function () {
	return getElementCoords(this);
};

Element.prototype.getMouseCoords = function (e) {
	return getMouseCoordsInElement(e, this);
};

function makePrice(n, options, decimals) {
	if (typeof options === 'undefined') {
		options = {
			'show_currency': true,
			'decimal_separator': ',',
			'thousands_separator': '.',
			'decimals': 2
		};
	} else if (typeof options !== 'object') { // Backward compatibility
		options = {
			'show_currency': options,
			'decimal_separator': ',',
			'thousands_separator': '.',
			'decimals': 2
		};
	}
	if (typeof decimals !== 'undefined') // Backward compatibility
		options['decimals'] = decimals;

	let r = parseFloat(n).toFixed(options['decimals']).toString().replace('.', options['decimal_separator']).replace(/\B(?=(\d{3})+(?!\d))/g, options['thousands_separator']);
	if (options['show_currency'])
		r += '&euro;';

	return r;
}

function in_array(needle, haystack, argStrict) { // Uguale all'"in_array" del PHP
	var key = '',
		strict = !!argStrict;

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

asort = function (obj, type, rev, caseSensitive) { // Uguale all'"asort" del PHP
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
		temp_array.sort(function (a, b) {
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
	if (typeof rev != 'undefined' && rev) temp_array.reverse();
	var temp_obj = {};
	for (var i = 0; i < temp_array.length; i++) {
		temp_obj[temp_array[i]] = obj[temp_array[i]];
	}
	return temp_obj;
};

var cache_isDateSupported = null;

function isDateSupported() {
	if (cache_isDateSupported !== null)
		return cache_isDateSupported;

	var input = document.createElement('input');
	input.setAttribute('type', 'date');

	var notADateValue = 'not-a-date';
	input.setAttribute('value', notADateValue);

	cache_isDateSupported = (input.value !== notADateValue);
	return cache_isDateSupported;
}

/******************************************************************/
/************ FUNZIONI PER IL PRELOAD DELLE IMMAGINI *************/

function pre_addImageSet(path, n, s, ext) { // Funzione utile ad accorciare l'aggiunta di url di immagini
	if (typeof s == 'undefined') s = 1;
	if (typeof ext == 'undefined') ext = 'png';
	for (c = s; c <= n; c++)
		pre_imagesPaths.push(path + c + '.' + ext);
}

var pre_imagesPaths = [], pre_imageSet = {}, pre_imagesInLoading = 0, pre_nextImgN = 0; // Numero di immagini contemporaneamente in caricamento
function pre_imageLoad() {
	if (typeof pre_imagesPaths[pre_nextImgN] == 'undefined') return false;
	if (pre_imagesInLoading == 6) return false;
	var path = pre_imagesPaths[pre_nextImgN];
	pre_imagesInLoading++;
	pre_nextImgN++;

	pre_imageSet[path] = new Image();
	pre_imageSet[path].onload = function () {
		pre_imagesInLoading--;
		if (typeof pre_imagesPaths[pre_nextImgN] != 'undefined') pre_imageLoad();
	}
	pre_imageSet[path].src = path;
	if (pre_imagesInLoading < 6) pre_imageLoad();
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

function splitScripts(text) {
	var scripts = '';
	var cleaned = text.toString().replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, function () {
		scripts += arguments[1] + '\n';
		return '';
	});
	return {'html': cleaned, 'js': scripts};
}

Element.prototype.jsFill = function (text) {
	var split = splitScripts(text);
	this.innerHTML = split.html;
	eval(split.js);
}

function array_merge(obj1, obj2) {
	var obj3 = {};
	for (var attrname in obj1) {
		obj3[attrname] = obj1[attrname];
	}
	for (var attrname in obj2) {
		obj3[attrname] = obj2[attrname];
	}
	return obj3;
}

function _(id) {
	if (typeof id == 'object')
		return false;

	var el = document.getElementById(id);
	if (el)
		return el;
	el = document.querySelector(id);
	if (el)
		return el;
	return false;
}

Element.prototype.hasClass = function (name) {
	return new RegExp('(\\s|^)' + escapeRegExp(name) + '(\\s|$)').test(this.className);
}

Element.prototype.removeClass = function (name) {
	let existingClasses = this.className.split(' ');
	let classesToRemove = name.split(' ').map(c => c.trim());
	let newClasses = [];
	for (let existingClass of existingClasses) {
		if (!classesToRemove.includes(existingClass.trim()))
			newClasses.push(existingClass.trim());
	}

	this.className = newClasses.join(' ');

	return this;
}

Element.prototype.addClass = function (name) {
	let existingClasses = this.className.split(' ');
	for (let classToAdd of name.split(' ')) {
		if (!existingClasses.includes(classToAdd.trim()))
			existingClasses.push(classToAdd.trim());
	}

	this.className = existingClasses.join(' ');

	return this;
}

Element.prototype.toggleClass = function (name) {
	if (this.hasClass(name))
		this.removeClass(name);
	else
		this.addClass(name);

	return this;
}

Element.prototype.loading = function () {
	this.innerHTML = '<img src="' + PATHBASE + 'model/Output/files/loading.gif" alt="" class="loading-gif" />';
	return this;
}

function escapeRegExp(str) {
	return (str + '').replace(/([\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:])/g, "\\$1");
}

function setCookie(name, value, days, path) {
	var expires = "";
	if (days) {
		var date = new Date();
		date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
		expires = "; expires=" + date.toUTCString();
	}
	if (typeof path === 'undefined')
		path = PATHBASE;
	document.cookie = name + "=" + value + expires + "; path=" + path;
}

function getCookie(name) {
	var nameEQ = name + "=";
	var ca = document.cookie.split(';');
	for (var i = 0; i < ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0) === ' ') c = c.substring(1, c.length);
		if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
	}
	return null;
}

function deleteCookie(name, path) {
	setCookie(name, '', -1, path);
}

var changedHtmlCallbacks = [];

function onHtmlChange(func) {
	changedHtmlCallbacks.push(func);
	return func.call(window);
}

function changedHtml() {
	var promises = [];
	changedHtmlCallbacks.forEach(function (func) {
		promises.push(func.call(window));
	});
	return Promise.all(promises);
}

/**************************** BACKWARD COMPATIBILITY **************************/

var infoDebugJSON = [];
var myRequest = new Array();

function CreateXmlHttpReq(n, handler, campi_addizionali) {
	var xmlhttp = false;
	try {
		xmlhttp = new XMLHttpRequest();
	} catch (e) {
		try {
			xmlhttp = new ActiveXObject("Msxml2.XMLHTTP");
		} catch (e) {
			xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
		}
	}
	xmlhttp.onreadystatechange = function () {
		if (myRequest[n].readyState == 4) {
			if (handler != false) {
				var r = handleAjaxResponse(myRequest[n].responseText);

				if (myRequest[n].status === 200) handler.call(myRequest[n], r, campi_addizionali);
				else handler.call(myRequest[n], false, campi_addizionali);
			}
			delete myRequest[n];
		}
	}
	return xmlhttp;
}

function oldAjax(handler, indirizzo, parametri_get, parametri_post, campi_addizionali, bindings, onprogress) {
	if (typeof campi_addizionali === 'undefined' || campi_addizionali === '')
		campi_addizionali = [];

	var r = Math.random();
	n = 0;
	while (myRequest[n]) n++;
	myRequest[n] = CreateXmlHttpReq(n, handler, campi_addizionali);
	myRequest[n].open('POST', indirizzo + '?zkrand=' + r + '&' + parametri_get);
	myRequest[n].setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

	if (onprogress)
		myRequest[n].upload.addEventListener('progress', onprogress);

	if (typeof parametri_post === 'undefined')
		parametri_post = '';
	if (parametri_post != '')
		parametri_post += '&';

	if (typeof bindings === 'undefined')
		bindings = true;

	if (bindings)
		parametri_post += 'zkbindings=' + encodeURIComponent(JSON.stringify(getElementBindingsForAjax()));

	myRequest[n].send(parametri_post);

	return n;
}

function ajaxAbort(n) {
	if (typeof n == 'undefined') {
		for (var i in myRequest) {
			if (typeof myRequest[i] == 'object')
				myRequest[i].abort();
		}
	} else {
		if (typeof myRequest[n] == 'object')
			myRequest[n].abort();
	}
}

function handleAjaxResponse(text) {
	try {
		var r = JSON.parse(text);

		if (typeof r.ZKDEBUG != 'undefined') {
			infoDebugJSON.push(r.ZKDEBUG);
		}
		if (typeof r.ZKBINDINGS != 'undefined') {
			for (var i in r.ZKBINDINGS) {
				if (!r.ZKBINDINGS.hasOwnProperty(i)) continue;
				var b = r.ZKBINDINGS[i];
				switch (b['type']) {
					case 'element':
						if (typeof b['field'] != 'undefined') {
							var elements = document.querySelectorAll('[data-bind-element="' + b['element'] + '-' + b['id'] + '"][data-bind-field="' + b['field'] + '"]');
						} else if (typeof b['method'] != 'undefined') {
							var elements = document.querySelectorAll('[data-bind-element="' + b['element'] + '-' + b['id'] + '"][data-bind-method="' + b['method'] + '"]');
						}
						break;
					case 'table':
						var elements = document.querySelectorAll('[data-bind-table="' + b['table'] + '-' + b['id'] + '"][data-bind-field="' + b['field'] + '"]');
						break;
				}
				for (var il in elements) {
					if (!elements.hasOwnProperty(il)) continue;
					var elemType = elements[il].nodeName.toLowerCase();
					if (elemType == 'input' || elemType == 'textarea' || elemType == 'select' || elemType == 'radio') {
						elements[il].setValue(b['v'], false);
					} else {
						elements[il].innerHTML = b['v'];
					}
				}
			}
		}
		if (typeof r.ZKDATA != 'undefined') {
			r = r.ZKDATA;
		}
	} catch (e) {
		var r = text;
	}

	return r;
}

function entities(str) {
	if (str === null || str === undefined)
		str = '';

	return str.toString().replace(/[\u00A0-\u9999<>\&]/gim, function (i) {
		return '&#' + i.charCodeAt(0) + ';';
	});
}
