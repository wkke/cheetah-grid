/*eslint-disable no-sync*/
'use strict';

const fs = require('fs');
const loaderUtils = require('loader-utils');
const fontSvgToIcons = require('../tools/src/font-svg-to-cheetahgrid-icons');


const loader = function(source) {
	const {resource} = this;
	const params = loaderUtils.parseQuery(this.resourceQuery || '?') || {};
	params.resource = resource;
	return `module.exports = ${fontSvgToIcons.sourceToIconsJsObject(source, params)};`;
};

loader.directLoad = function(resource) {
	const resourceQuery = resource.indexOf('?') >= 0 ? resource.substr(resource.indexOf('?')) : undefined;
	const resourcePath = resource.indexOf('?') >= 0 ? resource.substr(0, resource.indexOf('?')) : resource;
	const context = {
		resource,
		resourceQuery,
		resourcePath,
	};
	const code = fs.readFileSync(require.resolve(resourcePath), 'utf-8');
	return loader.call(context, code);
};

module.exports = loader;