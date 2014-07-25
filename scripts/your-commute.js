/**
 * your-commute.js
 *
 * Copyright 2014 Michael Barry & Brian Card.  MIT open-source lincense.
 *
 * Render the "Your Commute" chart and map-glyph in the following
 * stages:
 *
 * 1. Load the map and station data and do some pre-processing
 * 2. Render the map and add drag listening logic
 * 3. Render the scaffolding for the scatterplot
 * 4. When a drag finishes, render the scatterplot of wait/transit times between chosen stops
 * 5. Set up listener on hash part of URL to change displayed stations when URL changes
 * 6. Add interaction behavior with surrounding text
 *
 * Interaction is added to all elements throughout as they are rendered.
 */



/* 1. Load the map and station data and do some pre-processing
 *************************************************************/
VIZ.requiresData([
  'json!data/station-network.json',
  'json!data/spider.json',
  'json!data/station-paths.json',
], true).done(function (network, spider, paths) {
  "use strict";
  var idToNode = {};
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
    idToNode[data.id] = data;
  });





  /* 2. Render the map and add drag listening logic
   *************************************************************/
  var tip = d3.tip()
      .attr('class', 'd3-tip pick2')
      .offset([-10, 0])
      .html(function(d) { return VIZ.fixStationName(d.name); });
  var mapGlyphSvg = d3.select('.section-pick-two .map').append('svg').call(tip);
  var details = d3.select('.section-pick-two .details');
  var $tip = $(".d3-tip.pick2");
  (function renderMap() {
    var outerWidth = 300;
    var outerHeight = 300;
    var margin = {top: 30, right: 30, bottom: 10, left: 10};
    var xRange = d3.extent(network.nodes, function (d) { return d.x; });
    var yRange = d3.extent(network.nodes, function (d) { return d.y; });
    var width = outerWidth - margin.left - margin.right,
        height = outerHeight - margin.top - margin.bottom;
    var xScale = width / (xRange[1] - xRange[0]);
    var yScale = height / (yRange[1] - yRange[0]);
    var scale = Math.min(xScale, yScale);
    network.nodes.forEach(function (data) {
      data.pos = [data.x * scale, data.y * scale];
    });
    var endDotRadius = 0.2 * scale;
    var mapGlyph = mapGlyphSvg
        .attr('width', scale * (xRange[1] - xRange[0]) + margin.left + margin.right)
        .attr('height', scale * (yRange[1] - yRange[0]) + margin.top + margin.bottom)
      .appendOnce('g', 'map-container')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var connections = mapGlyph.selectAll('.connect')
        .data(network.links, function (d) { return (d.source && d.source.id) + '-' + (d.target && d.target.id); });

    // render voronoi polygons around each station on the map glyph so the user only needs to hover close to 
    // the station to select it, instead of needing to hover directly over the station
    var voronoi = d3.geom.voronoi()
      .x(function (d) { return d.pos[0]; })
      .y(function (d) { return d.pos[1]; })
      .clipExtent([[-20, -20], [width + 20, height + 20]]);
    _.zip(network.nodes, voronoi(network.nodes)).forEach(function (d) {
      d[0].voronoi = d[1];
    });

    // render an arrow to indicate what direction the path is going
    arrow = mapGlyph.append('g').attr('class', 'arrow').append('text').text('←')
      .attr('dx', -14)
      .attr('dy', -3);

    connections
        .enter()
      .append('line')
        .attr('class', function (d) { return 'connect ' + d.source.id + '-' + d.target.id; })
        .attr('x1', function (d) { return d.source.pos[0]; })
        .attr('y1', function (d) { return d.source.pos[1]; })
        .attr('x2', function (d) { return d.target.pos[0]; })
        .attr('y2', function (d) { return d.target.pos[1]; });

    connections
        .attr('x1', function (d) { return d.source.pos[0]; })
        .attr('y1', function (d) { return d.source.pos[1]; })
        .attr('x2', function (d) { return d.target.pos[0]; })
        .attr('y2', function (d) { return d.target.pos[1]; });
    var draggingFrom = null;
    var draggingTo = null;
    var stationContainers = mapGlyph.selectAll('.station-wrapper')
        .data(network.nodes, function (d) { return d.name; })
        .enter()
      .append('g').attr('class', 'station-wrapper draggable')
        .on('mouseover', function (d) {
          if (draggingFrom) {
            var path = findPath(draggingFrom.id, d.id);
            if (path) {
              highlightPath(draggingFrom.id, d.id);
              draggingTo = d;
            } else {
              draggingTo = null;
            }
          } else {
            d3.select(this).classed('hover', true);
          }
          showTip(d);
        })
        .on('mouseout', function (d) {
          d3.select(this).classed('hover', false);
          $tip.addClass('out');
          tip.hide(d);
        });
    stationContainers.append('clipPath')
        .attr('id', function (d) { return 'clip-' + d.id; })
      .append("circle")
        .attr('cx', function(d) { return d.pos[0]; })
        .attr('cy', function(d) { return d.pos[1]; })
        .attr('r', 20);
    stationContainers.append('path')
        .attr('class', 'voronoi')
        .attr('clip-path', function (d) { return 'url(#clip-' + d.id + ')'; })
        .attr('d', function (d) { return "M" + d.voronoi.join(",") + "Z"; });
    stationContainers.append('circle')
        .attr('class', function (d) { d.circle = this; return 'station middle station-label ' + d.id; })
        .attr('cx', function (d) { return d.pos[0]; })
        .attr('cy', function (d) { return d.pos[1]; })
        .attr('r', 5);

    function showTip(d) {
      tip.show(d);
      $tip.removeClass('out');
      var $circle = $(d.circle);
      var offset = $circle.offset();
      tip.style('top', (offset.top-45)+'px');
      tip.style('left', (offset.left-$tip.width()/2 - 5)+'px');
    }

    // on mobile, allow a user to just click the start then click the end
    // on desktop allow the full drag and drop experience
    if (VIZ.ios) {
      stationContainers.on('click', function (d) {
        draggingFrom = d;
        dragStart.call(this, d).on('click', function (end) {
          draggingTo = end;
          dragEnd();
          d3.event.stopPropagation();
        });
      });
    } else {
      var drag = d3.behavior.drag()
        .origin(function(d) { return d; })
        .on("dragstart", dragStart)
        .on("dragend", dragEnd);
      stationContainers.call(drag);
    }

    function dragEnd() {
      tip.hide();
      d3.select('body').classed('dragging', false);
      if (draggingTo) {
        render(draggingFrom.id, draggingTo.id);
      }
      draggingFrom = null;
      network.nodes.forEach(function (d) {
        d.voronoi2 = null;
      });
      stationContainers.selectAll('.voronoi2').remove();
    }

    function dragStart(d) {
      /* jshint validthis:true */
      d3.select('body').classed('dragging', true);
      draggingFrom = d;
      draggingTo = null;
      mapGlyphSvg.selectAll('.start').classed('start', false);
      mapGlyphSvg.selectAll('.stop').classed('stop', false);
      mapGlyphSvg.selectAll('.hover').classed('hover', false);
      mapGlyphSvg.selectAll('.active').classed('active', false);
      // pre-load file as they are dragging, hopefully it loads and gets cached when they finish dragging
      VIZ.requiresData(['json!data/upick2-weekday-rollup-' + draggingFrom.id + '.json']);
      d3.select(this).select('circle').classed('start', true);
      arrow.attr('transform', 'scale(0)');
      var stations = _.unique(_.flatten(paths.filter(function (d) {
        return d.indexOf(draggingFrom.id) >= 0;
      }))).map(function (d) { return idToNode[d]; });

      // when you start dragging, immediately draw voronoi polygons around each valid
      // destination point so the path ends at the point that is closest to the cursor
      _.zip(stations, voronoi(stations)).forEach(function (d) {
        d[0].voronoi2 = d[1];
      });
      return mapGlyph.selectAll('.station-wrapper')
          .filter(function (d) { return !!d.voronoi2; })
          .moveToFront()
        .append('path')
          .attr('class', 'voronoi2')
          .attr('d', function (d) { return "M" + d.voronoi2.join(",") + "Z"; });
    }

    // line color circles
    function dot(id, clazz) {
      mapGlyph.selectAll('circle.' + id)
        .classed(clazz, true)
        .classed('end', true)
        .classed('middle', false)
        .attr('r', Math.max(endDotRadius, 5));
    }
    dot('place-asmnl', "red");
    dot('place-alfcl', "red");
    dot('place-brntn', "red");
    dot('place-wondl', "blue");
    dot('place-bomnl', "blue");
    dot('place-forhl', "orange");
    dot('place-ogmnl', "orange");
  }());

  var lines = mapGlyphSvg.selectAll('line');
  var circles = mapGlyphSvg.selectAll('circle');

  // if a path exists from start to finish station, return the stations that are along that path
  function findPath(startId, finishId) {
    if (startId === finishId) { return null; }
    for (var i = 0; i < paths.length; i++) {
      var startIdx = paths[i].indexOf(startId);
      var finishIdx = paths[i].indexOf(finishId);
      if (startIdx >= 0 && finishIdx >= 0) {
        return _.object(d3.range(Math.min(startIdx, finishIdx), Math.max(startIdx, finishIdx) + 1).map(createPair));
      }
    }

    function createPair(idx) {
      return [paths[i][idx], true];
    }
    return null;
  }

  // highlight the path from a starting station to an ending station if one exists
  function highlightPath(from, to) {
    var path = findPath(from, to);
    if (path) {
      details.text(VIZ.fixStationName(idToNode[from].name) + ' to ' + VIZ.fixStationName(idToNode[to].name));
      circles.classed({
        start: function (d) { return d.id === from; },
        stop: function (d) { return d.id === to; },
        hover: false,
        active: function (d) { return path[d.id]; }
      });
      lines.classed({
        start: function (d) { return d.source.id === from && path[d.target.id] || d.target.id === from && path[d.source.id]; },
        active: function (d) { return path[d.source.id] && path[d.target.id]; }
      });
      var activeLine = lines.filter(function (d) { return d.source.id === from && path[d.target.id] || d.target.id === from && path[d.source.id]; });
      var activeCircle = circles.filter(function (d) { return d.id === from; });
      var lineY = activeLine.attr('y1') === activeCircle.attr('cy') ? activeLine.attr('y2') : activeLine.attr('y1');
      var lineX = activeLine.attr('x1') === activeCircle.attr('cx') ? activeLine.attr('x2') : activeLine.attr('x1');
      var angle = 180 + (Math.atan2(lineY - activeCircle.attr('cy'), lineX - activeCircle.attr('cx')) * 180 / Math.PI);
      arrow.attr('transform', 'translate(' + activeCircle.attr('cx') + ',' + activeCircle.attr('cy') + ')rotate(' + angle + ')');
    }
  }




  /* 3. Render the scaffolding for the scatterplot
   *************************************************************/
  var margin = {top: 35, right: 60, bottom: 15, left: 40},
    width = 600 - margin.left - margin.right,
    height = 340 - margin.top - margin.bottom;

  var x = d3.scale.linear()
      .range([0, width]);

  var y = d3.scale.linear()
      .range([height, 0]);

  var xAxis = d3.svg.axis()
      .scale(x)
      .tickPadding(6)
      .tickSize(-height)
      .tickFormat(VIZ.hourToAmPm)
      .orient("bottom");

  var xAxis2 = d3.svg.axis()
      .scale(x)
      .tickSize(5)
      .tickFormat(VIZ.hourToAmPm)
      .orient("bottom");

  var yAxis = d3.svg.axis()
      .scale(y)
      .tickSize(-width)
      .tickFormat(Math.abs)
      .tickPadding(8)
      .orient("left");

  var yAxis2 = d3.svg.axis()
      .scale(y)
      .tickSize(5)
      .orient("left");

  var arrow;

  // put the contents inside a clipping rectangle so that no data spills out of the scatterplot
  VIZ.createClipRect('bigPickTwoClipper')
    .attr('y', 0)
    .attr('x', 0)
    .attr('width', width)
    .attr('height', height);

  var scatterplotContainer = d3.select(".pick-two .inner-viz");
  var scatterplotSvg = scatterplotContainer.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var layerBelowTheData = scatterplotSvg.append('g').attr('class', 'dimmable');
  var dataLayer = scatterplotSvg.append('g').attr('clip-path', "url(#bigPickTwoClipper)");
  var layerAboveTheData = scatterplotSvg.append('g');

  var title = scatterplotSvg.append('text').attr('class', 'dimmable')
      .attr("x", width / 2)
      .attr('y', -18)
      .attr('text-anchor', 'middle')
      .attr('class', 'h4');
  var subtitle = scatterplotSvg.append('text').attr('class', 'dimmable')
      .attr("x", width / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle');

  layerAboveTheData.append('rect')
    .attr('width', width)
    .attr('height', height)
    .style('fill', 'white')
    .style('opacity', 0)
    .style('stroke', 'none');

  var topRange = dataLayer.appendOnce('path', 'top range dimmable');
  var topUnder = dataLayer.appendOnce('path', 'top under dimmable');
  var topMedian = dataLayer.appendOnce('path', 'top p50 dimmable');
  var bottomRange = dataLayer.appendOnce('path', 'bottom range dimmable');
  var bottomUnder = dataLayer.appendOnce('path', 'bottom under dimmable');
  var bottomMedian = dataLayer.appendOnce('path', 'bottom p50 dimmable');

  // setup the moving color band keys on the right
  var sideKey = scatterplotSvg.append('g').attr('class', 'dimmable').style('opacity', 0);
  var topKey = sideKey.append('text');
  topKey.append('tspan')
      .attr('x', width + 3)
      .attr('dy', -5)
      .text('middle 80%')
      .classed('light-markup', true);
  topKey.append('tspan')
      .attr('x', width + 3)
      .attr('dy', -10)
      .text('transit time');
  var topKeyMedian = sideKey.append('text')
      .attr('x', width + 8)
      .attr('dy', 3)
      .text('median')
      .classed('light-markup', true);
  var bottomKey = sideKey.append('text');
  bottomKey.append('tspan')
      .attr('x', width + 3)
      .attr('dy', 10)
      .text('middle 80%')
      .classed('light-markup', true);
  bottomKey.append('tspan')
      .attr('x', width + 3)
      .attr('dy', 8)
      .text('wait time');
  var bottomKeyMedian = sideKey.append('text')
      .attr('x', width + 8)
      .attr('dy', 3)
      .text('median')
      .classed('light-markup', true);
  var bottomKeyPath = sideKey.append('path').attr('class', 'key-marker');
  var topKeyPath = sideKey.append('path').attr('class', 'key-marker');

  x.domain([5, 24]);

  layerBelowTheData.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis);
  layerBelowTheData.append("g")
      .attr("class", "x axis bold-ticks")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis2);
  var yAxisG = layerBelowTheData.append("g")
      .attr("class", "y axis");
  var yAxisG2 = layerBelowTheData.append("g")
      .attr("class", "y axis bold-ticks");
  var zeroMinutesLine = layerAboveTheData.append("line")
      .attr("class", "y axis midpoint")
      .style('opacity', 0);
  yAxisG.append("text")
      .attr("class", "label")
      .attr("transform", "rotate(-90)")
      .attr("y", -35)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Trip duration (min)");
  yAxisG.append("text")
      .attr("class", "label")
      .attr("transform", "rotate(-90)")
      .attr("y", -35)
      .attr("x", -height)
      .attr("dy", ".71em")
      .style("text-anchor", "start")
      .text("Minutes between trains");





  /* 4. When a drag finishes, render the scatterplot of wait/transit times between chosen stops
   *************************************************************/
  var lastHour = null;
  var idx = 0;
  var lastFrom = null;
  var lastTo = null;
  function render(from, to) {
    // don't re-render the same thing
    if (lastFrom === from && lastTo === to) { return; }
    lastFrom = from;
    lastTo = to;
    highlightPath(from, to);
    d3.selectAll('.section-pick-two a.anchor').attr('href', ['#your-commute', from, to].join('.'));
    idx = idx + 1;
    var myIdx = idx;
    d3.select('.pick-two').classed('loading-data', true);
    VIZ.requiresData([
      'json!data/upick2-weekday-rollup-' + from + '.json'
    ]).progress(function (percent) {
      if (idx !== myIdx) { return; } // another request went out that supersedes this one
      d3.selectAll(".section-pick-two .loading").text('Loading... ' + percent + '%').classed('err', false);
    }).onerror(function () {
      if (idx !== myIdx) { return; } // another request went out that supersedes this one
      d3.selectAll(".section-pick-two .loading").text('Error loading data').classed('err', true);
    }).done(function (weekdayRollup) {
      if (idx !== myIdx) { return; } // another request went out that supersedes this one
      d3.select('.pick-two').classed('loading-data', false);
      d3.selectAll(".section-pick-two .loading").html('&nbsp;');

      var percentileBandData = weekdayRollup[to].result;
      var scatterplotData = weekdayRollup[to].actuals;
      // on iOS don't show as many points to improve performance
      if (VIZ.ios && scatterplotData.length > 1000) {
        scatterplotData = _.sortBy(_.sample(scatterplotData, 1000), 0);
      }
      var fromName = VIZ.fixStationName(idToNode[from].name);
      var toName = VIZ.fixStationName(idToNode[to].name);

      title.text(fromName + ' to ' + toName);
      subtitle.text('Trip Duration and Time Between Trains On All Weekdays');

      y.domain([-Math.min(30, d3.max(_.pluck(scatterplotData, 2))), d3.max(_.pluck(scatterplotData, 1))]);

      // remove old circles
      dataLayer.selectAll('.circle').remove();

      // fade-in new circles
      dataLayer.selectAll('.circle.top')
          .data(scatterplotData)
          .enter()
          .append('circle')
          .attr('class', 'circle top dimmable')
          .attr('r', 1)
          .attr('cx', function (d) { return x(d[0]); })
          .attr('cy', function (d) { return y(d[1]); })
          .style('opacity', 0)
          .transition()
          .duration(1000)
          .style('opacity', 0.8);

      dataLayer.selectAll('.circle.bottom')
          .data(scatterplotData)
          .enter()
          .append('circle')
          .attr('class', 'circle bottom dimmable')
          .attr('r', 1)
          .attr('cx', function (d) { return x(d[0]); })
          .attr('cy', function (d) { return y(-d[2]); })
          .style('opacity', 0)
          .transition()
          .duration(1000)
          .style('opacity', 0.8);

      // update the colored bands
      topRange.datum(percentileBandData).transition().attr("d", area(1, 0, 2));
      topMedian.datum(percentileBandData).transition().attr("d", line(1, 1));
      bottomRange.datum(percentileBandData).transition().attr("d", area(2, 0, 2, true));
      bottomMedian.datum(percentileBandData).transition().attr("d", line(2, 1, true));
      bottomUnder
          .datum(percentileBandData)
          .transition()
          .attr("d", d3.svg.area()
            .x(function(d) { return x(d[0]); })
            .interpolate('basis')
            .defined(defined)
            .y0(function() { return y(0); })
            .y1(function(d) { return y(-d[2][0]); }));
      topUnder
          .datum(percentileBandData)
          .transition()
          .attr("d", d3.svg.area()
            .x(function(d) { return x(d[0]); })
            .interpolate('basis')
            .defined(defined)
            .y0(function(d) { return y(d[1][0]); })
            .y1(function() { return y(0); }));

      var lastPercentileDatapoint = _.max(percentileBandData.filter(function (d) { return d[0] <= 24; }), function (d) { return d[0]; });
      var top = {
        bottom: y(lastPercentileDatapoint[1][0]),
        median: y(lastPercentileDatapoint[1][1]),
        top: Math.max(0, y(lastPercentileDatapoint[1][2])),
      };
      var bottom = {
        bottom: Math.min(height - 10, y(-lastPercentileDatapoint[2][2])),
        median: y(-lastPercentileDatapoint[2][1]),
        top: y(-lastPercentileDatapoint[2][0]),
      };

      // update the colored band key on the right
      sideKey
        .transition()
        .style('opacity', 1);

      topKey
        .transition()
        .attr('y', top.top);
      topKeyMedian
        .transition()
        .attr('y', top.median);
      bottomKey
        .transition()
        .attr('y', bottom.bottom);
      bottomKeyMedian
        .transition()
        .attr('y', bottom.median);

      topKeyPath
        .transition()
        .attr('d', "M" + [
          [width + 1, top.top],
          [width + 4, top.top],
          [width + 4, top.bottom],
          [width + 1, top.bottom]
        ].map(round).join(",") + "M" + [
          [width + 1, top.median],
          [width + 8, top.median]
        ].map(round).join(","));

      bottomKeyPath
        .transition()
        .attr('d', "M" + [
          [width + 1, bottom.top],
          [width + 4, bottom.top],
          [width + 4, bottom.bottom],
          [width + 1, bottom.bottom]
        ].map(round).join(",") + "M" + [
          [width + 1, bottom.median],
          [width + 8, bottom.median]
        ].map(round).join(","));

      yAxisG.transition().call(yAxis);
      yAxisG2.transition().call(yAxis2);
      zeroMinutesLine.transition().call(placeMidpointLine);

      // The first time this is drawn, add the vertical bar when you hover over the scatterplot
      var highlighter = dataLayer.appendOnce('line', 'highlighter dimmable')
        .attr('y1',  0)
        .attr('y2',  height);
      var highlighterTime = dataLayer.appendOnce('text', 'highlighter-text dimmable');
      highlighterTime
        .firstTime
        .attr('dx', 5)
        .attr('x', '-100')
        .attr('y', 10);

      var extent = d3.scale.linear().domain([5, 24]).range([5, 24]).clamp(true);
      layerAboveTheData
        .on('mousemove', handleHover)
        .on('touchstart', handleHover)
        .on('touchmove', handleHover);

      function handleHover() {
        var xPos = d3.mouse(scatterplotContainer.node())[0] - margin.left;
        highlightHour(x.invert(xPos));
        if (d3.event) {
          d3.event.preventDefault();
        }
      }

      var paragraph = d3.select('.pick-two .key');

      // update the bar position and paragraph that described the data based on
      // what time you are hovering over
      function highlightHour(hour) {
        lastHour = hour;
        hour = extent(hour);
        var xPos = x(hour);
        highlighter.attr('x1', xPos).attr('x2', xPos);
        var right = xPos < (width - 100);
        function place(selection) {
          selection
            .attr('x', xPos)
            .attr('text-anchor', right ? 'start' : 'end')
            .attr('dx', right ? 5 : -5);
        }
        var idx = _.sortedIndex(percentileBandData, [hour], 0);
        var before = percentileBandData[idx - 1];
        var after = percentileBandData[idx];
        highlighterTime.call(place);
        var time = moment.utc(hour * 60 * 1000 * 60).format('h:mm a');
        if (before && after) {
          // if there's data here, describe it
          var ratio = (hour - before[0]) / (after[0] - before[0]);
          var combined = d3.interpolate(before, after)(ratio);
          combined[1] = combined[1].map(function (d) { return d.toFixed(0); });
          combined[2] = combined[2].map(function (d) { return d.toFixed(0); });
          highlighterTime.text(time);
          paragraph.text(
            'At ' + time + ' trains leave every ' + combined[2][0] + ' to ' + combined[2][2] + ' minutes ' +
            'from ' + fromName + ' going to ' + toName + '.  The trip takes between ' + combined[1][0] + ' and ' +
            combined[1][2] + ' minutes. The shortest time from when you walk into ' + fromName + ' until you walk out of ' + toName + 
            ' is ' + (combined[1][0]) + ' minutes but it can be as long as ' + (+combined[1][2] + (+combined[2][2])).toFixed(0) +
            ' minutes.  Usually it takes about ' + (+combined[1][1] + (+combined[2][1] / 2)).toFixed(0) + ' minutes including wait and transit time.'
          );
        } else {
          // if not then say so
          highlighterTime.text(time);
          paragraph.text(
            'At ' + time + ' no trains travel from ' + fromName + ' to ' + toName + '.'
          );
        }
      }

      // if already had a time selected, select that time again with this new data
      if (lastHour) { highlightHour(lastHour); }
      // if this is the first time, start by showing 5:30PM because that is when Mike rides the train
      else { highlightHour(12 + 5.5); }
    });
  }



  /* 5. Set up listener on hash part of URL to change displayed
   *    stations when that changes
   *
   * For example, when URL changes to
   * #your-commute.place-knncl.place-sstat
   * it loads data into the scatterplot from Kendall/MIT to
   * South Station
   *************************************************************/
  var hashData = VIZ.getHashData();
  if (hashData && idToNode[hashData[0]] && idToNode[hashData[1]]) {
    // if stations are specified in URL, show them
    render(hashData[0], hashData[1]);
  } else {
    // if no specific station pair is selected, then start by showing Kendall/MIT to South Station
    // because that is the route that Mike rides at 5:30PM
    render('place-knncl', 'place-sstat');
  }

  // Listen for URL hash changes and update the data if that changes after the page is loaded
  $(window).on('hashdatachange', function (evt, d) {
    var hashData = d.data;
    if (hashData.length === 2 && idToNode[hashData[0]] && idToNode[hashData[1]]) {
      render(hashData[0], hashData[1]);
    }
  });



  /* 6. Add interaction behavior with surrounding text
   *************************************************************/
  // Setup the links in text that dim everything except a certain part of the graph on hover
  // <a href="#" data-dest="selector to show" class="pick-two-highlight">...
  d3.selectAll('.section-pick-two a.pick-two-highlight')
    .on('click', function () {
      d3.event.preventDefault();
    })
    .on('mouseover', function () {
      var selector = d3.select(this).attr('data-highlight');
      d3.selectAll('.section-pick-two .viz').selectAll(selector).classed('highlight-active', true);
      d3.selectAll('.section-pick-two .viz').classed('highlighting', true);
    })
    .on('mouseout', function () {
      d3.selectAll('.section-pick-two .viz .highlight-active').classed('highlight-active', false);
      d3.selectAll('.section-pick-two .viz').classed('highlighting', false);
    });

  // Setup the links in text that load data for other station pairs when you click on them
  // <a href="#" data-start="GTFS ID of starting station" data-end="GTFS ID of ending station" class="pick-two-choose">...
  d3.selectAll('.section-pick-two a.pick-two-choose')
    .on('click', function () {
      d3.event.preventDefault();
      var start = d3.select(this).attr('data-start');
      var end = d3.select(this).attr('data-end');
      render(start, end);
    })
    .on('mouseover', function () {
      // start downloading file as soon as user is thinking about clicking the link
      var start = d3.select(this).attr('data-start');
      VIZ.requiresData(['json!data/upick2-weekday-rollup-' + start + '.json']);
    });





  /* Miscellaneous utilities
   *************************************************************/
  function defined(d) {
    return d[0] && (d[0] < 24.5 && d[0] >= 5);
  }

  function placeMidpointLine(line) {
    line
        .style('opacity', 0.4)
        .attr('x1', -5)
        .attr('x2', width)
        .attr('y1', y(0))
        .attr('y2', y(0));
  }

  function area(num, startIdx, endIdx, neg) {
    var mult = neg ? -1 : 1;
    return d3.svg.area()
        .x(function(d) { return x(d[0]); })
        .interpolate('basis')
        .defined(defined)
        .y0(function(d) { return y(mult * d[num][startIdx]); })
        .y1(function(d) { return y(mult * d[num][endIdx]); });
  }

  function line(num, idx, neg) {
    var mult = neg ? -1 : 1;
    return d3.svg.line()
      .x(function(d) { return x(d[0]); })
      .interpolate('basis')
      .defined(defined)
      .y(function(d) { return y(mult * d[num][idx]); });
  }

  function round(input) {
    return input.map(d3.round);
  }
});