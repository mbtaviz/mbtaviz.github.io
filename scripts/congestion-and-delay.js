/**
 * congestion-and-delay.js
 *
 * Copyright 2014 Michael Barry & Brian Card.  MIT open-source lincense.
 *
 * Renders the "Congestion and Delay" chart and map-glyph in the following
 * stages:
 *
 * 1. Load the required data and do some pre-processing
 * 2. Render the horizon/color band chart
 * 3. Render the map-glyph for this section
 * 4. Render the line-width key for the map glyph
 * 5. Render the congestion color band key
 * 6. Render the horizon entries per minute chart key
 * 7. Set up the click and hover interaction with surrounding text
 *
 * Interaction is added to all elements throughout as they are rendered.
 */





/* 1. Load and pre-process the data
 *************************************************************/

VIZ.requiresData([
  'json!data/delay.json',
  'json!data/station-network.json',
  'json!data/spider.json',
  'json!data/average-actual-delays.json'
], true).progress(function (percent) {
  "use strict";
  d3.selectAll(".interaction-all .loading").text('Loading delay data... ' + percent + '%').style('text-align', 'center');
}).onerror(function () {
  "use strict";
  d3.select(".interaction-all .loading").text('Error loading delay data').style('text-align', 'center');
}).done(function (delay, network, spider, averageActualDelays) {
  "use strict";
  d3.select(".interaction-all .loading").remove();

  var delays = {};
  var entrances = {};
  delay.sort(function (a, b) {
    return d3.ascending(a.secOfDay, b.secOfDay);
  });
  network.links.forEach(function (link) {
    link.source = network.nodes[link.source];
    link.target = network.nodes[link.target];
    link.source.links = link.source.links || [];
    link.target.links = link.target.links || [];
    link.target.links.splice(0, 0, link);
    link.source.links.splice(0, 0, link);
  });
  network.nodes.forEach(function (data) {
    data.x = spider[data.id][0];
    data.y = spider[data.id][1];
  });
  var xRange = d3.extent(network.nodes, function (d) { return d.x; });
  var yRange = d3.extent(network.nodes, function (d) { return d.y; });
  var byDay = _.chain(delay)
    .groupBy('day')
    .toArray()
    .sortBy(function (d) { return d[0].day; })
    .value();




  /* 2. Render the horizon/color band chart
   *************************************************************/
  var chartMargin = {top: 20, right: 70, bottom: 60, left: 50};
  var chartOuterWidth = 600;
  var chartOuterHeight = 350;
  var chartHeight = chartOuterHeight - chartMargin.top - chartMargin.bottom;
  var chartWidth = chartOuterWidth - chartMargin.left - chartMargin.right;
  var chart = d3.select(".interaction-all .right").append('svg')
      .attr('class', 'horizons')
      .attr('width', chartOuterWidth)
      .attr('height', chartOuterHeight)
    .append('g')
      .attr('transform', 'translate(' + 0 + ',' + (chartMargin.top) + ')');

  var days = d3.range(0, 7);
  var dayRowYScale = d3.scale.ordinal()
      .domain([1, 2, 3, 4, 5, 6, 0])
      .rangeRoundBands([0, chartHeight], 0.3);

  // dayRowContainer is a container for the congestion and delay timeline.  Each row is
  // broken up into a left container element that contains the labels and a right
  // container element that contains the horizon chart and the delay band.  Each
  // of these is assigned the dimmable class for dimming on lightweight interaction
  // and also a day- (such as day-0) that's used to identify that day in the 
  // index.html file.
  var dayRowContainer = chart.selectAll('.row')
      .data(days)
      .enter()
    .append('g')
      .attr('class', 'row');
  var dayRows = dayRowContainer.append('g')
      .attr('transform', function (d) { return 'translate(' + chartMargin.left + ',' + dayRowYScale(d) + ')'; });
  var dayRowLabels = dayRowContainer.append('g')
      .attr('class', function (d) { return 'dimmable day-' + d; })
      .attr('transform', function (d) { return 'translate(' + (chartMargin.left / 2) + ',' + dayRowYScale(d) + ')'; });
  dayRowLabels.append('text')
    .attr('class', 'daylabel')
    .attr('dy', dayRowYScale.rangeBand() - 15)
    .attr('text-anchor', 'middle')
    .text(function (d) { return moment.weekdaysShort()[d]; });
  dayRowLabels.append('text')
    .attr('class', 'dayofmonthlabel')
    .attr('dy', dayRowYScale.rangeBand() - 2)
    .attr('text-anchor', 'middle')
    .text(function (d) { return 'Feb ' + (2 + (d === 0 ? 7 : d)); });

  // horizon chart with entrances data.  'ins_total' is the field we are plotting and
  // represents the total number of entrances for that time chunk.  Switching this to
  // 'total_outs' plots the exists instead.
  var horizonType = 'ins_total';
  var delayMapHeight = 7;
  var horizonMargin = {top: 0, right: 0, bottom: delayMapHeight, left: 0};
  var horizonWidth = chartWidth - horizonMargin.left - horizonMargin.right;
  var horizonHeight = dayRowYScale.rangeBand() - horizonMargin.top - horizonMargin.bottom;

  // draw the time scale across the top
  var timeScale = d3.time.scale()
      .domain([0, 24 * 60 * 60 * 1000])
      .range([0, horizonWidth])
      .clamp(true);
   var timeAxis = d3.svg.axis()
      .scale(timeScale)
      .tickFormat(d3.time.format.utc("%-I%p"))
      .orient('top')
      .ticks(d3.time.hours, 2);
   chart.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(' + chartMargin.left + ',0)')
      .call(timeAxis);

  // draw the multilevel gray horizon charts for each day
  var horizon = d3.horizon()
      .width(horizonWidth)
      .height(horizonHeight)
      .yMax(1.1)
      .bands(3)
      .mode("offset")
      .interpolate("basis");
  horizon.color.domain([-4, 0, 4]).range(['#555', 'white', '#555']);
  var horizons = dayRows.append('g')
      .attr('class', 'horizon-row')
      .attr('transform', 'translate(' + horizonMargin.left + ',' + horizonMargin.top + ')');
  horizons.selectAll('.horizon')
      .data(function (d) {
        // find the min and max values so we can build a relative value
        var min = d3.min(delay, function (t) { return t[horizonType]; });
        var max = d3.max(delay, function (t) { return t[horizonType]; });
        var scale = d3.scale.linear().domain([min, max]);

        // filter out bad values, then return an array of objects that
        // can be fed into the horizon library.  Note the transformation
        // using the scale to get relative values here so we fill up the 
        // horizon chart as much as possible
        var result = [
          _.chain(delay)
            .where({day: d})
            .filter(function (t) { return typeof (t[horizonType]) === 'number'; })
            .map(function (t) { return [t.secOfDay, scale(t[horizonType])]; })
            .value()
        ];
        result[0].day = d;
        return result;
      })
      .enter()
    .append('g')
      .attr('class', function (d) { return 'horizon dimmable day-' + d.day; })
      .call(horizon);

  // draw the red/green delay indicator band below each horizon chart
  // this consists of a wide rectangle that is filled with an SVG gradient
  // that has colored stops along the way based on the relative delay of
  // each datapoint.  The gradient handles smoothly interpolating between
  // datapoints
  var gradient = chart.append("svg:defs").selectAll('linearGradient')
      .data(byDay)
      .enter()
    .append("svg:linearGradient")
      .attr("id", function (d) { return "gradient" + d[0].day; })
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%")
      .attr("spreadMethod", "pad");

  var delayMapColorScale = d3.scale.linear()
      .interpolate(d3.interpolateLab)
      .domain([-0.2, 0, 0.4])
      .range(['rgb(0, 104, 55)', 'rgb(255, 255, 255)', 'rgb(165, 0, 38)']);

  var delayMapXScale = d3.scale.linear()
      .domain([0, 24 * 60 * 60])
      .range(["0%", "100%"]);

  gradient.selectAll('stop')
      .data(function (d) { return d; })
      .enter()
    .append("svg:stop")
      .attr("offset", function (d) { return delayMapXScale(d.secOfDay + 60 * 7.5); })
      .attr("stop-color", function (d) { return delayMapColorScale(d.delay_actual); })
      .attr("stop-opacity", 1);

  horizons.append('rect')
      .attr('class', function (d) { return 'delay-rect dimmable day-' + d; })
      .attr('y', horizonHeight)
      .attr('width', horizonWidth)
      .attr('height', delayMapHeight)
      .attr('fill', function (d) { return "url(#gradient" + d + ")"; });

  // the bar that follows the cursor around, showing the time that you are hovering over
  // and rendering in the map glyph
  var timeHoverBar = chart.append('g').attr('class', 'indicator dimmable').attr('transform', 'translate(-100,0)');
  timeHoverBar.append('line')
    .attr('x1', 0)
    .attr('x2', 0)
    .attr('y1', -10)
    .attr('y2', dayRowYScale.rangeBand() + 10);
  var timeDisplay = timeHoverBar.append('text').attr('dx', -3).attr('dy', -1).attr('text-anchor', 'end');
  var turnstileEntryText = timeHoverBar.append('text').attr('dx', 3).attr('dy', -1).attr('text-anchor', 'start');
  var relativeDelayText = timeHoverBar.append('text').attr('dx', 3).attr('dy', dayRowYScale.rangeBand() + 10).attr('text-anchor', 'start');
  var bisect = d3.bisector(function (d) { return d.secOfDay; }).left;
  var bucketSize = 15*60*1000;

  function mouseover() {
    var chartContainerDomNode = d3.select('.interaction-all .right').node();
    var x = d3.mouse(chartContainerDomNode)[0] - chartMargin.left;
    var y = d3.mouse(chartContainerDomNode)[1] - 14;
    if (y < 0 || x < 0 || y > chartHeight || x > chartWidth) { return; }
    var day = Math.max(1, d3.bisectLeft(dayRowYScale.range(), y)) % 7;
    var theTime = timeScale.invert(x).getTime();
    mouseoverTime(day, theTime);
    if (d3.event) {
      d3.event.preventDefault();
    }
  }

  // Handle when the mouse is moved over a particular time on the horizon/color band chart
  function mouseoverTime(day, theTime) {
    var x = timeScale(theTime);
    var y = dayRowYScale(day);
    timeHoverBar.attr('transform', 'translate(' + (x+chartMargin.left) + ',' + y + ')');
    timeDisplay.text(moment(theTime).utc().format('h:mm a'));
    var fullTime = moment(theTime).utc().format('h:mm a') + ' on ' + moment.weekdaysShort()[day] + ' Feb ' + (day ? day + 2 : 9);
    timeDisplayBelowMapGlyph.text(fullTime);
    d3.select('.interaction-all .time').text(fullTime);
    var inputData = byDay[day];
    delays = {};
    var idx = bisect(inputData, theTime / 1000 - 15 * 60) - 1;
    var ratio = ((theTime-1) % bucketSize) / bucketSize;
    var before = inputData[idx] || inputData[idx+1];
    var after = inputData[idx+1] || before;
    entrances = d3.interpolate(before.ins, after.ins)(ratio);
    turnstileEntryText.text(d3.format('0f')(d3.interpolate(before.ins_total, after.ins_total)(ratio)) + " entries/min");
    var delay = d3.interpolate(before.delay_actual, after.delay_actual)(ratio);
    if (delay < 0) {
      relativeDelayText.text(d3.format('%')(-delay) + " fast");
    } else {
      relativeDelayText.text(d3.format('%')(delay) + " slow");
    }
    var trainDataLeft = _.extend.apply(null, [{}].concat(_.pluck(before.lines, 'delay_actual')));
    var trainDataRight = _.extend.apply(null, [{}].concat(_.pluck(after.lines, 'delay_actual')));
    var trainDataMerged = d3.interpolate(trainDataLeft, trainDataRight)(ratio);

    function updateCachedDelayForSegment(FROM, TO) {
      var key = FROM + "|" + TO;
      if (trainDataMerged.hasOwnProperty(key)) {
        var diff = trainDataMerged[key];
        var median = averageActualDelays[key];
        var speed = median / diff;
        delays[key] = speed;
      }
    }

    network.links.forEach(function (link) {
      updateCachedDelayForSegment(link.source.id, link.target.id);
      updateCachedDelayForSegment(link.target.id, link.source.id);
    });

    // tell the glyph to redraw
    glyph.selectAll('.connect path')
      .attr('fill', mapGlyphSegmentColor)
      .attr('d', mapGlyphSegmentVertices);
  }





  /* 3. Render the map-glyph
   *************************************************************/
  var encodeSvgLine = d3.svg.line()
    .x(function(d) { return d[0]; })
    .y(function(d) { return d[1]; })
    .defined(function (d) { return !!d; })
    .interpolate("linear");
  var glyphMargin = {top: 20,right: 20, bottom: 25,left: 20};
  var glyphOuterHeight = 300;
  var glyphOuterWidth = 300;
  var glyphWidth = glyphOuterWidth - glyphMargin.left - glyphMargin.right,
      glyphHeight = glyphOuterHeight - glyphMargin.top - glyphMargin.bottom;

  var glyph = d3.select(".interaction-all .left .glyph").append('svg')
      .attr('class', 'breathing-glyph dimmable')
      .attr('width', glyphOuterWidth)
      .attr('height', glyphOuterHeight)
    .append('g')
      .attr('transform', 'translate(' + (glyphMargin.left) + ',' + (glyphMargin.top) + ')');

  var timeDisplayBelowMapGlyph = glyph.append('text')
    .attr('x', glyphWidth / 2)
    .attr('y', glyphHeight + 20)
    .attr('text-anchor', 'middle');

  var xScale = glyphWidth / (xRange[1] - xRange[0]);
  var yScale = glyphHeight / (yRange[1] - yRange[0]);

  var scale = Math.min(xScale, yScale);
  var endDotRadius = 0.3 * scale;
  var distScale = d3.scale.linear()
    .domain([0, 100])
    .range([0.15 * scale, 0.7 * scale]);

  var redGreenDelayColorScale = d3.scale.linear()
      .interpolate(d3.interpolateLab)
      .domain([2, 1, 0.3])
      .range(['rgb(0, 104, 55)', 'rgb(255, 255, 255)', 'rgb(165, 0, 38)']);

  function mapGlyphSegmentColor(d) {
    var speed = delays[d.ids];
    var color;
    if (speed === null || typeof speed === 'undefined') {
      color = 'white';
    } else {
      color = redGreenDelayColorScale(speed);
    }
    return color;
  }
  network.nodes.forEach(function (data) {
    data.pos = [data.x * scale, data.y * scale];
  });

  var tip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html(function(d) { return d.name; });
  glyph.call(tip);

  var glyphSegmentOutlines = glyph.selectAll('.connect')
      .data(function (d) { return network.links.map(function (link) { return { link: link, day: d }; }); })
      .enter()
    .append('g')
      .attr('class', 'connect');

  glyphSegmentOutlines.append('g')
      .attr('class', function (d) { return d.link.line + '-glyph ' + d.link.source.id + '-' + d.link.target.id; })
    .append('path')
      .datum(function (d) {
        return {
          incoming: getLinksGoingToNode(d.link.source),
          line: d.link.line,
          ids: d.link.source.id + '|' + d.link.target.id,
          segment: [d.link.source.pos, d.link.target.pos],
          outgoing: getLinksLeavingFromNode(d.link.target),
          name: d.link.source.name + " to " + d.link.target.name
        };
      })
      .attr('fill', mapGlyphSegmentColor)
      .attr('d', mapGlyphSegmentVertices)
      .on('mouseover.tip', tip.show)
      .on('mouseout.tip', tip.hide);

  glyphSegmentOutlines.append('g')
      .attr('class', function (d) { return d.link.line + '-glyph ' + d.link.target.id + '-' + d.link.source.id; })
    .append('path')
      .datum(function (d) {
        return {
          incoming: getLinksGoingToNode(d.link.target),
          line: d.link.line,
          ids: d.link.target.id + '|' + d.link.source.id,
          segment: [d.link.target.pos, d.link.source.pos],
          outgoing: getLinksLeavingFromNode(d.link.source),
          name: d.link.target.name + " to " + d.link.source.name
        };
      })
      .attr('fill', mapGlyphSegmentColor)
      .attr('d', mapGlyphSegmentVertices)
      .on('mouseover.tip', tip.show)
      .on('mouseout.tip', tip.hide);

  // Draw a colored dot at the end of each line
  drawLineEndDot('place-asmnl', "#E12D27");
  drawLineEndDot('place-alfcl', "#E12D27");
  drawLineEndDot('place-brntn', "#E12D27");
  drawLineEndDot('place-wondl', "#2F5DA6");
  drawLineEndDot('place-bomnl', "#2F5DA6");
  drawLineEndDot('place-forhl', "#E87200");
  drawLineEndDot('place-ogmnl', "#E87200");





  /* 4. Render the line-width key for the map glyph
   *************************************************************/
  (function drawMapKey() {
    var margin = {top: 5, right: glyphMargin.right, bottom: 10, left: glyphMargin.left};
    var width = 300 - margin.left - margin.right;
    var mapKeySvg = d3.selectAll('.interaction-all .left .key').append('svg')
      .attr('width', 300)
      .attr('height', 60)
    .append('g')
      .attr('class', 'dimmable breathing-glyph')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    var text = mapKeySvg.append('text')
      .attr('x', width / 2)
      .attr('y', 10)
      .attr('text-anchor', 'middle');
    text.text('Line width shows turnstile entries at a station');
    var sizes = [0, 50, 100];
    var xScale = d3.scale.ordinal()
        .domain(sizes)
        .range([33, 77, 130]);
    var connect = mapKeySvg.selectAll('.path')
        .data(sizes)
        .enter()
      .append('g')
        .attr('class', 'path connect')
        .attr('transform', function (d) { return 'translate(' + (xScale(d) - distScale(d) - 4) + ',' + 28 + ')'; });

    // draw fill for key shapes
    connect.append('path')
        .datum(function (d) {
          return [
            [-distScale(d), 0],
            [-distScale(d) * 0.75, 10],
            [distScale(d) * 0.75, 10],
            [distScale(d), 0],
            [distScale(d) * 0.75, -10],
            [-distScale(d) * 0.75, -10],
            [-distScale(d), 0]
          ];
        })
        .style('stroke', 'none')
        .style('fill', delayMapColorScale(-0.01))
        .attr('d', encodeSvgLine);

    // draw outlines for key shapes
    connect.append('path')
        .datum(function (d) {
          return [
            [-distScale(d), 0],
            [-distScale(d) * 0.75, 10],
            null,
            [distScale(d) * 0.75, 10],
            [distScale(d), 0],
            [distScale(d) * 0.75, -10],
            null,
            [-distScale(d) * 0.75, -10],
            [-distScale(d), 0],
            null,
            [-distScale(d), 0],
            [distScale(d), 0],
            null,
            [0, 10],
            [0, -10]
          ];
        })
        .style('stroke', 'black')
        .style('fill', 'none')
        .attr('d', encodeSvgLine);
    mapKeySvg.selectAll('text.num')
        .data(sizes)
        .enter()
      .append('text')
        .attr('class', 'num')
        .text(d3.format(',.0f'))
        .attr('x', function (d) { return xScale(d); })
        .attr('y', 32);
    mapKeySvg.append('text')
        .attr('text-anchor', 'start')
        .attr('x', xScale(_.last(sizes)) + 20)
        .attr('y', 32)
        .text('people per minute');
  }());





  /* 5. Render the congestion color band key
   *************************************************************/
  (function drawColorKey() {
    var bandWidth = 150;

    var colorKeyContainer = chart
      .append('g')
      .attr('class', 'dimmable delay-rect key');

    colorKeyContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 6)
        .text('Color shows delay');
    colorKeyContainer.attr('transform', 'translate(' + (chartWidth * 0.15 + chartMargin.left) + ',' + (chartHeight+20) + ')');

    var xScale = d3.scale.linear()
        .domain(d3.extent(delayMapColorScale.domain()))
        .range([0, bandWidth]);

    VIZ.createColorScaleGradient(delayMapColorScale, 'delayGradient');
    var coloredPart = colorKeyContainer.append('g');
    coloredPart.append('rect')
      .attr('x', -bandWidth/2)
      .attr('y', 10)
      .attr('width', bandWidth)
      .attr('height', 6)
      .attr('fill', 'url(#delayGradient)');

    var redGreenDelayColorScaleAxis = d3.svg.axis()
      .scale(xScale)
      .orient('bottom')
      .tickFormat(function (n) {
        var pct = d3.format('.0%')(n);
        var npct = d3.format('.0%')(-n);
        return n < 0 ? (npct + " faster") : n > 0 ? (pct + " slower") : "on time";
      })
      .tickValues([d3.min(delayMapColorScale.domain()), 0, d3.max(delayMapColorScale.domain())])
      .tickSize(4);
    coloredPart
      .append('g')
        .attr('class', 'x axis')
        .attr('transform', function() { return 'translate(' + (-bandWidth/2) +',' + 16 + ')'; })
        .call(redGreenDelayColorScaleAxis)
      .append('text')
        .attr('text-anchor', 'start')
        .attr('x', bandWidth + 30)
        .attr('dy', 15)
        .text('than normal');
  }());





  /* 6. Render the horizon entries per minute chart key
   *************************************************************/
  (function drawHorizonKey() {
    var bandWidth = 150;

    var horizonKeyContainer = chart
      .append('g')
      .attr('class', 'dimmable horizon key');

    horizonKeyContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 6)
        .text('Gray bars show entries to all stations');
    horizonKeyContainer.attr('transform', 'translate(' + (chartWidth*3/4 + chartMargin.left) + ',' + (chartHeight+20) + ')');


    // draw the small horizon chart
    var coloredPart = horizonKeyContainer.append('g');
    var max = d3.max(delay, function (t) { return t.ins_total; });
    var xScale = d3.scale.linear()
        .domain([0, 1].map(function (d) { return d * max; }))
        .range([0, bandWidth]);
    var horizon = d3.horizon()
        .width(bandWidth)
        .height(6)
        .yMax(max * 1.1)
        .bands(3)
        .mode("offset")
        .interpolate("basis");
    horizon.color.domain([-4, 0, 4]).range(['#555', 'white', '#555']);
    coloredPart.append('g')
        .attr('class', 'horizon-row')
        .attr('transform', 'translate(' + (-bandWidth/2) + ',' + 10 + ')')
        .selectAll('.horizon')
        .data([[[0, 0], [1, max]]])
        .enter()
      .append('g')
        .attr('class', function (d) { return 'horizon dimmable day-' + d.day; })
        .call(horizon);

    var horizonAxis = d3.svg.axis()
      .scale(xScale)
      .orient('bottom')
      .tickFormat(function (n) {
        return d3.format('.0f')(d3.round(n, -1));
      })
      .tickValues([0, 1.1 * max / 3, 1.1 * max * 2 / 3, max])
      .tickSize(4);
    coloredPart
      .append('g')
        .attr('class', 'x axis')
        .attr('transform', function() { return 'translate(' + (-bandWidth/2) +',' + 16 + ')'; })
        .call(horizonAxis)
      .append('text')
        .attr('text-anchor', 'start')
        .attr('x', bandWidth + 16)
        .attr('dy', 14)
        .text('people per minute');
  }());





  /* 7. Setup the click and hover interaction with surrounding
   *    text
   *************************************************************/
  d3.select('.interaction-all .viz')
    .on('mousemove', mouseover)
    .on('touchmove', mouseover)
    .on('touchstart', mouseover);

  // Setup linked text to highlight parts of graph
  // <a href="#" class="highlight" data-highlight="class of dom elements to highlight">
  d3.selectAll('.interaction-all a.highlight')
    .on('click', function () {
      d3.event.preventDefault();
    })
    .on('mouseover', function () {
      var selector = d3.select(this).attr('data-highlight');
      d3.selectAll('.interaction-all .viz').selectAll(selector).classed('active', true);
      d3.selectAll('.interaction-all .viz').classed('highlighting', true);
    })
    .on('mouseout', function () {
      d3.selectAll('.interaction-all .viz .active').classed('active', false);
      d3.selectAll('.interaction-all .viz').classed('highlighting', false);
    });

  // Setup linked text to highlight parts of graph
  // <a href="#" class="set-time" data-day="day of week #" data-time="time of day">
  d3.selectAll('.interaction-all a.set-time')
    .on('click', function () {
      d3.event.preventDefault();
    })
    .on('mouseover', function () {
      var day = +d3.select(this).attr('data-day');
      var time = d3.select(this).attr('data-time');
      var ms = moment(time + ' -0500', 'hh:mm a Z').zone(5).diff(moment(time + ' -0500', 'hh:mm a Z').zone(5).startOf('day'));
      mouseoverTime(day, ms);
    });

  // Bootstrap the visualization, start by showing Monday at 5:30PM
  var initalTime = moment('2/3/2014 5:30 PM -0500', 'M/D/YYYY hh:mm a Z').zone(5);
  mouseoverTime(1, initalTime.diff(initalTime.clone().startOf('day')));





  /* Miscellaneous utilities
   * 
   * Primarily geometric equations for determining intersection
   * points between lines in the map glyph to decide where to put
   * the vertices of each polygon
   *************************************************************/
  function getLinksGoingToNode(node, day) {
    return node.links.map(function (n) {
      var segment;
      var ids;
      if (n.target === node) {
        segment = [n.source.pos, n.target.pos];
        ids = n.source.id + "|" + n.target.id;
      } else {
        segment = [n.target.pos, n.source.pos];
        ids = n.target.id + "|" + n.source.id;
      }
      return {
        segment: segment,
        line: n.line,
        ids: ids,
        day: day
      };
    });
  }

  function getLinksLeavingFromNode(node, day) {
    return node.links.map(function (n) {
      var segment;
      var ids;
      if (n.source === node) {
        segment = [n.source.pos, n.target.pos];
        ids = n.source.id + "|" + n.target.id;
      } else {
        segment = [n.target.pos, n.source.pos];
        ids = n.target.id + "|" + n.source.id;
      }
      return {
        segment: segment,
        line: n.line,
        ids: ids,
        day: day
      };
    });
  }

  // line color circles
  function drawLineEndDot(id, color) {
    glyph.append('circle')
      .attr('cx', scale * spider[id][0])
      .attr('cy', scale * spider[id][1])
      .attr('fill', color)
      .attr('r', endDotRadius)
      .attr('stroke', "none");
  }

  function closestClockwise(thisLine, otherLines) {
    var origAngle = angle(thisLine.segment);
    otherLines = otherLines || [];
    var result = null;
    var minAngle = Infinity;
    otherLines.forEach(function (other) {
      if (segmentsAreSame(other, thisLine)) { return; }
      var thisAngle = angle(other.segment) + Math.PI;
      var diff = -normalize(thisAngle - origAngle);
      if (diff < minAngle) {
        minAngle = diff;
        result = other;
      }
    });
    return result;
  }

  function closestCounterClockwise(thisLine, otherLines) {
    var origAngle = angle(thisLine.segment);
    otherLines = otherLines || [];
    var result = null;
    var minAngle = Infinity;
    otherLines.forEach(function (other) {
      var thisAngle = angle(other.segment);
      var diff = normalize(origAngle - thisAngle);
      var absDiff = Math.abs(diff);
      if (absDiff < 0.2 || Math.abs(absDiff - Math.PI) < 0.2) { return; }
      if (diff < minAngle) {
        minAngle = diff;
        result = other;
      }
    });
    return result;
  }

  function segmentsAreSame(a, b) {
    var sega = JSON.stringify(a.segment);
    var segb = JSON.stringify(b.segment);
    return sega === segb;
  }

  function normalize(angle) {
    return (Math.PI * 4 + angle) % (Math.PI * 2) - Math.PI;
  }

  function angle(source, dest) {
    if (arguments.length === 1) {
      var origP1 = source;
      source = origP1[0];
      dest = origP1[1];
    }
    return Math.atan2((dest[1] - source[1]), (dest[0] - source[0]));
  }

  function offsetPoints(link) {
    var split = link.ids.split("|").map(function (a) {
      var val = entrances[a];
      return distScale(val || 0);
    });
    var p1 = link.segment[0];
    var p2 = link.segment[1];
    var lineAngle = angle(p1, p2);
    var angle90 = lineAngle + Math.PI / 2;
    var p3 = [p2[0] + split[1] * Math.cos(angle90), p2[1] + split[1] * Math.sin(angle90)];
    var p4 = [p1[0] + split[0] * Math.cos(angle90), p1[1] + split[0] * Math.sin(angle90)];
    return [p4, p3];
  }

  function slope(line) {
    return (line[1][1] - line[0][1]) / (line[1][0] - line[0][0]);
  }

  function intercept(line) {
    // y = mx + b
    // b = y - mx
    return line[1][1] - slope(line) * line[1][0];
  }

  function intersect(line1, line2) {
    var m1 = slope(line1);
    var b1 = intercept(line1);
    var m2 = slope(line2);
    var b2 = intercept(line2);
    var m1Infinite = m1 === Infinity || m1 === -Infinity;
    var m2Infinite = m2 === Infinity || m2 === -Infinity;
    var x, y;
    if ((m1Infinite && m2Infinite) || Math.abs(m2 - m1) < 0.01) {
      return null;
    } else if (m1Infinite) {
      x = line1[0][0];
      // y = mx + b
      y = m2 * x + b2;
      return [x, y];
    } else if (m2Infinite) {
      x = line2[0][0];
      y = m1 * x + b1;
      return [x, y];
    } else {
      x = (b2 - b1) / (m1 - m2);
      y = m1 * x + b1;
      return [x, y];
    }
  }

  function mapGlyphSegmentVertices(link) {
    var p1 = link.segment[0];
    var p2 = link.segment[1];
    var offsets = offsetPoints(link);
    var p3 = offsets[1];
    var p4 = offsets[0];
    var first;

    first = closestClockwise(link, link.outgoing);
    if (first && link.outgoing.length > 1) {
      var outgoingPoints = offsetPoints(first);
      var newP3 = intersect(offsets, outgoingPoints);
      if (newP3) { p3 = newP3; }
    }
    first = closestCounterClockwise(link, link.incoming);
    if (first && link.incoming.length > 1) {
      var incomingPoints = offsetPoints(first);
      var newP4 = intersect(offsets, incomingPoints);
      if (newP4) { p4 = newP4; }
    }
    return encodeSvgLine([p1, p2, p3, p4, p1]);
  }
});