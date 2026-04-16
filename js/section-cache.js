'use strict';

(function () {
    var CACHE_KEY = 'vd:sectionCache:v1';
    var MAX_ENTRIES = 20;
    var entries = new Map();

    function trimToLimit() {
        while (entries.size > MAX_ENTRIES) {
            var firstKey = entries.keys().next().value;
            if (!firstKey) break;
            entries.delete(firstKey);
        }
    }

    function flush() {
        try {
            var payload = {};
            entries.forEach(function (value, key) {
                payload[key] = value;
            });
            window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
        } catch (err) {
            // Ignore storage quota or serialization failures.
        }
    }

    function touch(key) {
        if (!entries.has(key)) return;
        var value = entries.get(key);
        entries.delete(key);
        entries.set(key, value);
    }

    function loadFromStorage() {
        try {
            var raw = window.sessionStorage.getItem(CACHE_KEY);
            if (!raw) return;
            var parsed = JSON.parse(raw);
            Object.keys(parsed).forEach(function (key) {
                if (typeof parsed[key] === 'string') {
                    entries.set(key, parsed[key]);
                }
            });
            trimToLimit();
        } catch (err) {
            // Ignore malformed data and continue with memory-only cache.
        }
    }

    loadFromStorage();

    window.VanduoSectionCache = {
        has: function (key) {
            return entries.has(key);
        },
        get: function (key) {
            if (!entries.has(key)) return null;
            touch(key);
            return entries.get(key) || null;
        },
        set: function (key, html) {
            if (!key || typeof html !== 'string') return;
            entries.set(key, html);
            trimToLimit();
            flush();
        },
        clear: function () {
            entries.clear();
            try {
                window.sessionStorage.removeItem(CACHE_KEY);
            } catch (err) {
                // Ignore storage failures.
            }
        }
    };
})();
