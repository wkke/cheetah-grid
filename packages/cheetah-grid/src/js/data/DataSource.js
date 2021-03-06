'use strict';
{
	const {array, isDef, isPromise, getOrApply, applyChainSafe, emptyFn} = require('../internal/utils');
	const sort = require('../internal/sort');
	const EventTarget = require('../core/EventTarget');

	const EVENT_TYPE = {
		UPDATE_LENGTH: 'update_length',
		UPDATED_LENGTH: 'updated_length',
		UPDATED_ORDER: 'updated_order',
	};

	function getValue(value, setPromiseBack) {
		value = getOrApply(value);
		if (isPromise(value)) {
			value = value.then((r) => {
				if (!isPromise(r)) {
					setPromiseBack(r);
				}
				return getValue(r, setPromiseBack);
			});
			//一時的にキャッシュ
			setPromiseBack(value);
		}
		return value;
	}

	function getField(record, field, setPromiseBack) {
		if (!isDef(record)) {
			return undefined;
		}
		if (isPromise(record)) {
			return record.then((r) => getField(r, field, setPromiseBack));
		}
		if (field in record) {
			return getValue(record[field], setPromiseBack);
		}
		if (typeof field === 'function') {
			return getValue(field(record), setPromiseBack);
		}

		const ss = (`${field}`).split('.');
		if (ss.length <= 1) {
			return getValue(record[field], setPromiseBack);
		}
		return getValue(applyChainSafe(record, (val, name) => getField(val, name, emptyFn), ...ss), setPromiseBack);
	}
	function setField(record, field, value) {
		if (field in record) {
			record[field] = value;
		} else if (typeof field === 'function') {
			return field(record, value);
		} else if (typeof field === 'string') {
			const ss = (`${field}`).split('.');
			let obj = record;
			const {length} = ss;
			for (let i = 0; i < length; i++) {
				const f = ss[i];
				if (i === length - 1) {
					obj[f] = value;
				} else {
					obj = obj[f] || (obj[f] = {});
				}
			}
		} else {
			record[field] = value;
		}
		return true;
	}
	function _getIndex(dataSource, index) {
		if (!dataSource._sortedIndexMap) {
			return index;
		}
		const mapIndex = dataSource._sortedIndexMap[index];
		return isDef(mapIndex) ? mapIndex : index;
	}

	/**
	 * grid data source
	 *
	 * @classdesc cheetahGrid.data.DataSource
	 * @extends EventTarget
	 * @memberof cheetahGrid.data
	 */
	class DataSource extends EventTarget {
		static get EVENT_TYPE() {
			return EVENT_TYPE;
		}
		static ofArray(array) {
			return new DataSource({
				get: (index) => array[index],
				length: array.length
			});
		}
		constructor(obj = {}) {
			super();
			this._get = obj.get && obj.get.bind(obj) || undefined;
			this._length = obj.length || 0;
			this._sortedIndexMap = false;
		}
		get(index) {
			return this.getOriginal(_getIndex(this, index));
		}
		getField(index, field) {
			return this.getOriginalField(_getIndex(this, index), field);
		}
		hasField(index, field) {
			return this.hasOriginalField(_getIndex(this, index), field);
		}
		setField(index, field, value) {
			return this.setOriginalField(_getIndex(this, index), field, value);
		}
		sort(field, order) {
			const sortedIndexMap = new Array(this._length);

			const orderFn = order !== 'desc'
				? (v1, v2) => v1 === v2 ? 0 : v1 > v2 ? 1 : -1
				: (v1, v2) => v1 === v2 ? 0 : v1 < v2 ? 1 : -1;

			return sort.sortPromise(
					(index) => isDef(sortedIndexMap[index])
						? sortedIndexMap[index]
						: (sortedIndexMap[index] = index),
					(index, rel) => {
						sortedIndexMap[index] = rel;
					},
					this._length,
					orderFn,
					(index) => this.getOriginalField(index, field)
			).then(() => {
				this._sortedIndexMap = sortedIndexMap;
				this.fireListeners(EVENT_TYPE.UPDATED_ORDER);
			});
		}
		get length() {
			return this._length;
		}
		set length(length) {
			if (this._length === length) {
				return;
			}

			const results = this.fireListeners(EVENT_TYPE.UPDATE_LENGTH, length);
			if (array.findIndex(results, (v) => !v) >= 0) {
				return;
			}
			this._length = length;
			this.fireListeners(EVENT_TYPE.UPDATED_LENGTH, this._length);
		}
		dispose() {
			super.dispose();
		}
		getOriginal(index) {
			return getValue(this._get(index), (val) => {
				this.recordPromiseCallBackInternal(index, val);
			});
		}
		getOriginalField(index, field) {
			if (!isDef(field)) {
				return undefined;
			}
			const record = this.getOriginal(index);
			return getField(record, field, (val) => {
				this.fieldPromiseCallBackInternal(index, field, val);
			});
		}
		hasOriginalField(index, field) {
			if (!isDef(field)) {
				return false;
			}
			if (typeof field === 'function') {
				return true;
			}
			const record = this.getOriginal(index);
			return field in record;
		}
		setOriginalField(index, field, value) {
			if (!isDef(field)) {
				return undefined;
			}
			const record = this.getOriginal(index);
			return setField(record, field, value);
		}
		fieldPromiseCallBackInternal(index, field, val) {
			//
		}
		recordPromiseCallBackInternal(index, val) {
			//
		}
	}
	DataSource.EMPTY = new DataSource({
		length: 0,
	});

	module.exports = DataSource;
}