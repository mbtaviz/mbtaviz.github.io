/**
 * the-trains.js
 *
 * Copyright 2014 Michael Barry & Brian Card.  MIT open-source lincense.
 *
 * Display marey diagrams and map glyph for "The Trains" section of the
 * visualization in the following stages:
 *
 * 1. Load the required data and do some pre-processing
 * 2. Render the side map glyph that shows locations of trains at a point in time
 * 3. Set up the scaffolding for lined-up and full Marey diagrams
 * 4. On load and when the screen width changes:
 *   4a. Render the full Marey
 *   4b. Render annotations for the full Marey
 *   4c. Render the lined-up Marey
 *   4d. Set up listener to zoom in on a particular trip of the lined-up marey when user clicks on it
 * 5. Add interaction behavior with surrounding text
 *
 * Interaction is added to all elements throughout as they are rendered.
 */




/* 1. Load and pre-process the data
 *************************************************************/
VIZ.requiresData([
  'json!data/station-network.json',
  'json!data/spider.json',
  'json!data/marey-trips.json',
  'json!data/marey-header.json'
], true).progress(function (percent) {
  "use strict";
  d3.selectAll(".marey, .lined-up-marey").text('Loading train data... ' + percent + '%').style('text-align', 'center');
}).onerror(function () {
  "use strict";
  d3.select(".marey, .lined-up-marey").text('Error loading train data').style('text-align', 'center');
}).done(function (network, spider, trips, header) {
  "use strict";

  // The annotations displayed along the right side of the Marey diagram
  var sideAnnotationData = [
    // At the minimum you need time and text which positions the annotation...
    {
      time: '2014/02/03 05:00',
      text: 'Service starts at 5AM on Monday morning. Each line represents the path of one train. Time continues downward, so steeper lines indicate slower trains. <br> \u25BE'
    },
    {
      time: '2014/02/03 05:55',
      text: 'Since the red line splits, we show the Ashmont branch first then the Braintree branch.  Trains on the Braintree branch "jump over" the Ashmont branch.',
      // But additionally you can have a line connecting the annotation to a point in the marey diagram
      connections: [{
        time: '2014/02/03 05:40',
        station: 'ashmont',
        line: 'red'
      }]
    },
    {
      time: '2014/02/03 06:30',
      text: 'Train frequency increases around 6:30AM as morning rush hour begins.',
      id: 'marey-morning-rush'
    },
    {
      time: '2014/02/03 11:30',
      text: 'After the morning rush-hour subsides, everything runs smoothly throughout the middle of the day',
      id: 'marey-midday-lull'
    },
    {
      time: '2014/02/03 15:30',
      text: 'The afternoon rush hour begins around 3:30PM',
      id: 'marey-evening-rush'
    },
    {
      time: '2014/02/03 17:00',
      text: 'A disabled train causes delays on trains after (below) it for over an hour.  Notice how this causes delays in the other direction as well, as trains immediately arrive at Alewife then turn around to go south.',
      connections: [{
        // or a range of times on a line in the marey diagram
        start: '2014/02/03 17:02',
        stop: '2014/02/03 18:07',
        station: 'JFK',
        line: 'red'
      }],
      // links can also be used to highlight specific trains.  Links do not work over wrapped lines
      link: {
        text: 'disabled train',
        trip: 'R983382C2'
      }
    },
    {
      time: '2014/02/03 18:20',
      text: 'Service to Bowdoin stops at 6:20PM',
      connections: [{
        time: '2014/02/03 18:20',
        station: 'Bowdoin',
        line: 'blue'
      }]
    },
    {
      time: '2014/02/03 19:00',
      text: 'Normal service resumes for the evening starting around 7PM',
      id: 'marey-evening-lull'
    },
    {
      time: '2014/02/03 20:50',
      text: 'A disabled train at Wellington Station causes northbound delays on the Orange Line from 8:50PM to 9:15PM',
      connections: [{
        start: '2014/02/03 20:50',
        stop: '2014/02/03 21:15',
        station: 'Community College',
        line: 'orange'
      }],
      link: {
        text: 'disabled train',
        trip: 'O9861AEF3'
      }
    },
    {
      time: '2014/02/03 21:20',
      text: 'Notice how southbound trains are temporarily delayed, but get back on schedule quickly.'
    },
    {
      time: '2014/02/04 01:30',
      text: 'The last trains of the night move much slower, sweeping up the remaining passengers to finish around 1:30AM'
    },
    {
      time: '2014/02/04 02:30',
      text: 'At night, trains are moved between stations',
      connections: [
        {
          start: '2014/02/04 01:56',
          stop: '2014/02/04 02:03',
          station: 'Orient Heights',
          line: 'blue'
        },
        {
          start: '2014/02/04 03:59',
          stop: '2014/02/04 04:25',
          station: 'JFK',
          line: 'red'
        }
      ]
    },
    {
      time: '2014/02/04 05:15',
      text: 'At 5AM on Tuesday, the cycle begins again'
    }
  ];
  var idToNode = {};
  network.nodes.forEach(function (data) {
    data.x = spider[data.id][0];
    data.y = spider[data.id][1];
    idToNode[data.id] = data;
  });
  network.links.forEach(function (link) {
    link.source = network.nodes[link.source];
    link.target = network.nodes[link.target];
    link.source.links = link.source.links || [];
    link.target.links = link.target.links || [];
    link.target.links.splice(0, 0, link);
    link.source.links.splice(0, 0, link);
  });
  trips.forEach(function (d) {
    d.stops = d.stops || [];
    var m = moment(d.begin*1000).zone(5);
    d.secs = m.diff(m.clone().startOf('day')) / 1000;
  });
  var stationToName = {};
  var end = {};
  var nodesPerLine = network.nodes.map(function (d) {
    return d.links.map(function (link) {
      var key = d.id + '|' + link.line;
      if (d.links.length === 1) { end[key] = true; }
      stationToName[key] = d.name;
      return key;
    });
  });
  var mapGlyphTrainCircleRadius = 2.5;
  nodesPerLine = _.unique(_.flatten(nodesPerLine));
  var xExtent = d3.extent(d3.values(header), function (d) { return d[0]; });
  var minUnixSeconds = d3.min(d3.values(trips), function (d) { return d.begin; });
  var maxUnixSeconds = d3.max(d3.values(trips), function (d) { return d.end; });





  /* 2. Render the side map glyph that shows locations of trains
   *    at a point in time
   *************************************************************/
  var fixedLeft = d3.select(".fixed-left");
  var mapGlyphSvg = fixedLeft.select('.side-map').append('svg');

  function renderSideMap(mapGlyphContainer, outerWidth, outerHeight) {
    var mapGlyphMargin = {top: 30, right: 30, bottom: 10, left: 10};
    var xRange = d3.extent(network.nodes, function (d) { return d.x; });
    var yRange = d3.extent(network.nodes, function (d) { return d.y; });
    var width = outerWidth - mapGlyphMargin.left - mapGlyphMargin.right,
        height = Math.max(outerHeight - mapGlyphMargin.top - mapGlyphMargin.bottom - $('.side-caption').height() - 40, 150);
    var xScale = width / (xRange[1] - xRange[0]);
    var yScale = height / (yRange[1] - yRange[0]);
    var scale = Math.min(xScale, yScale);
    network.nodes.forEach(function (data) {
      data.pos = [data.x * scale, data.y * scale];
    });
    var endDotRadius = 0.2 * scale;
    var mapGlyph = mapGlyphContainer
        .attr('width', scale * (xRange[1] - xRange[0]) + mapGlyphMargin.left + mapGlyphMargin.right)
        .attr('height', scale * (yRange[1] - yRange[0]) + mapGlyphMargin.top + mapGlyphMargin.bottom)
      .appendOnce('g', 'map-container')
        .attr('transform', 'translate(' + mapGlyphMargin.left + ',' + mapGlyphMargin.top + ')');

    var stations = mapGlyph.selectAll('.station')
        .data(network.nodes, function (d) { return d.name; });

    var connections = mapGlyph.selectAll('.connect')
        .data(network.links, function (d) { return (d.source && d.source.id) + '-' + (d.target && d.target.id); });

    connections
        .enter()
      .append('line')
        .attr('class', function (d) { return 'connect ' + d.line + '-dimmable'; })
        .attr('x1', function (d) { return d.source.pos[0]; })
        .attr('y1', function (d) { return d.source.pos[1]; })
        .attr('x2', function (d) { return d.target.pos[0]; })
        .attr('y2', function (d) { return d.target.pos[1]; });

    connections
        .attr('x1', function (d) { return d.source.pos[0]; })
        .attr('y1', function (d) { return d.source.pos[1]; })
        .attr('x2', function (d) { return d.target.pos[0]; })
        .attr('y2', function (d) { return d.target.pos[1]; });

    stations
        .enter()
      .append('circle')
        .attr('class', function (d) { return 'station middle station-label ' + d.id; })
        .on('mouseover', function (d) {
          if (d.pos[1] < 30) {
            tip.direction('e')
              .offset([0, 10]);
          } else {
            tip.direction('n')
              .offset([-10, 0]);
          }
          tip.show(d);
          highlightMareyTitle(d.id, _.unique(d.links.map(function (link) { return link.line; })));
        })
        .on('mouseout', function (d) {
          tip.hide(d);
          highlightMareyTitle(null);
        })
        .attr('cx', function (d) { return d.pos[0]; })
        .attr('cy', function (d) { return d.pos[1]; })
        .attr('r', 3);

    stations
        .attr('cx', function (d) { return d.pos[0]; })
        .attr('cy', function (d) { return d.pos[1]; })
        .attr('r', 3);

    // line color circles
    function dot(id, clazz) {
      mapGlyph.selectAll('circle.' + id)
        .classed(clazz, true)
        .classed('end', true)
        .classed('middle', false)
        .attr('r', Math.max(endDotRadius, 3));
    }
    dot('place-asmnl', "red");
    dot('place-alfcl', "red");
    dot('place-brntn', "red");
    dot('place-wondl', "blue");
    dot('place-bomnl', "blue");
    dot('place-forhl', "orange");
    dot('place-ogmnl', "orange");
  }

  // Render train dots onto the map glyph at a particular point in time
  var lastTime = minUnixSeconds;
  function renderTrainsAtTime(unixSeconds) {
    if (!unixSeconds) { unixSeconds = lastTime; }
    lastTime = unixSeconds;
    if (!showingMap) { return; }
    var active = trips.filter(function (d) {
      return d.begin < unixSeconds && d.end > unixSeconds;
    });
    var positions = active.map(function (d) {
      // get prev, next stop and mix
      for (var i = 0; i < d.stops.length - 1; i++) {
        if (d.stops[i + 1].time > unixSeconds) {
          break;
        }
      }

      // find the datapoint before and after this time and interpolate
      var from = d.stops[i];
      var to = d.stops[i + 1];
      var ratio = (unixSeconds - from.time) / (to.time - from.time);
      return {trip: d.trip, pos: placeWithOffset(from, to, ratio), line: d.line};
    });

    var trains = mapGlyphSvg.select('.map-container').selectAll('.train').data(positions, function (d) { return d.trip; });
    trains.enter().append('circle')
        .attr('class', function (d) { return 'train highlightable hoverable dimmable ' + d.line; })
        .classed('active', function (d) { return d.trip === highlightedTrip; })
        .classed('hover', function (d) { return d.trip === hoveredTrip; })
        .attr('r', mapGlyphTrainCircleRadius )
        .on('click', function (d) { highlightTrain(d); })
        .on('mouseover', hoverTrain)
        .on('mouseout', unHoverTrain);
    trains
        .attr('cx', function (d) { return d.pos[0]; })
        .attr('cy', function (d) { return d.pos[1]; });
    trains.exit().remove();
    timeDisplay.text(moment(unixSeconds * 1000).zone(5).format('h:mm a'));
  }





  /* 3. Set up the scaffolding for lined-up and full Marey diagrams
   *************************************************************/
  var marey = d3.select(".marey").text('').style('text-align', 'left').append('svg');
  var mareyContainer = d3.select('.marey-container').classed('loading', false);
  d3.select(".lined-up-marey").text('');
  var timeDisplay = mareyContainer.selectAll('.marey-time');
  var tip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html(function(d) { return d.name; });
  marey.call(tip);
  var linedUpMargin = {top: 50, right: 40, bottom: 60, left: 80};
  var linedUpOuterHeight = 430;
  var linedUpHeight = linedUpOuterHeight - linedUpMargin.top - linedUpMargin.bottom;
  var linedUpDayScale = d3.time.scale()
    .domain([0, 24 * 60 * 60 * 1000])
    .range([0, linedUpHeight])
    .clamp(true);
  var brush = d3.svg.brush()
      .y(linedUpDayScale)
      .extent([7 * 60 * 60 * 1000, 9 * 60 * 60 * 1000])
      .clamp(true)
      .on("brush", brushed);
  d3.select('body').on('click.highlightoff', function () { highlightedTrip = null; highlight(); });

  // lined-up Marey diagram costants used to position the starting points of each trip
  // as well as orient the labels that describe each line
  var linedUpMareyStartingStationLabels = {
    "place-alfcl": {text: "Alewife", anchor: "start"},
    "place-asmnl": {text: "Ashmont/Braintree", anchor: "end"},
    "place-brntn": {anchor: "end"},
    "place-wondl": {text: "Wonderland", anchor: "start"},
    "place-gover": {text: "Gov't Center", anchor: "end"},
    "place-bomnl": {anchor: "end"},
    "place-ogmnl": {text: "Oak Grove", anchor: "start"},
    "place-forhl": {text: "Forest Hills", anchor: "end"}
  };
  var linedUpMareyStartingStations = Object.keys(linedUpMareyStartingStationLabels);
  var linedUpXScale = d3.scale.ordinal()
      .domain(linedUpMareyStartingStations);
  var maxLinedUpMareyChartWidth = 970;
  var betweenStarts = 0.02;
  var betweenEnds = 0.07;
  var linedUpMareyXScaleRatioFromFullMarey = 0.52 * (1 - betweenEnds * 3 - betweenStarts * 2);
  var originalLinedUpMareyXScaleRatioFromFullMarey = linedUpMareyXScaleRatioFromFullMarey;
  var linedUpMareyLineEndPositions = (function calcPlacement() {
    var redStops = 21;
    var blueStops = 11;
    var orangeStops = 18;
    var totalStops = redStops + blueStops + orangeStops;
    var forLines = (1 - betweenEnds * 3 - betweenStarts * 2);
    var redAllocation = forLines * redStops / totalStops / 2;
    var orangeAllocation = forLines * orangeStops / totalStops / 2;
    return [
      0,
      redAllocation * 2 + betweenEnds,
      redAllocation * 2 + betweenEnds,
      redAllocation * 2 + betweenEnds + betweenStarts,
      1 - orangeAllocation * 2 - betweenEnds - betweenStarts,
      1 - orangeAllocation * 2 - betweenEnds - betweenStarts,
      1 - orangeAllocation * 2 - betweenEnds,
      1
    ];
  }());
  var linedUpMareyMidpointLabelPositions = [
    d3.mean([linedUpMareyLineEndPositions[0], linedUpMareyLineEndPositions[1]]),
    d3.mean([linedUpMareyLineEndPositions[0], linedUpMareyLineEndPositions[1]]),
    d3.mean([linedUpMareyLineEndPositions[0], linedUpMareyLineEndPositions[1]]),
    d3.mean([linedUpMareyLineEndPositions[3], linedUpMareyLineEndPositions[4]]),
    d3.mean([linedUpMareyLineEndPositions[3], linedUpMareyLineEndPositions[4]]),
    d3.mean([linedUpMareyLineEndPositions[3], linedUpMareyLineEndPositions[4]]),
    d3.mean([linedUpMareyLineEndPositions[6], linedUpMareyLineEndPositions[7]]),
    d3.mean([linedUpMareyLineEndPositions[6], linedUpMareyLineEndPositions[7]])
  ];
  var linedUpTrips = trips.filter(function (trip) {
    return _.contains(linedUpMareyStartingStations, trip.stops[0].stop);
  });
  var linedUpYScale = d3.scale.linear()
    .domain([0, d3.max(linedUpTrips, function (trip) {
      return trip.stops[trip.stops.length - 1].time - trip.stops[0].time;
    })]);
  var linedUpTimeScale = d3.time.scale()
    .domain([0, d3.max(linedUpTrips, function (trip) {
      return 1000 * (trip.stops[trip.stops.length - 1].time - trip.stops[0].time);
    })]);




  /* 4. On load and when the screen width changes
   *
   * This section makes heavy use of a utility defined in
   * common.js 'appendOnce' that when called adds a new element
   * or returns the existing element if it already exists.
   *************************************************************/
   // first some state shared across re-renderings
  var frozen = false;
  var showingMap = false;
  var highlightedLinedUpMarey = null;
  var highlightedTrip = null;
  var hoveredTrip = null;
  var lastWidth = null;

  // the method that actually gets called on screen size chages
  function renderMarey(outerSvg, fullMareyOuterWidth) {
    fullMareyOuterWidth = Math.round(fullMareyOuterWidth);
    if (fullMareyOuterWidth === lastWidth) { return; }
    lastWidth = fullMareyOuterWidth;



    /* 4a. Render the full Marey
     *************************************************************/
    var fullMareyMargin = {top: 100, right: 200, bottom: 0, left: 60};
    var fullMareyOuterHeight = 3500;
    var fullMareyWidth = fullMareyOuterWidth - fullMareyMargin.left - fullMareyMargin.right,
        fullMareyHeight = fullMareyOuterHeight - fullMareyMargin.top - fullMareyMargin.bottom;
    outerSvg.attr('width', fullMareyOuterWidth)
        .attr('height', fullMareyOuterHeight);

    var fullMareyHeader = outerSvg.appendOnce('g', 'header')
        .attr('transform', 'translate(' + fullMareyMargin.left + ',0)');
    var fullMareyBodyContainer = outerSvg.appendOnce('g', 'main')
        .attr('transform', 'translate(' + fullMareyMargin.left + ', ' + fullMareyMargin.top + ')');
    var fullMareyBackground = fullMareyBodyContainer.appendOnce('g', 'background');
    var fullMareyForeground = fullMareyBodyContainer.appendOnce('g', 'foreground');

    var xScale = d3.scale.linear()
        .domain(xExtent)
        .range([0, fullMareyWidth]);
    var yScale = d3.scale.linear()
      .domain([
        minUnixSeconds,
        maxUnixSeconds
      ]).range([15, fullMareyHeight]).clamp(true);

    var timeScale = d3.time.scale()
      .domain([new Date(minUnixSeconds * 1000), new Date(maxUnixSeconds * 1000)])
      .range([15, fullMareyHeight]);

    // draw the station label header aross the top
    var keys = d3.keys(header);
    var stationXScale = d3.scale.ordinal()
        .domain(keys)
        .range(keys.map(function (d) { return xScale(header[d][0]); }));
    var stationXScaleInvert = {};
    keys.forEach(function (key) {
      stationXScaleInvert[header[key][0]] = key;
    });

    var stationLabels = fullMareyHeader.selectAll('.station-label')
        .data(nodesPerLine);

    stationLabels
        .enter()
      .append('text')
        .attr('class', 'station-label')
        .style('display', function (d) { return end[d] ? null : 'none'; })
        .style('text-anchor', 'start')
        .text(function (d) { return VIZ.fixStationName(stationToName[d]); });

    stationLabels
        .attr('transform', function (d) { return 'translate(' + (stationXScale(d) - 2) + ',' + (fullMareyMargin.top - 3) + ')rotate(-70)'; });

    var stations = fullMareyForeground.selectAll('.station')
        .data(nodesPerLine, function (d) { return d; });

    stations
        .enter()
      .append('line')
        .attr('class', function (d) { return 'station ' + d.replace('|', '-'); });

    stations
        .attr('x1', function (d) { return xScale(header[d][0]); })
        .attr('x2', function (d) { return xScale(header[d][0]); })
        .attr('y1', 0)
        .attr('y2', fullMareyHeight);

    // draw the tall time axis down the side
    var yAxis = d3.svg.axis()
      .tickFormat(function (d) { return moment(d).zone(5).format("h:mm A"); })
      .ticks(d3.time.minute, 15)
      .scale(timeScale)
      .orient("left");
    fullMareyForeground.appendOnce('g', 'y axis').call(yAxis);
    var lineMapping = d3.svg.line()
      .x(function(d) { return d[0]; })
      .y(function(d) { return d[1]; })
      .defined(function (d) { return d !== null; })
      .interpolate("linear");
    var mareyLines = fullMareyForeground.selectAll('.mareyline')
        .data(trips, function (d) { return d.trip; });

    if (!VIZ.ios) {
      fullMareyForeground.firstTime
          .onOnce('mouseover', 'path.mareyline', hoverTrain)
          .onOnce('mouseout', 'path.mareyline', unHoverTrain)
          .onOnce('click', 'path.mareyline', highlightTrain);
    }
    mareyLines
        .enter()
      .append('path')
        .attr('class', function (d) { return 'mareyline hoverable highlightable dimmable ' + d.line; });
    mareyLines
        .attr('transform', function (d) {
          if (!d.origY) { d.origY = yScale(d.stops[0].time); }
          return 'translate(0,' + d.origY + ')';
        })
        .attr('d', draw(xScale, yScale));
    mareyContainer.select('.fixed-right').on('mousemove', selectTime);
    mareyContainer.select('.fixed-right').on('mousemove.titles', updateTitle);
    var barBackground = fullMareyBackground.appendOnce('g', 'g-bar hide-on-ios');
    var barForeground = fullMareyForeground.appendOnce('g', 'g-bar hide-on-ios');
    barBackground.appendOnce('line', 'bar')
        .attr('x1', 1)
        .attr('x2', fullMareyWidth)
        .attr('y1', 0)
        .attr('y2', 0);
    barForeground.appendOnce('rect', 'text-background').firstTime
      .attr('x', 3)
      .attr('y', -14)
      .attr('width', 45)
      .attr('height', 12);
    barForeground.appendOnce('text', 'marey-time').firstTime
      .attr('dx', 2)
      .attr('dy', -4);
    timeDisplay = mareyContainer.selectAll('.marey-time');
    var bar = mareyContainer.selectAll("g.g-bar");

    // If a previous time was selected, then select that time again now
    if (!lastTime) {
      select(minUnixSeconds);
    }

    // on hover, show the station you are hovered on
    function updateTitle() {
      var pos = d3.mouse(fullMareyForeground.node());
      var x = pos[0];
      var station = stationXScaleInvert[Math.round(xScale.invert(x))];
      if (station) {
        highlightMareyTitle(station);
      }
    }

    // on hover, set the time that is displayed in the map glyph on the side
    function selectTime() {
      var pos = d3.mouse(fullMareyForeground.node());
      var y = pos[1];
      var x = pos[0];
      if (x > 0 && x < fullMareyWidth) {
        var time = yScale.invert(y);
        select(time);
      }
    }

    // actually set the time for the map glyph once the time is determined
    function select(time) {
      var y = yScale(time);
      bar.attr('transform', 'translate(0,' + y + ')');
      timeDisplay.text(moment(time * 1000).zone(5).format('h:mm a'));
      renderTrainsAtTime(time);
    }

    // Get a list of [x, y] coordinates for all train trips for
    // both the full Marey and the lined-up Marey
    function getPointsFromStop(xScale, yScale, d, relative) {
      var last = null;
      var stops = d.stops.map(function (stop) {
        // special case: place-jfk, place-nqncy -> place-jfk, place-asmnl (at same time), place-nqncy 
        // special case: place-nqncy, place-jfk -> place-nqncy, place-asmnl (at same time), place-jfk
        var result;
        if (last && last.stop === 'place-jfk' && stop.stop === 'place-nqncy') {
          result = [null, {stop: 'place-asmnl', time: last.time}, stop];
        } else if (last && last.stop === 'place-nqncy' && stop.stop === 'place-jfk') {
          result = [{stop: 'place-asmnl', time: stop.time}, null, stop];
        } else {
          result = [stop];
        }
        last = stop;
        return result;
      });
      var flattenedStops = _.flatten(stops);
      var startX = xScale(header[d.stops[0].stop + '|' + d.line][0]);
      var points = flattenedStops.map(function (stop) {
        if (!stop) { return null; }
        var y = yScale(stop.time) - yScale(flattenedStops[0].time);
        var x = xScale(header[stop.stop + '|' + d.line][0]);
        if (relative) {
          x -= startX;
        }
        return [x, y];
      });
      return points;
    }
    function draw(xScale, yScale, relative) {
      return function (d) {
        var points = getPointsFromStop(xScale, yScale, d, relative);
        return lineMapping(points);
      };
    }





    /* 4b. Render annotations for the full Marey
     *************************************************************/
    var annotationContainer = outerSvg.appendOnce('g', 'annotations')
        .attr('transform', 'translate(' + fullMareyMargin.left + ', ' + fullMareyMargin.top + ')');
    var annotations = annotationContainer.selectAll('.annotation').data(sideAnnotationData);
    annotations
        .enter()
      .append('g')
        .attr('class', 'annotation')
      .append('text');

    annotations.selectAll('text')
        .attr('id', function (d) { return d.id; })
        .text(function (d) { return d.text; })
        .call(VIZ.wrap, fullMareyMargin.right - 20);

    var connections = annotations.selectAll('.annotation-connection')
        .data(function (d) { return (d.connections || []).map(function (c) { c.parent = d; return c; }); });

    connections.enter()
      .append('path')
        .attr('class', 'annotation-connection');

    // Draw annotation lines
    connections
        .attr('d', function (connection) {
          var station = network.nodes.find(function (station) { return new RegExp(connection.station, 'i').test(station.name); });
          var annotationY = yScale(moment(connection.parent.time + ' -0500', 'YYYY/MM/DD HH:m ZZ').valueOf() / 1000) - 4;
          var connectionStartY = yScale(moment(connection.start + ' -0500', 'YYYY/MM/DD HH:m ZZ').valueOf() / 1000);
          var connectionEndY = yScale(moment(connection.stop + ' -0500', 'YYYY/MM/DD HH:m ZZ').valueOf() / 1000);
          var connectionSingleY = yScale(moment(connection.time + ' -0500', 'YYYY/MM/DD HH:m ZZ').valueOf() / 1000);
          var connectionX = xScale(header[station.id + '|' + connection.line][0]);
          return 'M' + [
            [
              [fullMareyWidth + 10, annotationY],
              [
                connection.time ? connectionX : connectionX + 3,
                connection.time ? connectionSingleY : (connectionStartY + connectionEndY) / 2
              ]
            ],
            !connection.time ? [
              [connectionX, connectionStartY],
              [connectionX + 3, connectionStartY],
              [connectionX + 3, connectionEndY],
              [connectionX, connectionEndY]
            ] : null
          ].filter(function (d) { return !!d; }).map(function (segment) { return segment.map(function (point) { return point.map(Math.round).join(','); }).join('L'); }).join('M');
        });

    annotationContainer.selectAll('text, text tspan')
        .attr('x', fullMareyWidth + 15)
        .attr('y', function (d) { return yScale(moment(d.time + ' -0500', 'YYYY/MM/DD HH:m ZZ').valueOf() / 1000); });


    // add links to annotations if they are set
    // find the text elements that need links
    var annotationsWithLinks = annotationContainer.selectAll('text tspan')
      .filter(function (d) {
        if (d.link && d3.select(this).text().indexOf(d.link.text) > -1) {
          return this;
        }
        return null;
      });

    // clear previous underlines
    annotationContainer.selectAll('polyline').remove();

    annotationsWithLinks.each(function (d) {
      // split into three parts, start text, link, end text
      var thisSelection = d3.select(this);
      var text = thisSelection.text();
      thisSelection.text(text.substring(0, text.indexOf(d.link.text)));
      var endText = text.substring(text.indexOf(d.link.text) + d.link.text.length, text.length);

      var parentNode = d3.select(this);
      var offset = parentNode.node().getComputedTextLength();
      var clicked = false;
      var linkNode = parentNode.append('tspan')
        .text(d.link.text)
        .attr('class', 'click-link')
        .on('click', function (d) {
          clicked = !clicked;
          if (clicked) {
            highlightTrain({'trip': d.link.trip });
          } else {
            highlightTrain(null);
          }
        })
        .on('mouseover', function (d) {
          if (d.link.trip !== highlightedTrip && clicked) {
            clicked = false;
          }
          highlightTrain({'trip': d.link.trip });
          underline.style('stroke-dasharray', '3,0');
        })
        .on('mouseout', function () {
          if (!clicked) {
            highlightTrain(null);
          }
          underline.style('stroke-dasharray', '3,3');
        });

      parentNode.append('tspan')
        .text(endText);

      // add the underline
      var annoationGElement = this.parentNode.parentNode;
      var underline = d3.select(annoationGElement).append('polyline')
         .attr('class', 'click-link')
         .attr('points', function() {
          var textStart = offset + parseInt(parentNode.attr('x'), 10);
          var textEnd = textStart + linkNode.node().getComputedTextLength();
          var yPos = parseInt(parentNode.attr('y'), 10) + 4;
          var path = textStart +','+yPos;
          path = path+ ' '+textEnd + ',' +yPos;
          return path;
        });
    });





    /* 4c. Render the lined-up Marey
     *************************************************************/
    resetScale(linedUpYScale);
    resetScale(linedUpXScale);
    resetScale(linedUpTimeScale);
    linedUpMareyXScaleRatioFromFullMarey = originalLinedUpMareyXScaleRatioFromFullMarey;
    var linedUpOuterWidth = Math.min($('.lined-up-marey-container .container').width(), maxLinedUpMareyChartWidth);
    var linedUpWidth = linedUpOuterWidth - linedUpMargin.left - linedUpMargin.right;
    linedUpOuterHeight = linedUpOuterWidth * 300 / 780;
    linedUpHeight = linedUpOuterHeight - linedUpMargin.top - linedUpMargin.bottom;
    linedUpDayScale.range([0, linedUpHeight]);
    linedUpYScale.range([0, linedUpHeight]);
    var linedUpSvg = d3.select('.lined-up-marey').appendOnce('svg', 'lined-up')
        .attr('width', linedUpOuterWidth)
        .attr('height', linedUpOuterHeight);
    var linedUp = linedUpSvg.appendOnce('g', 'g');
    var linedUpOverlay = linedUpSvg.appendOnce('g', 'overlay');
    linedUp.firstTime.attr('transform', 'translate(' + linedUpMargin.left + ',' + linedUpMargin.top + ')');
    linedUpOverlay.firstTime.attr('transform', 'translate(' + linedUpMargin.left + ',' + linedUpMargin.top + ')');
    linedUpXScale.range(linedUpMareyLineEndPositions.map(function (d) { return d * linedUpWidth; }));
    var linedUpXPlacementScale = d3.scale.ordinal()
        .domain(linedUpMareyStartingStations)
        .range(linedUpMareyMidpointLabelPositions.map(function (d) { return d * linedUpWidth; }));
    linedUpYScale.range([0, linedUpHeight]);
    linedUpTimeScale.range([0, linedUpHeight]);

    var linedUpDayAxis = d3.svg.axis()
      .scale(linedUpDayScale)
      .tickFormat(d3.time.format.utc("%-I %p"))
      .orient('left')
      .ticks(d3.time.hour, 2);

    var brushAxis = linedUp.appendOnce('g', 'time axis')
      .attr('transform', 'translate(-40,0)')
      .call(linedUpDayAxis);

    brushAxis.on('mousemove.brush', function () {
      var y = d3.mouse(brushAxis.node())[1];
      var time = linedUpDayScale.invert(y);
      brush.extent([time.getTime() - 60 * 60 * 1000, time.getTime() + 60 * 60 * 1000]);
      d3.selectAll('g.brush').call(brush).on('mousedown.brush', null).on('touchstart.brush', null);
      brushed();
    });

    brushAxis.appendOnce("g", "brush").firstTime
        .call(brush)
        .call(brushed)
        .on('mousedown.brush', null).on('touchstart.brush', null)
      .selectAll("rect")
        .attr("x", -45)
        .attr("width", 50);


    var linedUpAxis = d3.svg.axis()
      .tickFormat(function (d) { return Math.round(d / 1000 / 60) + 'm'; })
      .innerTickSize(-linedUpWidth)
      .outerTickSize(0)
      .ticks(d3.time.minutes, 10)
      .scale(linedUpTimeScale)
      .orient("left");

    var axis = linedUp.appendOnce('g', 'y axis')
      .call(linedUpAxis);

    axis.appendOnce('text', 'label light-markup')
      .attr('transform', 'rotate(90)translate(' + (linedUpHeight/2) + ',-5)')
      .attr('text-anchor', 'middle')
      .text('minutes since start of trip');

    linedUp.appendOnce('text', 'top-label light-markup')
      .text('Starting Station')
      .attr('text-anchor', 'middle')
      .attr('x', linedUpWidth /2)
      .attr('y', -24);
    linedUp.appendOnce('text', 'bottom-label light-markup')
      .text('Ending Station')
      .attr('text-anchor', 'middle')
      .attr('x', linedUpWidth /2)
      .attr('y', linedUpHeight + 30);
    var stationHeaders = linedUp.selectAll('.station-header')
        .data(linedUpMareyStartingStations.filter(function (d) { return linedUpMareyStartingStationLabels[d].text; }));
    stationHeaders
        .enter()
      .append('g')
        .attr('class', 'station-header')
      .append('text')
        .attr('text-anchor', function (d) {
          return linedUpMareyStartingStationLabels[d].anchor;
        })
        .attr('dx', function (d) {
          return linedUpMareyStartingStationLabels[d].anchor === 'start' ? -4 : 4;
        })
        .attr('dy', -2)
        .text(function (d) {
          return linedUpMareyStartingStationLabels[d].text;
        });
    function placeStationHeader(selection) {
      selection
          .attr('transform', function (d) {
            return 'translate(' + linedUpXScale(d) + ',-10)';
          });
    }
    stationHeaders.call(placeStationHeader);

    var linedUpMareyContainer = linedUp.appendOnce('g', 'mareylinecontainer');
    linedUpMareyContainer.firstTime.attr('clip-path', 'url(#mareyClip)');
    linedUp
      .appendOnce('defs', 'defs')
      .appendOnce('clipPath', 'clip')
        .attr('id', 'mareyClip')
      .appendOnce('rect', 'clipRect')
        .attr('width', linedUpWidth)
        .attr('height', linedUpHeight);

    var linedUpMareyLines = linedUpMareyContainer.selectAll('.mareyline')
        .data(linedUpTrips, function (d) { return d.trip; });

    var t = null;
    if (!VIZ.ios) {
      linedUp
          .off('mouseover mouseout')
          .onOnce('mouseover', 'path', function (d) {
            clearTimeout(t);
            highlightLinedUpMarey(d);
            d3.select(this).moveToFront();
          })
          .onOnce('mouseout', 'path', function () {
            clearTimeout(t);
            t = setTimeout(unhighlightLinedUpMarey, 100);
          });
    }

    linedUpMareyLines
        .enter()
      .append('path')
        .attr('class', function (d) { return 'mareyline ' + d.line; });
    linedUpMareyLines.call(drawLinedUpLines);


    function modifiedXScale(d) {
      return linedUpMareyXScaleRatioFromFullMarey * xScale(d) * linedUpWidth / fullMareyWidth;
    }

    // use the same utility that draws the marey lines in the full marey diagram to 
    // render them in the lined-up marey diagram
    function drawLinedUpLines(lines) {
      lines
          .attr('transform', function (d) {
            var firstX = linedUpXScale(d.stops[0].stop);
            return 'translate(' + firstX + ',0)';
          })
          .attr('d', draw(modifiedXScale, linedUpYScale, true));
    }
    // Draw additional details when user hovers over a lined-up Marey line
    function highlightLinedUpMarey(d) {
      if (frozen) { return; }
      unhighlightLinedUpMarey();
      highlightedLinedUpMarey = d;
      linedUp.appendOnce('text', 'mareyannotation');
      var last = d.stops[d.stops.length - 1];
      var first = d.stops[0];
      var xEnd = linedUpXPlacementScale(first.stop);
      var xBegin = linedUpXScale(first.stop);
      var y = linedUpYScale((last.time - first.time));
      linedUp.appendOnce('text', 'mareyannotation start')
        .attr('x', xBegin + (linedUpMareyStartingStationLabels[first.stop].anchor === 'start' ?  5 : -5))
        .attr('y', -2)
        .style('text-anchor', linedUpMareyStartingStationLabels[first.stop].anchor)
        .text(moment(first.time * 1000).zone(5).format('h:mma'));
      linedUp.appendOnce('text', 'mareyannotation clickme')
        .attr('x', xEnd)
        .attr('y', 16)
        .style('text-anchor', 'middle')
        .classed('light-markup', true)
        .text('Click for details');
      linedUp.appendOnce('text', 'mareyannotation end')
        .attr('x', xEnd)
        .attr('y', y + 15)
        .style('text-anchor', 'middle')
        .text(moment(last.time * 1000).zone(5).format('h:mma'));
      linedUp.appendOnce('text', 'mareyannotation time')
        .attr('x', xEnd)
        .attr('y', y + 30)
        .style('text-anchor', 'middle')
        .text(Math.round((last.time - first.time) / 60) + 'm');
      linedUpOverlay.selectAll('g.mareystops')
          .data([d])
          .enter()
        .append('g')
          .attr('class', 'mareystops')
          .call(drawStops, modifiedXScale, linedUpYScale);
      linedUpOverlay.selectAll('g.mareynames')
          .data([d])
          .enter()
        .append('g')
          .attr('class', 'mareynames');

      linedUp.selectAll('.mareyline').classed({
        highlight: function (other) { return other === d; },
        dimmed: function (other) { return other !== d; }
      });
    }
    function unhighlightLinedUpMarey() {
      if (!highlightedLinedUpMarey || frozen) { return; }
      highlightedLinedUpMarey = null;
      linedUp.selectAll('.mareyannotation').remove();
      linedUpOverlay.selectAll('*').remove();
      linedUp.selectAll('.mareyline').classed({
        highlight: false,
        dimmed: false
      });
    }





    /* 4d. Set up listener to zoom in on a particular trip of the lined-up marey when user clicks on it
     *************************************************************/
    var TRANSITION_DURATION = 1000;
    if (!VIZ.ios) {
      d3.selectAll('.lined-up-marey')
          .on('click.toggle', function () { freezeHighlightedMarey(null, !frozen); });
    }
    // initialize to not frozen
    freezeHighlightedMarey(highlightedLinedUpMarey, frozen, true);

    function freezeHighlightedMarey(d, freeze, now) {
      var duration = now ? 0 : TRANSITION_DURATION;
      highlightedLinedUpMarey = highlightedLinedUpMarey || d;
      resetScale(linedUpTimeScale);
      resetScale(linedUpYScale);
      resetScale(linedUpXScale);
      linedUpMareyXScaleRatioFromFullMarey = originalLinedUpMareyXScaleRatioFromFullMarey;
      frozen = freeze;
      if (highlightedLinedUpMarey && frozen) {
        // transition all of the pieces to zoom in on just the one trip
        // also add labels and times for each stop along the trip
        var max = 1.1*(highlightedLinedUpMarey.end - highlightedLinedUpMarey.begin);
        tempSetDomain(linedUpTimeScale, [0, max * 1000]);
        var ratio = max / linedUpYScale.domain()[1];
        tempSetDomain(linedUpYScale, [0, max]);
        var start = highlightedLinedUpMarey.stops[0];
        var end = highlightedLinedUpMarey.stops[highlightedLinedUpMarey.stops.length - 1];

        var startX = linedUpXScale(start.stop);
        var endX = startX + xScale(header[end.stop + '|' + highlightedLinedUpMarey.line][0]) - xScale(header[start.stop + '|' + highlightedLinedUpMarey.line][0]);

        var dir = linedUpMareyStartingStationLabels[start.stop].anchor;
        var conversionScale = d3.scale.linear()
            .domain([startX, endX])
            .range(dir === 'start' ? [50, linedUpWidth - 50] : [linedUpWidth - 50, 50]);
        tempSetRange(linedUpXScale, linedUpXScale.range().map(conversionScale));
        linedUpMareyXScaleRatioFromFullMarey = originalLinedUpMareyXScaleRatioFromFullMarey * 1.5 / ratio;
        linedUp.selectAll('.mareyannotation').remove();
        (now ? stationHeaders : stationHeaders.transition().duration(duration))
          .call(placeStationHeader)
          .style('opacity', 0);
      } else {
        (now ? stationHeaders : stationHeaders.transition().duration(duration))
          .call(placeStationHeader)
          .style('opacity', 1);
      }
      linedUpOverlay.selectAll('.mareynames').call(drawLabels, modifiedXScale, linedUpYScale);
      axis.transition().duration(duration).call(linedUpAxis);
      linedUpOverlay.selectAll('g.mareystops').call(drawStops, modifiedXScale, linedUpYScale, !now);
      (now ? linedUpMareyLines : linedUpMareyLines.transition().duration(duration)).call(drawLinedUpLines);
      unhighlightLinedUpMarey();
    }
    // draw the time and station name labels on a selected trip
    function drawLabels(selection, xScale, yScale) {
      var items = selection
          .selectAll('.text')
          .data(function (d) {
            var startX = xScale(header[d.stops[0].stop + '|' + d.line][0]);
            var result = d.stops.map(function (stop) {
              if (!stop) { return null; }
              var y = yScale(stop.time) - yScale(d.stops[0].time);
              var x = xScale(header[stop.stop + '|' + d.line][0]) - startX;
              return {stop: stop, x: x, y: y, dytop: -1, dybottom: 9};
            });

            // prevent labels from overlapping eachother, iteratively push up/down until no overlap
            var last = -10;
            _.sortBy(result, 'y').forEach(function (d) {
              last += 9;
              if (last > d.y + d.dybottom) {
                d.dybottom = last - d.y;
              }
              last = d.y + d.dybottom;
            });
            last = 1000;
            _.sortBy(result, 'y').reverse().forEach(function (d) {
              last -= 9;
              if (last < d.y + d.dytop) {
                d.dytop = last - d.y;
              }
              last = d.y + d.dytop;
            });
            return result;
          }, function (d, i) { return i; });
      var labels = items.enter().append('g')
          .attr('class', 'text');
      labels.append('text')
          .attr('dx', function () { return linedUpMareyStartingStationLabels[highlightedLinedUpMarey.stops[0].stop].anchor === 'start' ? 2 : -2; })
          .attr('dy', function (d) { return d.dytop; })
          .text(function (d) {
            return VIZ.fixStationName(idToNode[d.stop.stop].name);
          })
          .attr('text-anchor', function () { return linedUpMareyStartingStationLabels[highlightedLinedUpMarey.stops[0].stop].anchor; });
      labels.append('text')
          .attr('dx', function () { return linedUpMareyStartingStationLabels[highlightedLinedUpMarey.stops[0].stop].anchor === 'start' ? -2 : 2; })
          .attr('dy', function (d) { return d.dybottom; })
          .text(function (d) {
            return moment(d.stop.time * 1000).zone(5).format('h:mma');
          })
          .attr('text-anchor', function () { return linedUpMareyStartingStationLabels[highlightedLinedUpMarey.stops[0].stop].anchor === 'start' ? 'end' : 'start'; });

      items
          .attr('transform', function (d) {
            var stop0 = highlightedLinedUpMarey.stops[0].stop;
            var firstX = linedUpXScale(stop0);
            return 'translate(' + (d.x + firstX) + ',' + d.y + ')';
          })
          .style('opacity', 0);

      items.transition().delay(TRANSITION_DURATION - 300).duration(300)
        .style('opacity', 1);
    }
    // place a dot for each stop on the line
    function drawStops(selection, xScale, yScale, trans) {
      var items = selection
          .selectAll('.point')
          .data(function (d) {
            var result = getPointsFromStop(xScale, yScale, d, true).filter(function (stop) { return !!stop; });
            var offset = linedUpXScale(d.stops[0].stop);
            result.forEach(function (stop) { stop.offset = offset; });
            return result;
          }, function (d, i) { return i; });
      items.enter()
        .append('circle')
          .attr('r', 2)
          .attr('class', 'point');

      (trans ? items.transition().duration(TRANSITION_DURATION) : items)
          .attr('cx', function (d) { return d.offset + d[0]; })
          .attr('cy', function (d) { return d[1]; });
    }
  }




  /* 5. Add interaction behavior with surrounding text
   *************************************************************/
  // Setup the links in text that scroll to a position in the marey diagram
  // <a href="#" data-dest="id of dist dom element to scroll to" class="scrollto">...
  fixedLeft.selectAll('.scrollto')
    .on('click', function () {
      var id = d3.select(this).attr('data-dest');
      var $element = $("#" + id);
      $('body, html').animate({scrollTop:$element.position().top}, '300', 'swing');
      d3.event.preventDefault();
    });

  // Setup the links in text that highlight a particular line
  // <a href="#" data-line="color of line to highlight" class="highlight">...
  fixedLeft.selectAll('.highlight')
    .on('click', function () {
      d3.event.preventDefault();
    })
    .on('mouseover', function () {
      var line = d3.select(this).attr('data-line');
      var others = _.without(['red', 'orange', 'blue'], line);
      others.forEach(function (other) {
        mareyContainer.selectAll('.' + other + ', .' + other + '-dimmable, circle.middle').classed('line-dimmed', true);
      });
    })
    .on('mouseout', function () {
      mareyContainer.selectAll('.line-dimmed').classed('line-dimmed', false);
    });

  // Setup the links in text that highlight part of the Marey diagram
  // <a href="#" data-lo="start hour of day" data-hi="end hour of day" class="lined-up-highlight">...
  d3.selectAll('.lined-up-highlight')
    .on('click', function () {
      d3.event.preventDefault();
    })
    .on('mouseover', function () {
      var lo = +d3.select(this).attr('data-lo');
      var hi = +d3.select(this).attr('data-hi');
      brush.extent([lo * 60 * 60 * 1000, hi * 60 * 60 * 1000]);
      d3.selectAll('g.brush').call(brush).on('mousedown.brush', null).on('touchstart.brush', null);
      brushed();
    });





  /* Bootstrap the Visualization - and re-render on width changes
   *************************************************************/
  VIZ.watchFixedRight(function (width) {
    showingMap = true;
    renderMarey(marey, width);
    renderTrainsAtTime();
  });
  renderSideMap(mapGlyphSvg, 300, 800);





  /* Miscellaneous Utilities
   *************************************************************/
  function highlight() {
    mareyContainer.classed('highlight-active', !!highlightedTrip);
    mareyContainer.selectAll('.highlightable')
      .classed('active', function (d) { return d.trip === highlightedTrip; });
  }
  function highlightTrain(d) {
    if (d === null) {
      highlightedTrip = null;
    } else {
      highlightedTrip = d.trip;
    }
    highlight();
    d3.event.stopPropagation();
  }
  function unHoverTrain() {
    hoveredTrip = null;
    hover();
  }
  function hoverTrain(d) {
    hoveredTrip = d.trip;
    hover();
  }
  function brushed() {
    var lo = brush.extent()[0] / 1000;
    var hi = brush.extent()[1] / 1000;
    d3.selectAll('.lined-up .mareyline')
        .style('opacity', function (d) {
          return lo < d.secs && hi > d.secs ? 0.7 : 0.1;
        });
  }
  function hover() {
    d3.selectAll('.hoverable')
      .classed('hover', function (d) { return d.trip === hoveredTrip; });
  }
  function highlightMareyTitle(title, lines) {
    var titles = {};
    titles[title] = true;
    if (lines) {
      lines.forEach(function (line) { titles[title + "|" + line] = true; });
    } else if (title) {
      titles[title] = true;
      titles[title.replace(/\|.*/, '')] = true;
    }
    var stationLabels = marey.selectAll('text.station-label');
    stationLabels.style('display', function (d) {
      var display = end[d] || titles[d];
      return display ? null : 'none';
    });
    stationLabels.classed('active', function (d) {
      return titles[d.id ? d.id : d];
    });
  }

  function placeWithOffset(from, to, ratio) {
    var fromPos = idToNode[from.stop].pos;
    var toPos = idToNode[to.stop].pos;
    var midpoint = d3.interpolate(fromPos, toPos)(ratio);
    var angle = Math.atan2(toPos[1] - fromPos[1], toPos[0] - fromPos[0]) + Math.PI / 2;
    return [midpoint[0] + Math.cos(angle) * mapGlyphTrainCircleRadius, midpoint[1] + Math.sin(angle) * mapGlyphTrainCircleRadius ];
  }
  function tempSetDomain(scale, domain) {
    scale.oldDomain = scale.oldDomain || scale.domain();
    scale.domain(domain);
  }
  function tempSetRange(scale, range) {
    scale.oldRange = scale.oldRange || scale.range();
    scale.range(range);
  }

  function resetScale(scale) {
    if (scale.oldDomain) { scale.domain(scale.oldDomain); }
    if (scale.oldRange) { scale.range(scale.oldRange); }
    scale.oldDomain = null;
    scale.oldRange = null;
  }
});