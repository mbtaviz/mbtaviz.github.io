/**
 * dataloader.js
 *
 * Copyright 2014 Michael Barry & Brian Card.  MIT open-source lincense.
 *
 * A thin layer sitting on top of d3.json and d3.csv that handles asynchronous loading
 * of multiple data files, progress reporting, and error hanldling.  File size and hashes
 * must exist in files.js (created by tools/update-file-sizes.js) in order to load a file.
 *
 * Usage:
 * VIZ.requiresData(['json!file.json', 'csv!file.csv'])
 * .progress(function (percent) { ... })
 * .done(function (jsonFile, csvFile) { ... });
 */

(function () {
  "use strict";

  function Listener(files, changesPageSize) {
    var self = this;
    self.files = files;
    self.changesPageSize = changesPageSize;
    this.data = {};
    self.progressListeners = [];
    self.doneListeners = [];
    self.errorListeners = [];
    self.amountLoaded = {};
    files.forEach(function (file) {
      if (file in self.amountLoaded) {
        throw "duplicate file name " + file;
      }
      self.amountLoaded[file] = 0;
    });
    self.totalSize = files.reduce(function (a, file) {
      var name = file.split('!')[1];
      if (!VIZ.fileSizes[name]) {
        throw "No size for " + name;
      }
      return a + VIZ.fileSizes[name];
    }, 0);
    files.forEach(function (file) {
      var parts = file.split('!');
      var type = parts[0];
      var name = parts[1];
      d3[type](name + '?nocache=' + VIZ.fileHashes[name])
      .on('progress', function() {
        self.fileProgress(file, d3.event.loaded);
      })
      .get(function(error, data) {
        if (error) {
          self.errorListeners.forEach(function (listener) { listener(error); });
          self.doneListeners = [];
          self.progressListeners = [];
        } else {
          self.fileProgress(file, VIZ.fileSizes[name]);
          self.fileDone(file, data);
        }
      });
    });
  }

  Listener.prototype.progress = function (callback) {
    this.progressListeners.push(callback);
    return this;
  };

  Listener.prototype.done = function (callback) {
    this.doneListeners.push(callback);
    return this;
  };

  Listener.prototype.onerror = function (callback) {
    this.errorListeners.push(callback);
    return this;
  };

  Listener.prototype.fileProgress = function (file, amountLoaded) {
    var self = this;
    this.amountLoaded[file] = amountLoaded;
    this.progressListeners.forEach(function (listener) {
      listener(Math.round(100 * d3.sum(d3.values(self.amountLoaded)) / self.totalSize));
    });
  };

  Listener.prototype.fileDone = function (file, data) {
    var self = this;
    this.data[file] = data;
    if (d3.keys(this.data).length === this.files.length) {
      var results = this.files.map(function (file) {
        return self.data[file];
      });
      this.doneListeners.forEach(function (listener) {
        listener.apply(self, results);
      });
      if (self.changesPageSize) {
        VIZ.anchorScroll();
      }
    }
  };

  VIZ.requiresData = function (files, changesPageSize) {
    var listener = new Listener(files, changesPageSize);
    return listener;
  };
}());