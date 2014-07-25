/**
 * common.js
 *
 * Copyright 2014 Michael Barry & Brian Card.  MIT open-source lincense.
 *
 * Common utilities for all visualizations
 */

(function () {
  "use strict";

  var IGNORE_SCROLL_EVENTS = false;
  var SCROLLED_ONCE = false;

  // detect whether this is iphone/ipad since they do things funny
  var ios = /iPad|iPod|iPhone/.test(navigator.userAgent);
  d3.select('html').classed('ios', ios);

  // if mbtaviz.github.io/?show-voronoi - then add show-voronoi class to document
  var search = window.location.search && window.location.search.substr(1);
  if (search === 'show-voronoi') {
    d3.select('html').classed(search, true);
  }

  // utilities for getting page width/height
  var pageWidth = ios ? function() {
    return document.body.clientWidth;
  } : function() {
    return window.innerWidth || document.documentElement.clientWidth;
  };
  var pageHeight = ios ? function() {
    var screenWidth,
        screenHeight;
    switch (window.orientation || 0) {
    case 90:
    case -90:
      screenWidth = screen.height;
      screenHeight = screen.availWidth;
      break;
    default:
      screenWidth = screen.width;
      screenHeight = screen.availHeight;
      break;
    }
    return screenHeight / screenWidth * document.body.clientWidth;
  } : function() {
    return window.innerHeight || document.documentElement.clientHeight;
  };

  // utility to register listeners to get notified on page resize events
  var watched = [];
  function watchSize(callback) {
    watched.push(callback);
    callback(pageWidth(), pageHeight());
  }

  function resized() {
    var width = pageWidth();
    var height = pageHeight();
    watched.forEach(function (cb) {
      cb(Math.max(600, width), height);
    });
  }

  d3.select(window)
      .on("resize.watch", resized)
      .on("load.watch", resized)
      .on("orientationchange.watch", resized)
      .call(resized);

  // hide d3-tip on scroll
  d3.select(window)
      .on("scroll.d3-tip-hide", function () { d3.selectAll('.d3-tip').style('top', '-50px'); });

  // add "appendOnce" method to d3 selections which can be called many times but ensures that
  // the dom element is only added once.  It always returns the dom element, and adds a "firstTime"
  // attribute to it that is a length-1 selection the first time its added, and an empty selection
  // all subsequent times
  d3.selection.prototype.appendOnce = function (type, clazz) {
    var result = this.selectAll('.' + clazz.replace(/ /g, '.')).data([1]);
    result.firstTime = result.enter().append(type).attr('class', clazz);
    return result;
  };

  // add "onOnce" method to d3 selections - adds a single listener to the selection that filters on sub-selections
  // when there are too many events that each have a listener and it becomes a performance problem, switch over
  // to using this listener on a parent dom element to reduce total number of listeners
  d3.selection.prototype.onOnce = function (eventType, subSelector, func) {
    this.each(function () {
      $(this).on(eventType, subSelector, function (evt) {
        var d = d3.select(this).datum();
        try {
          d3.event = evt.originalEvent;
          return func.call(this, d);
        } finally {
          d3.event = null;
        }
      });
    });
    return this;
  };

  // add "off" method to d3 selections - clears events types from a space separated list from the
  // selection that were added using D3 or jQuery.
  // For example: selection.off('mouseover mouseout')
  d3.selection.prototype.off = function (eventTypes) {
    var self = this;
    eventTypes.split(/\s+/g).forEach(function (eventType) {
      self.each(function () {
        $(self).off(eventType);
      }).on(eventType, null);
    });
    return self;
  };

  // add utility to move an SVG selection to the front
  d3.selection.prototype.moveToFront = function () {
    return this.each(function () {
      this.parentNode.appendChild(this);
    });
  };

  // Utility wrap an svg <text> element within a specified width
  // Usage:
  // var text = svg.append('text').text(contents)
  // wrap(text, 200)
  // adapted from: http://bl.ocks.org/mbostock/7555321
  function wrap(text, width) {
    text.each(function() {
      var text = d3.select(this),
          words = text.text().split(/\s+/).reverse(),
          word,
          line = [],
          lineNumber = 0,
          lineHeight = 1.1, // ems
          y = text.attr("y") || 0,
          x = text.attr("x") || 0,
          dy = parseFloat(text.attr("dy") || 0),
          tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");
      while (!!(word = words.pop())) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node().getComputedTextLength() > width || word === '<br>') {
          line.pop();
          tspan.text(line.join(" "));
          line = word !== '<br>' ? [word] : [];
          tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
        }
      }
    });
  }

  // Utility for creating a color scale gradient
  // After calling VIZ.createColorScaleGradient(scale, 'my-scale')
  // Can use it to fill a rectangle:
  // rect.attr('fill', 'url(#my-scale)')
  function createColorScaleGradient(scale, name) {
    var gradient = d3.select('body')
      .appendOnce('svg', 'svgdefs')
      .attr('width', 0)
      .attr('height', 0)
      .appendOnce("defs", 'defs')
      .appendOnce('linearGradient', name).firstTime
        .attr("id", name)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%")
        .attr("spreadMethod", "pad");

    var valueToPercentScale = d3.scale.linear()
        .domain(d3.extent(scale.domain()))
        .range(["0%", "100%"]);

    gradient.selectAll('stop')
        .data(scale.domain())
        .enter()
      .append("svg:stop")
        .attr("offset", valueToPercentScale)
        .attr("stop-color", scale)
        .attr("stop-opacity", 1);
  }

  // Utility for creating a clip path
  // After calling VIZ.createClipPath(scale, 'my-clip-path')
  // Can use it to crop any SVG element:
  // rect.attr('clip-path', 'url(#my-clip-path)')
  function createClipRect(name) {
    return d3.select('body')
      .appendOnce('svg', 'svgdefs')
      .appendOnce('defs', 'defs')
      .appendOnce('clipPath', 'clip-' + name)
        .attr('id', name)
      .appendOnce('rect', 'rect-' + name);
  }

  // Utility for scrolling to the anchor specified in the hash
  // part of the URL
  function doAnchorScroll() {
    var id = window.location.hash;
    if (id) {
      id = id.substr(1).split(".")[0];
      var $elem = $('a[href^=#' + id + ']');
      if ($elem.size() > 0) {
        var top = $elem.offset().top;
        IGNORE_SCROLL_EVENTS = true;
        try {
          $(window).scrollTop(top);
        } finally {
          setTimeout(function () { IGNORE_SCROLL_EVENTS = false; }, 3000);
        }
      }
    }
  }

  // Only do the anchor scroll up until the first time the user scrolls
  function doAnchorScrollOnAsyncDataLoad() {
    if (!SCROLLED_ONCE) {
      doAnchorScroll();
    }
  }

  // run this routine when page loads
  $(doAnchorScroll);
  // then listen on subsequent hash change events
  $(window).on('hashchange', function onHashChange(e) {
    e.preventDefault();
    doAnchorScroll();
    if (getHashData()) {
      $(window).trigger('hashdatachange', {data: getHashData()});
    }
    return false;
  });

  // get the extra parts out of a hash ("#location.a.b" return ["a","b"])
  // used in the "your commute" section so that people can deep link to a pair of stops
  function getHashData() {
    var id = window.location.hash;
    var result = null;
    if (id) {
      var parts = id.substr(1).split(".").slice(1);
      result = parts.length === 2 && parts;
    }
    return result;
  }

  var numScrolls = 0;

  // disable auto-scroll on data load after user scrolls once
  // actually the browser may scroll once on its own on page load
  // so really it listens for the second scroll event
  $(window).on('scroll', function watchFirstScroll() {
    if (!IGNORE_SCROLL_EVENTS) {
      numScrolls++;
      if (numScrolls >= 2) {
        // TODO I was still having issues with this, just disable for now and always scroll when new data loads
        // SCROLLED_ONCE = true;
        $(window).off('scroll', watchFirstScroll);
      }
    }
  });

  // programmatically trigger a scroll event to fire listeners
  function triggerScroll() {
    IGNORE_SCROLL_EVENTS = true;
    try {
      $(window).trigger('scroll');
    } finally {
      IGNORE_SCROLL_EVENTS = false;
    }
  }

  // Every station name shows up with "Station" on the end, but people
  // only really talk about "North Station" and "South Station" like that
  // for the rest, strip off " Station"
  function fixStationName(name) {
    if (/^North/.test(name) || /^South/.test(name)) {
      return name;
    } else {
      return name.replace(' Station', '');
    }
  }

  // Simple formatting utility to convert an hour number (0-24) into
  // something resembling 1am, 3pm, etc.
  function hourToAmPm(hour) {
    var time = (hour % 12) === 0 ? 12 : (hour % 12);
    time += ((hour % 24) >= 12 ? 'pm' : 'am');
    return time;
  }

  // Create the global object that all shared data goes on
  window.VIZ = {
    ios: ios,
    watchSize: watchSize,
    wrap: wrap,
    pageHeight: pageHeight,
    createColorScaleGradient: createColorScaleGradient,
    createClipRect: createClipRect,
    anchorScroll: doAnchorScrollOnAsyncDataLoad,
    triggerScroll: triggerScroll,
    getHashData: getHashData,
    fixStationName: fixStationName,
    hourToAmPm: hourToAmPm,
    BREAK_SM: 768,
    BREAK_MD: 992,
    BREAK_LG: 1200,
    noop: function () {}
  };
}());