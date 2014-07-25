/**
 * fixed.js
 *
 * Copyright 2014 Michael Barry & Brian Card.  MIT open-source lincense.
 *
 * Logic for fixed-left containers.  A fixed-left container looks like:
 *
 * <div class="fixed-container">
 *   <div class="fixed-left">
 *     stuff that stays fixed in the viewport when you scroll up and down
 *   </div>
 *   <div class="fixed-right">
 *     stuff that scrolls by like normal
 *   </div>
 * </div>
 *
 * When the screen gets too narrow (or on iOS devices), it places the fixed-left container above
 * the fixed-right one.
 *
 * To programatically respond to size change events:
 *
 * VIZ.watchFixedLeft(function (width, height) { draw left thing })
 * VIZ.watchFixedRight(function (width) { draw right thing })
 */
(function () {
  // width at which to stack the containers vertically instead of horizontally
  VIZ.breakWidth = VIZ.BREAK_MD;
  var pageHeight;
  var pageWidth;
  var x0;
  var x1;
  var vizWidth;
  var MIN_WIDTH = 768;
  var MAX_WIDTH = 1140;
  var NON_FIXED_HEIGHT = 400;
  var GUTTER = 20;
  var resizeTimeout;
  var fixedLeftWatchers = [];
  var fixedRightWatchers = [];
  var fixedRight = d3.selectAll('.fixed-container .fixed-right');
  var fixedLeft = d3.selectAll('.fixed-container .fixed-left');
  var fixedLeftWidth, fixedLeftHeight;
  var fixedRightWidth;
  var showingMap;

  function renderFullScreen() {
    x1 = GUTTER;
    showingMap = false;
    fixedRight.style("margin-left", null);
    fixedLeft.style('width', null);
    fixedLeftWidth = vizWidth;
    fixedLeftHeight = NON_FIXED_HEIGHT;
    fixedRightWidth = vizWidth * 0.9;
    fixedLeftWatchers.forEach(callFixedLeft);
    fixedRightWatchers.forEach(callFixedRight);
  }

  function renderSplitScreen() {
    showingMap = true;
    x1 = x0 + vizWidth / 3;
    fixedRight.style("margin-left", x1 + "px");
    fixedLeftWidth = vizWidth / 3 - GUTTER;
    fixedLeftHeight = pageHeight;
    fixedRightWidth = vizWidth * 2 / 3;
    fixedLeft.style('width', fixedLeftWidth + 'px');
    fixedLeftWatchers.forEach(callFixedLeft);
    fixedRightWatchers.forEach(callFixedRight);
  }

  function callFixedLeft(cb) {
    cb(fixedLeftWidth, fixedLeftHeight, pageWidth < VIZ.breakWidth);
  }

  function callFixedRight(cb) {
    cb(fixedRightWidth);
  }

  /////////// Handle fixing the map to the side
  function resized(width, height) {
    pageWidth = width;
    vizWidth = Math.max(Math.min(pageWidth, MAX_WIDTH), MIN_WIDTH) - GUTTER * 2;
    x0 = (pageWidth - vizWidth) * 0.5;
    pageHeight = height;
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(render, 10);
  }

  function render () {
    if (pageWidth <= VIZ.breakWidth || VIZ.ios) {
      renderFullScreen();
    } else {
      renderSplitScreen();
    }
    VIZ.triggerScroll();
  }

  VIZ.watchSize(resized);
  render();

  VIZ.watchFixedLeft = function (callback) {
    fixedLeftWatchers.push(callback);
    callFixedLeft(callback);
    VIZ.triggerScroll();
  };
  VIZ.watchFixedRight = function (callback) {
    fixedRightWatchers.push(callback);
    callFixedRight(callback);
    VIZ.triggerScroll();
  };

  // Scrolling
  d3.selectAll('.fixed-container').each(function () {
    var y0, y1;
    var container = d3.select(this);
    var fixedRight = container.select('.fixed-right');
    var fixedLeft = container.select('.fixed-left');
    var $fixedRight = $(fixedRight.node());
    var $fixedLeft = $(fixedLeft.node());
    var top = +fixedLeft.attr('data-top');

    // calculate and set the "top" and "left" CSS attributes of the fixed-left container to enforce our scrolling rules
    function scrolled() {
      if (pageWidth < VIZ.breakWidth || VIZ.ios) {
        fixedLeft.style("top", null);
        fixedLeft.style("left", null);
      } else {
        y0 = $fixedRight.offset().top + top;
        y1 = (y0 - top) + $fixedRight.height() - $fixedLeft.height();
        fixedLeft.style("top", window.pageYOffset > y1 ? y1 - window.pageYOffset + "px" : window.pageYOffset < y0 ? y0 - window.pageYOffset + "px" : null);
        fixedLeft.style("left", Math.round(x0) + "px");
      }
    }

    if (!VIZ.ios) {
      scrolled();
      $(window).on("scroll", scrolled);
    }
  });
}());