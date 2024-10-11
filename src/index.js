export default {
	async fetch(request, env, ctx) {
		const prefix = '/';
		const assetUrl = 'https://hunshcn.github.io/gh-proxy/';
		const url = new URL(request.url);
		let path = url.searchParams.get('q');

		if (path) {
			return Response.redirect(`https://${url.host}${prefix}${path}`, 301);
		}

		path = url.href.substring(url.origin.length + prefix.length).replace(/^https?:\/+/, 'https://');

		if (path.search(exps[1]) === 0) {
			path = path.replace('/blob/', '/raw/');
		}

		if (searchExps(path)) {
			return httpHandler(request, path);
		} else {
			return fetch(`${assetUrl}${path}`);
		}
	},
};

const exps = [
	/^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:releases|archive)\/.*$/i,
	/^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:blob|raw)\/.*$/i,
	/^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:info|git-).*$/i,
	/^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+$/i,
	/^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+$/i,
	/^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tags.*$/i,
];

function searchExps(url) {
	return exps.some((exp) => url.search(exp) === 0);
}

function httpHandler(req, pathname) {
	const reqHdrRaw = req.headers;

	if (req.method === 'OPTIONS' && reqHdrRaw.has('access-control-request-headers')) {
		return new Response(null, {
			status: 204,
			headers: new Headers({
				'access-control-allow-origin': '*',
				'access-control-allow-methods': 'GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS',
				'access-control-max-age': '1728000',
			}),
		});
	}

	const reqHdrNew = new Headers(reqHdrRaw);
	let urlStr = pathname;

	if (urlStr.search(/^https?:\/\//) !== 0) {
		urlStr = `https://${urlStr}`;
	}

	const urlObj = new URL(urlStr);
	const reqInit = {
		method: req.method,
		headers: reqHdrNew,
		redirect: 'manual',
		body: req.body,
	};

	return proxy(urlObj, reqInit);
}

async function proxy(urlObj, reqInit) {
	const res = await fetch(urlObj.href, reqInit);
	const resHdrOld = res.headers;
	const resHdrNew = new Headers(resHdrOld);
	const status = res.status;

	if (resHdrNew.has('location')) {
		let location = resHdrNew.get('location');

		if (searchExps(location)) {
			resHdrNew.set('location', `${PREFIX}${location}`);
		} else {
			reqInit.redirect = 'follow';
			return proxy(new URL(location), reqInit);
		}
	}

	resHdrNew.set('access-control-expose-headers', '*');
	resHdrNew.set('access-control-allow-origin', '*');
	resHdrNew.delete('content-security-policy');
	resHdrNew.delete('content-security-policy-report-only');
	resHdrNew.delete('clear-site-data');

	return new Response(res.body, {
		status,
		headers: resHdrNew,
	});
}
