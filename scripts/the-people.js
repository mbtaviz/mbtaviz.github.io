/**
 * the-people.js
 *
 * Copyright 2014 Michael Barry & Brian Card.  MIT open-source lincense.
 *
 * Display turnstile heatmaps, table, and map for "The People" section of the
 * visualization in the following stages:
 *
 * 1. Load the required data and do some pre-processing
 * 2. Render the overall heatmap for entrances/exits across all stations during the month
 * 3. Render the map-glyph for this section
 * 4. Render the bar chart with embedded heatmaps
 * 5. Connect hovering/clicking on linked text to the charts
 * 6. Draw color keys
 *
 * Interaction is added to all elements throughout as they are rendered.
 */





/* 1. Load and pre-process the data
 *************************************************************/

VIZ.requiresData([
  'json!data/turnstile-heatmap.json',
  'json!data/station-network.json',
  'json!data/spider.json',
  'json!data/turnstile-gtfs-mapping.json'
], true).progress(function (percent) {
  "use strict";
  d3.selectAll(".turnstile-all, .turnstile-total").text('Loading train data... ' + percent + '%').style('text-align', 'center');
}).onerror(function () {
  "use strict";
  d3.selectAll(".turnstile-all, .turnstile-total").text('Error loading train data').style('text-align', 'center');
}).done(function (turnstile, network, spider, turnstileToGtfs) {
  "use strict";

  // done loading the data, remove loading indicator
  d3.selectAll(".section-people").classed('loading', false);
  d3.selectAll(".turnstile-all, .turnstile-total").text('');

  var gtfsToTurnstile = _.invert(turnstileToGtfs);
  var averageSecondsBetweenStops = {};
  var offset = {};
  var numAnnotationLinesInTable = {};
  turnstile.stops.forEach(function (stop) {
    averageSecondsBetweenStops[turnstileToGtfs[stop.name]] = stop.entrancesByType.all;
  });
  var stopToLine = {};
  network.nodes.forEach(function (data) {
    data.x = spider[data.id][0];
    data.y = spider[data.id][1];
  });
  network.links.forEach(function (link) {
    link.source = network.nodes[link.source];
    link.target = network.nodes[link.target];
    link.source.links = link.source.links || [];
    link.target.links = link.target.links || [];
    link.target.links.splice(0, 0, link);
    link.source.links.splice(0, 0, link);
    stopToLine[link.target.id] = stopToLine[link.target.id] || {};
    stopToLine[link.source.id] = stopToLine[link.source.id] || {};
    stopToLine[link.target.id][link.line] = true;
    stopToLine[link.source.id][link.line] = true;
  });

  // Annotations to display below turnstile heatmaps
  // It would be great to have more filled in!!
  var stationDetails = {
    // "Airport": "",
    // "Aquarium": "",
    // "Beachmont": "",
    // "Bowdoin": "",
    // "Government Center": "",
    // "Maverick": "",
    // "Orient Heights": "",
    // "Revere Beach": "",
    "Suffolk Downs": "Suffolk Downs is the least-busy station and experiences very little traffic throughout the day.  It is one of the few stations with no bus connections.",
    // "Wonderland": "",
    // "Wood Island": "",
    // "Back Bay": "",
    // "Chinatown": "",
    "Community College": "Notice how the class schedule causes spikes in ridership every 3 hours and how President's Day February 17 and snow days on Wednesday February 5 and Thursday afternoon February 13 cause a decrease in ridership.",
    // "Forest Hills": "",
    // "Green Street": "",
    // "Haymarket": "",
    // "Jackson Square": "",
    // "Malden Center ": "",
    // "Mass Ave": "",
    "North Station": "North Stations experiences a lot of traffic spikes in the evening, since it is right by the TD Garden Arena, home of the Celtics and Bruins",
    // "Oak Grove": "",
    // "Roxbury Crossing": "",
    // "Ruggles": "",
    // "Stony Brook": "",
    // "Sullivan Square": "",
    // "Tufts Medical Center": "",
    // "Wellington ": "",
    // "State Street": "",
    // "Alewife": "",
    // "Andrew Square": "",
    // "Ashmont": "",
    // "Braintree": "",
    // "Broadway": "",
    // "Central Square": "",
    // "Charles MGH": "",
    // "Davis Square": "",
    // "Fields Corner": "",
    "Harvard": "As the original end of the Red Line, Harvard is the busiest station and has a constant stream of people getting on and off throughout the day.  The adjoining Harvard Bus Tunnel also has connections to five of the fifteen busiest MBTA bus routes.",
    // "JFK/U Mass": "",
    // "Kendall Square": "",
    // "North Quincy": "",
    // "Park Street": "",
    // "Porter Square": "",
    // "Quincy Adams": "",
    // "Quincy Center": "",
    // "Savin Hill": "",
    // "Shawmut": "",
    "South Station": "In the heart of Boston's Financial District, South Station is a destination for people to go to work, but it is also at the end of the commuter rail and people who take that into the city must go through a turnstile after getting off the commuter rail to get to other parts of the city",
    // "Wollaston": "",
    "Downtown Crossing": "Like South Station, Downtown Crossing is primarily a work destination, but it does not experience the commuter-rail bump in entrances in the morning"
  };



  /* 2. Render the overall heatmap for entrances/exits across
   *    all stations during the month
   *************************************************************/
  var hourWidth = 3;
  var hourHeight = 8;
  var dayWidth = 24 * hourWidth;
  var heatmapWidth = dayWidth * 7.5 + 15;
  var heatmapHeight = hourHeight * (1 + 4 * 2) + 40;
  var outerHeatMapMargin = {top: 15, right: 0, bottom: 0, left: 0};
  var heatMapMargin = {top: 10, right: 0, bottom: 0, left: 25};
  var dayMargin  = {top: 0, right: 2, bottom: 2, left: 0};

  // When a user hovers over "holidays" and "weekends" in the text, this tells what week and day they refer to
  // entries are in [week, day] format
  var heatmapHighlights = {
    'holidays': [
      [3, 1]
    ],
    'snow': [
      [1, 3],
      [2, 4]
    ]
  };
  VIZ.createClipRect('rowTurnstileClip')
    .attr('y', -3)
    .attr('x', -20)
    .attr('width', heatmapWidth + 40)
    .attr('height', heatmapHeight * 2);

  var allStationHeatmapSvg = d3.select('.turnstile-total').append('svg');
  var allStationHeatmap = allStationHeatmapSvg.append('g');

  allStationHeatmapSvg
      .attr('width', heatmapWidth)
      .attr('height', heatmapHeight);

  var tip = d3.tip()
      .attr('class', 'd3-tip text-center')
      .offset([-10, 0])
      .html(function(d) { return getTextForRollover(d, d3.select(this).classed('entrances') ? 'entrances' : 'exits'); });

  allStationHeatmap
    .append('g', 'outer-g-container')
    .attr('transform', "translate(" + outerHeatMapMargin.left + "," + outerHeatMapMargin.top + ")")
    .call(drawStop, 'All Stations', turnstile.all, turnstile.all, true)
    .call(tip);

  // For responsive sizing, change the transform=scale(...) attribute of the heatmap based on the
  // width of the window.  This scales up everything including line widths, text, etc.. which we
  // think is OK because it starts on the small side to begin with
  var turnstileScaleScale = d3.scale.linear()
    .clamp(true)
    .domain([ 0, VIZ.BREAK_SM, VIZ.BREAK_SM, VIZ.BREAK_MD, VIZ.BREAK_MD, VIZ.BREAK_LG, VIZ.BREAK_LG, VIZ.BREAK_LG + 1])
    .range([1.1,          1.1,          1.2,          1.2,          1.2,          1.2,          1.3,              1.3]);

  VIZ.watchSize(function (width) {
    var scale = turnstileScaleScale(width);
    allStationHeatmapSvg
        .attr('width', heatmapWidth * scale)
        .attr('height', heatmapHeight * scale);
    allStationHeatmap.attr('transform', 'scale(' + scale + ')');
  });

  var highlightGroups = allStationHeatmap.selectAll('.highlight-group')
      .data([2, 7])
      .enter()
    .append('g')
      .attr('class', function (d) { return 'highlight-group num' + d; })
      .attr('transform', function (d) { return 'translate(' + (heatMapMargin.left + 15) + ',' + (d * (dayMargin.bottom + hourHeight) - 6) + ')'; });

  // draw a detailed heatmap for a stop - used for both total and indivual stations
  function drawStop(container, name, stopData, aggregates, isAllStationHeatmap) {
    var daysOfWeek = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat'];
    var svg = container.append('g').attr('class', 'stop-heatmap');

    // draw one grid for entrances or exits with axis labels
    // and a heat map for values.  Datatype can be either
    // 'entrances' or 'exits'
    var dayLabels = svg.selectAll('.dayLabel')
      .data(daysOfWeek)
      .enter()
      .append('g')
      .attr('class', 'xAxis');

    // Only add labels to all-station turnstile heatmap
    if (isAllStationHeatmap) {
      dayLabels.append('text')
        .attr('class', 'dayLabel')
        .text(function (d) { return d; })
        .attr('dx', dayWidth / 2)
        .attr('dy', 0)
        .style('text-anchor', 'middle');
    }

    var hourLabelsScale = d3.scale.ordinal()
      .domain(['6am', '12pm', '6pm'])
      .rangePoints([0, dayWidth], 2.0);
    var xAxis = d3.svg.axis()
      .scale(hourLabelsScale)
      .orient('bottom')
      .tickSize(-3);
    dayLabels
      .attr('transform', function(d, i) { return 'translate('+(3 + heatMapMargin.left + (dayWidth + dayMargin.right) * i) +',0)'; })
      .call(xAxis);

    var stop = svg.append('g')
      .attr('transform', 'translate('+heatMapMargin.left+','+heatMapMargin.top+")");

    var colorScale = d3.scale.linear()
      .domain([aggregates.min, aggregates.mean || aggregates.max * 0.9, aggregates.max])
      .range(['white', 'black', 'red']);

    var positionScale = d3.scale.ordinal()
     .rangeBands([0, dayWidth], 0, 0)
     .domain(d3.range(0, 24));

    // draw the heat map
    ['entrances', 'exits'].forEach(function (dir, i) {
      stop.selectAll('.' + dir)
        .data(stopData.times.filter(function (d) { return !!d; }))
        .enter().append('rect')
        .attr('class', function (d) {
          return 'highlight-dimmable ' + dir + ' ' + classify(d);
        })
        .attr('x', function(d) { return (dayWidth + dayMargin.right) * day(d) + positionScale(hour(d)); })
        .attr('y', function(d) { return (hourHeight + dayMargin.bottom)* (week(d) + i * 5); })
        .attr('width', hourWidth)
        .attr('height', hourHeight)
        .attr('fill', function(d) { return colorScale(d[dir]); });
    });

    stop
      .append('text')
        .attr('x', 0)
        .attr('dy', -3)
        .attr('text-anchor', 'end')
        .attr('class', 'weeklabel light-markup small')
        .text('Week');
    stop.selectAll('.grp')
        .data([0, 1])
        .enter()
      .append('g')
        .attr('class', 'grp')
        .attr('transform', function (d) { return 'translate(0,' + (hourHeight + dayMargin.bottom)*(d * 5) + ')'; })
        .selectAll('.weeklabel')
        .data([0, 1, 2, 3])
        .enter()
      .append('text')
        .attr('class', 'weeklabel light-markup small')
        .attr('x', -3)
        .attr('dy', 6)
        .attr('text-anchor', 'end')
        .attr('y', function(d) { return (hourHeight + dayMargin.bottom)* d; })
        .text(function (d) { return (d + 1); });

    svg.append('text')
      .attr('class', 'groupLabel light-markup small')
      .attr('transform', 'translate(' + (heatmapWidth - 10) + ',' + (hourHeight*3.5) + ')rotate(90)')
      .text('entrances')
      .style('text-anchor', 'middle');

    svg.append('text')
      .attr('class', 'groupLabel light-markup small')
      .attr('transform', 'translate(' + (heatmapWidth - 10) + ',' + (hourHeight * 10) + ')rotate(90)')
      .text('exits')
      .style('text-anchor', 'middle');

    if (!VIZ.ios) {
      svg
        .onOnce('mouseover', 'rect', function (d) {
          clearTimeout(debounceTimeout);
          svg.selectAll('rect').classed('hover', function (other) {
            return d.day === other.day && d.week === other.week && d.hour === other.hour;
          });
          tip
            .direction('w')
            .offset([-3, -12]);
          tip.show.call(this, d);

          // when a user hovers over a heatmap embedded in the station-breakdown barchart
          // re-render the circles in the map glyph based on the time the user hovers
          // over and whether they are hovering over entrances or exits
          if (!isAllStationHeatmap) {
            var updatedSizes = {};
            var time = VIZ.hourToAmPm((d.hour) % 24);
            var timePlusOne = VIZ.hourToAmPm((d.hour + 1) % 24);
            var type = d3.select(this).classed('entrances') ? 'entrances' : 'exits';
            turnstile.stops.forEach(function (stop) {
              var datum = stop.times[d.i];
              updatedSizes[turnstileToGtfs[stop.name]] = datum ? datum[type] : 0;
            });
            d3.selectAll('.section-people .glyph circle')
              .attr('r', function (d) { return perHourSizeScale(updatedSizes[d.id]); });
            var day = moment(d.time).zone(5).format('ddd MMM D');
            drawMapKey([0, 40, 82], perHourPerMinuteSizeScale, type + ' on ' + day + ' from ' + time + ' to ' + timePlusOne, 'per minute');
          }
        })
        .onOnce('mouseout', 'rect', function (d) {
          svg.selectAll('rect').classed('hover', false);
          tip
            .direction('n')
            .offset([-10, 0]);
          tip.hide.call(this, d);
          clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(resetMapKey, debounceDelayMs);
        });
    }
  }


  


  /* 3. Render the map-glyph for this section
   *************************************************************/
  var sizeScale = d3.scale.linear()
      .domain(d3.extent(d3.values(averageSecondsBetweenStops)))
      .range([2, 7]);
  var perHourSizeScale = d3.scale.sqrt()
      .domain([0, turnstile.max])
      .range([2, 7]);
  var perHourPerMinuteSizeScale = d3.scale.sqrt()
      .domain([0, turnstile.max / 60])
      .range([2, 7]);
  d3.select('.section-people .glyph').append('svg').call(drawMap);
  VIZ.watchFixedLeft(function (width, narrow) {
    d3.select('.section-people .fixed-left').style('margin-left', narrow ? null : ((width - 300) + 'px'));
  });
  
  resetMapKey();


  // routine that actually renders the turnstile map glyph into a container
  function drawMap(mapGlyphContainer) {
    var margin = {top: 20, right: 30, bottom: 10, left: 10};
    var xRange = d3.extent(network.nodes, function (d) { return d.x; });
    var yRange = d3.extent(network.nodes, function (d) { return d.y; });
    var width = 300 - margin.left - margin.right,
        height = 300 - margin.top - margin.bottom;
    var xScale = width / (xRange[1] - xRange[0]);
    var yScale = height / (yRange[1] - yRange[0]);
    var scale = Math.min(xScale, yScale);
    network.nodes.forEach(function (data) {
      data.pos = [data.x * scale, data.y * scale];
    });

    var mapGlyph = mapGlyphContainer
        .attr('width', scale * (xRange[1] - xRange[0]) + margin.left + margin.right)
        .attr('height', scale * (yRange[1] - yRange[0]) + margin.top + margin.bottom)
      .appendOnce('g', 'map-container')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    mapGlyph.appendOnce('text', 'time-display')
      .attr('x', mapGlyphContainer.attr('width') * 0.55)
      .attr('y', mapGlyphContainer.attr('height') * 0.55);

    var tip = d3.tip()
        .attr('class', 'd3-tip text-center')
        .offset([-10, 0])
        .html(function(d) {
          return d.name + '<br>Average ' + d3.format(',.0f')(d3.round(averageSecondsBetweenStops[d.id], -2)) + ' entrances per day';
        });
    mapGlyph.call(tip);

    var stations = mapGlyph.selectAll('.station')
        .data(network.nodes, function (d) { return d.name; });

    var connections = mapGlyph.selectAll('.connect')
        .data(network.links, function (d) { return (d.source && d.source.id) + '-' + (d.target && d.target.id); });

    connections
        .enter()
      .append('line')
        .attr('class', function (d) { return 'connect ' + d.line; });

    connections
        .attr('x1', function (d) { return d.source.pos[0]; })
        .attr('y1', function (d) { return d.source.pos[1]; })
        .attr('x2', function (d) { return d.target.pos[0]; })
        .attr('y2', function (d) { return d.target.pos[1]; });

    stations
        .enter()
      .append('circle')
        .attr('class', function (d) { return 'station middle dimmable station-label ' + d.id; })
        .on('mouseover', function (d) {
          if (d.pos[1] < 30) {
            tip.direction('e')
              .offset([0, 10]);
          } else {
            tip.direction('n')
              .offset([-10, 0]);
          }
          tip.show(d);
          highlightStation(d.id);
        })
        .on('click', function (d) {
          showStopsOrToggle([gtfsToTurnstile[d.id]]);
        })
        .style('cursor', 'pointer')
        .on('mouseout.tip', tip.hide)
        .on('mouseout.station', unHighlightStation);

    stations.attr('cx', function (d) { return d.pos[0]; })
        .attr('cy', function (d) { return d.pos[1]; })
        .attr('r', function (d) { return sizeScale(averageSecondsBetweenStops[d.id]); });

    // colored circles at ends of lines
    function dot(id, clazz) {
      mapGlyph.selectAll('circle.' + id)
        .classed(clazz, true)
        .classed('end', true)
        .classed('middle', false);
    }
    dot('place-asmnl', "red");
    dot('place-alfcl', "red");
    dot('place-brntn', "red");
    dot('place-wondl', "blue");
    dot('place-bomnl', "blue");
    dot('place-forhl', "orange");
    dot('place-ogmnl', "orange");
  }

  // draws or updates the map station size key based on the data that
  // that is being shown on the map.  When you hover over a heatmap at
  // a particular time in the table, it adjusts the circle sizes based
  // on that time and this method is invoked to change the map key to
  // match
  function drawMapKey(sizes, sizeScale, trailer, units) {
    var margin = {top: 10, right: 30, bottom: 10, left: 10};
    var width = 300 - margin.left - margin.right;
    var mapKey = d3.selectAll('.section-people .turnstile-viz .key.circles').appendOnce('svg', 'key-container')
      .attr('width', 300)
      .attr('height', 50)
    .appendOnce('g', 'key-g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    var text = mapKey.appendOnce('text', 'middle-text')
      .attr('x', width / 2)
      .attr('y', 5)
      .attr('text-anchor', 'middle');
    text.text('Size shows turnstile ' + (trailer || '')).call(VIZ.wrap, 250);
    var xScale = d3.scale.ordinal()
        .domain(sizes)
        .range([30, 75, 135]);

    var circles = mapKey.selectAll('circle')
        .data(sizes);
    circles
        .enter()
      .append('circle')
        .attr('class', 'station middle');
    circles
        .attr('r', function (d) { return sizeScale(d); })
        .attr('cx', function (d) { return xScale(d) - sizeScale(d) - 2; })
        .attr('cy', 30);
    circles.exit().remove();

    var labels = mapKey.selectAll('text.num')
        .data(sizes);
    labels
        .enter()
      .append('text')
        .attr('class', 'num');
    labels
        .text(d3.format(',.0f'))
        .attr('x', function (d) { return xScale(d); })
        .attr('y', 35);
    labels.exit().remove();

    mapKey.appendOnce('text', 'ppl')
        .attr('text-anchor', 'start')
        .attr('x', xScale(_.last(sizes)) + 37)
        .attr('y', 35)
        .text('people ' + units);
  }

  function resetMapKey() {
    drawMapKey([500, 10000, 19400], sizeScale, 'entries on average day', 'per day');
    d3.selectAll('.section-people .glyph circle')
      .attr('r', function (d) { return sizeScale(averageSecondsBetweenStops[d.id]); });
  }


  


  /* 4. Render the bar chart with embedded heatmaps
   *************************************************************/
  // Holds the state of stations that are currently expanded in the table
  var showingStations = {
    // 'Harvard': true,
  };
  var dragOrigin;
  var drag = d3.behavior.drag()
      .origin(function(d) { return d; })
      .on("dragstart", function (d) { dragOrigin = d; })
      .on("dragend", function () { dragOrigin = null; });

  var bottomMargin = {top: 20,right: 20,bottom: 10,left: 10};
  var bottomOuterWidth = 580;
  var bottomOuterHeight = 800;
  var bottomHeight = bottomOuterHeight - bottomMargin.top - bottomMargin.bottom;
  var bottomWidth = bottomOuterWidth - bottomMargin.left - bottomMargin.right;

  var stationTable = d3.select(".section-people .turnstile-table").append('svg')
      .attr('class', 'barchart')
      .attr('width', bottomOuterWidth)
      .attr('height', bottomOuterHeight)
    .append('g')
      .attr('transform', 'translate(' + bottomMargin.left + ',' + (bottomMargin.top) + ')');
  var stationTableTooltip = d3.tip()
      .attr('class', 'd3-tip text-center')
      .offset([-10, 0]);
  stationTable.call(stationTableTooltip);

  var yScale = d3.scale.ordinal()
      .domain(turnstile.stops.map(function (d) { return d.name; }))
      .rangeRoundBands([0, bottomHeight], 0.3);

  var stationRows = stationTable.selectAll('.row')
      .data(turnstile.stops)
      .enter()
    .append('g')
      .attr('class', function (d) { return turnstileToGtfs[d.name] + ' row dimmable'; })
      .call(placeRow);

  if (!VIZ.ios) {
    stationRows.call(drag)
      .on('mouseover', highlightStationOrStationRange)
      .on('mouseout', unHighlightStation);
  }

  // When row clicked, toggle its details below
  stationRows
    .on('click', function (d) {
      showingStations[d.name] = !showingStations[d.name];
      updateShownStations(d.name);
    });

  // Left-pixel alignments for each part of the bar chart
  var namesLeftPx = 15;
  var weekdayHeatmapLeftPx = 120;
  var offpeakHeatmapLeftPx = weekdayHeatmapLeftPx + dayWidth + 5;
  var numWidthPx = 35;
  var barExtentPx = [offpeakHeatmapLeftPx + dayWidth + 5, bottomWidth];
  var barLenScale = d3.scale.linear()
      .domain([0, d3.max(turnstile.stops, function (d) { return d.entrancesByType.all; })])
      .range([0, barExtentPx[1] - barExtentPx[0] - 15]);

  stationRows
    .append('text')
      .attr('x', namesLeftPx)
      .attr('y', yScale.rangeBand())
      .attr('class', 'highlight-dimmable')
      .text(function (d) { return d.name; })
    .append('title')
      .text("Click to show details below");


  // rectangles that make mouse-over target bigger than visible components
  var rects = stationRows
    .append('rect')
      .style('opacity', '0')
      .attr('class', 'bounding-box');

  // Draw the bar showing turnstile entries for a station
  stationRows.append('rect')
    .attr('class', 'bar highlight-dimmable')
    .attr('x', barExtentPx[0])
    .attr('width', function (d) { return barLenScale(d.entrancesByType.all); })
    .attr('height', yScale.rangeBand() + 1);

  // And add the actual number as text on the right
  stationRows.append('text')
    .attr('x', function (d) { return barExtentPx[0] + barLenScale(d.entrancesByType.all); })
    .attr('text-anchor', 'start')
    .attr('dx', 2)
    .attr('dy', yScale.rangeBand())
    .attr('class', 'highlight-dimmable')
    .text(function (d) {
      var value = d.entrancesByType.all;
      var num = Math.ceil(Math.log10(value / 100));
      return d3.format(',.' + num + 'r')(value);
    });

  // Now draw the little dots indicating what line(s) the station is on
  var lines = ['red', 'blue', 'orange'];
  var lineDotScale = d3.scale.ordinal()
      .domain([1, 0])
      .rangePoints([0, 10]);
  stationRows.selectAll('.line')
      .data(function (d) { return lines.filter(function (line) { return stopToLine[turnstileToGtfs[d.name]][line]; }); })
      .enter()
    .append('circle')
      .attr('r', 3)
      .attr('cx', function (d, i) { return lineDotScale(i); })
      .attr('cy', yScale.rangeBand() - 5)
      .attr('class', function (d) { return 'highlight-dimmable line ' + d; })
      .on('mouseover', function (d) {
        stationTableTooltip.html(d + ' line');
        stationTableTooltip.show(d);
      })
      .on('mouseout', stationTableTooltip.hide);


  // Render the average turnstile heatmaps embedded within the bar chart
  var debounceTimeout;
  var debounceDelayMs = 100;
  var heatmaps = stationRows.selectAll('.heatmaps')
      .data(function (d) {
        return [
          {parent: d, type: 'entrances', day: 'offpeak', x: offpeakHeatmapLeftPx, y: 0},
          {parent: d, type: 'exits', day: 'offpeak', x: offpeakHeatmapLeftPx, y: yScale.rangeBand() / 2},
          {parent: d, type: 'entrances', day: 'weekday', x: weekdayHeatmapLeftPx, y: 0},
          {parent: d, type: 'exits', day: 'weekday', x: weekdayHeatmapLeftPx, y: yScale.rangeBand() / 2}
        ];
      })
      .enter()
    .append('g')
      .attr('class', function (d) { return 'heatmap highlight-dimmable ' + d.type + ' ' + d.day; })
      .attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });

  stationRows.append('rect')
    .attr('class', 'outline')
    .attr('x', offpeakHeatmapLeftPx)
    .attr('y', 0)
    .attr('width', hourWidth * 24)
    .attr('height', yScale.rangeBand());
  stationRows.append('rect')
    .attr('class', 'outline')
    .attr('x', weekdayHeatmapLeftPx)
    .attr('y', 0)
    .attr('width', hourWidth * 24)
    .attr('height', yScale.rangeBand());

  stationTable.selectAll('.dayLabel')
      .data([
        ['Station', 'start', namesLeftPx],
        ['Avg. Weekday', 'middle', weekdayHeatmapLeftPx + dayWidth / 2],
        ['Avg. Weekend', 'middle', offpeakHeatmapLeftPx + dayWidth / 2],
        ['Avg. Turnstile Entries per day', 'start', barExtentPx[0]]
      ])
      .enter()
    .append('g')
      .attr('class', 'xAxis')
    .append('text')
      .attr('class', 'dayLabel')
      .attr('x', function (d) { return d[2]; })
      .attr('y', function (d) { return d[3] || -10; })
      .text(function (d) { return d[0]; })
      .style('text-anchor', function (d) { return d[1]; });

  stationTable.append('line')
    .attr('class', 'border')
    .attr('x1', 0)
    .attr('x2', barExtentPx[1] + 20)
    .attr('y1', -7)
    .attr('y2', -7);

  var dayLabels = stationTable.selectAll('.hours')
    .data([weekdayHeatmapLeftPx, offpeakHeatmapLeftPx])
    .enter()
    .append('g')
    .attr('class', 'hours xAxis');

  var hourLabelsScale = d3.scale.ordinal()
    .domain(['6am', '12pm', '6pm'])
    .rangePoints([0, dayWidth], 2.0);
  var xAxis = d3.svg.axis()
    .scale(hourLabelsScale)
    .orient('bottom');
  dayLabels
    .attr('transform', function(d) { return 'translate(' + d +',-11)'; })
    .call(xAxis);

  var positionScale = d3.scale.ordinal()
   .rangeBands([0, dayWidth], 0, 0)
   .domain(d3.range(0, 24));

  var colorScale = d3.scale.linear()
    .domain([turnstile.min, turnstile.mean || turnstile.max * 0.9, turnstile.max])
    .range(['white', 'black', 'red']);

  heatmaps.selectAll('rect')
    .data(function (d) { return d.parent.averagesByType[d.day].filter(function (d) { return !!d; }).map(function (other) {
      return {
        hour: other.hour,
        datum: other[d.type],
        name: d.parent.name,
        day: d.day,
        type: d.type
      };
    }); })
    .enter().append('rect')
    .attr('x', function(d) { return positionScale(d.hour); })
    .attr('width', hourWidth)
    .attr('height', yScale.rangeBand()/2)
    .attr('fill', function(d) { return colorScale(d.datum); });

  // tooltip on average weekday/weekend heatmaps
  if (!VIZ.ios) {
    stationTable.onOnce('mouseover', '.heatmap rect', function (d) {
      clearTimeout(debounceTimeout);
      var time = VIZ.hourToAmPm(d.hour);
      var timePlusOne = VIZ.hourToAmPm((d.hour + 1) % 24);
      var gtfsId = turnstileToGtfs[d.name];
      stationTable.selectAll('.row.' + gtfsId).select('.stop-heatmap').selectAll('rect.' + d.type).classed('hover', function (other) {
        return classify(other) === d.day && other.hour === d.hour;
      });
      stationTableTooltip.html(d.name + ' from ' + time + ' to ' + timePlusOne + ' on average ' + (d.day === 'weekday' ? 'weekday' : 'weekend/holiday') + '<br>' + d3.format('.0f')(d.datum/60) + ' ' + d.type + ' per minute');
      stationTableTooltip.show(d);

      var updatedSizes = {};
      turnstile.stops.forEach(function (stop) {
        var datum = stop.averagesByType[d.day][d.hour];
        updatedSizes[turnstileToGtfs[stop.name]] = datum ? datum[d.type] : 0;
      });
      d3.selectAll('.section-people .glyph circle')
        .attr('r', function (d) { return perHourSizeScale(updatedSizes[d.id]); });
      drawMapKey([0, 40, 82], perHourPerMinuteSizeScale, d.type + ' on ' + (d.day === 'weekday' ? 'weekdays' : 'weekends/holidays') + ' from ' + time + ' to ' + timePlusOne, 'per minute');
    })
    .onOnce('mouseout', '.heatmap rect', function (d) {
      var gtfsId = turnstileToGtfs[d.name];
      stationTable.selectAll('.row.' + gtfsId).select('.stop-heatmap').selectAll('rect').classed('hover', false);
      stationTableTooltip.hide(d);

      // to cut down on the flash while hovering acros the turnstile heatmaps, keep the last selected value
      // around for a split second before resetting to defaults
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(resetMapKey, debounceDelayMs);
    });
  }

  // If the stops to be expanded are the ONLY ones that are currently expanded, then collapse them
  // Otherwise collapse all others and expand these
  function showStopsOrToggle(stops) {
      var alreadyShowing = true;
      stops.forEach(function (d) {
        alreadyShowing = alreadyShowing && showingStations[d];
      });
      alreadyShowing = alreadyShowing && Object.keys(showingStations).filter(function (key) { return showingStations[key]; }).length === stops.length;

      showingStations = {};
      if (!alreadyShowing) {
        stops.forEach(function (d) {
          showingStations[d] = true;
        });
      }
      updateShownStations();
  }

  function highlightStationOrStationRange(d) {
    var id = turnstileToGtfs[d.name];
    if (dragOrigin) {
      var a = d.entrancesByType.all;
      var b = dragOrigin.entrancesByType.all;
      var min = d3.min([a, b]);
      var max = d3.max([a, b]);
      var container = d3.select('.section-people .turnstile-viz');
      container.selectAll('.glyph').classed('highlighting', true);
      container.selectAll('[class*=place-]').classed('active', isActive);
    } else {
      highlightStation(id, true);
    }
    function isActive(other) {
      var num = averageSecondsBetweenStops[other.id || turnstileToGtfs[other.name]];
      return num <= max && num >= min;
    }
  }

  function highlightStation(gtfsId, left) {
    var container = d3.select('.section-people .turnstile-viz');
    container.selectAll(left ? '.glyph' : '.turnstile-table').classed('highlighting', true);
    container.selectAll('.' + gtfsId).classed('active', true);
  }

  function unHighlightStation() {
    var container = d3.selectAll('.section-people .turnstile-viz .glyph, .section-people .turnstile-viz .turnstile-table');
    container.classed('highlighting', false);
    container.selectAll('.active').classed('active', false);
  }

  function adjustRects() {
    rects
        .attr('width', function (d) {
          return showingStations[d.name] ? bottomOuterWidth : (barExtentPx[0] + barLenScale(d.entrancesByType.all) + numWidthPx);
        })
        .attr('height', function (d) {
          var name = d.name;
          var currentOffset = yScale.rangeBand() / 0.7;
          if (showingStations[name]) {
            currentOffset += heatmapHeight + (numAnnotationLinesInTable[name] || 0) * 12 + 5;
          }
          return currentOffset;
        });
  }

  function placeRow(selection) {
    selection.attr('transform', function (d) { return 'translate(0,' + (yScale(d.name) + (offset[d.name] || 0)) + ')'; });
  }
  
  // Add/remove detailed turnstile heatmaps based on contents of showingStations
  function updateShownStations() {
    tip.hide();
    var table = d3.selectAll('.section-people .turnstile-table svg');
    var stationRows = table.selectAll('.row');

    var sections = stationRows.selectAll('.station-section')
        .data(
          function (d) { return showingStations[d.name] ? [d] : []; },
          function (d) { return d.name; }
        );
    var newSections = sections
        .enter()
        .append('g')
        .attr('class', 'station-section')
        .attr('clip-path', 'url(#rowTurnstileClip)')
        .attr('transform', 'translate(15,' + (7+yScale.rangeBand()) + ')');

    newSections
      .append('g')
        .each(function (d) {
          d3.select(this).call(drawStop, d.name, d, turnstile);
        });
    newSections.append('line')
      .attr('class', 'border')
      .attr('x1', -15)
      .attr('x2', barExtentPx[1] + 20 - 15)
      .attr('y1', -3)
      .attr('y2', -3);

    newSections.select('.stop-heatmap').append('g')
        .attr('class', 'annotation details')
        .attr('transform', 'translate(0,' + heatmapHeight + ')')
        .filter(function (d) { return stationDetails[d.name]; })
      .append('text')
        .text(function (d) { return stationDetails[d.name]; })
        .call(VIZ.wrap, heatmapWidth)
        .each(function (d) { numAnnotationLinesInTable[d.name] = d3.select(this).selectAll('tspan').size(); });

    var currentOffset = 0;
    turnstile.stops.forEach(function (stop) {
      var name = stop.name;
      offset[name] = currentOffset;
      if (showingStations[name]) {
        currentOffset += heatmapHeight + (numAnnotationLinesInTable[name] || 0) * 12 + 5;
      }
    });

    var exits = sections.exit().attr('class', '.old-station-section').call(function (d) {
      numAnnotationLinesInTable[d.name] = 0;
    });
    newSections.call(hideDetailed);

    setTimeout(function () {
      // slide down new sections
      newSections.transition().call(showDetailed);
      // slide up old sections (remove class first so it doesn't get picked up in future selection)
      exits.transition().call(hideDetailed).remove();
      // push down/up all rows
      stationRows.transition().each('end', VIZ.triggerScroll).call(placeRow);
      // make svg taller/shorter to fit detailed breakdowns
      table.transition().attr('height', bottomOuterHeight + currentOffset);
      adjustRects();
    });
  }

  function showDetailed(selection) {
    selection
      .selectAll('.stop-heatmap')
      .attr('transform', 'translate(0,0)');
  }

  function hideDetailed(selection) {
    selection
      .selectAll('.stop-heatmap')
      .attr('transform', function (d) {
        return 'translate(0,' + (-heatmapHeight - (numAnnotationLinesInTable[d.name] || 0) * 12) + ')';
      });
  }





  /* 5. Connect hovering/clicking on linked text to the charts
   *************************************************************/
  // Setup linked text to put bounding box around days of week in the all-station turnstile section
  // <a href="#" class="highlight-total" data-highlight="holidays or snow">
  d3.selectAll('.section-people .highlight-total').on('click', function () {
    d3.event.preventDefault();
  })
  .on('mouseover', function () {
    var highlight = d3.select(this).attr('data-highlight');
    var list = heatmapHighlights[highlight];
    highlightGroups.selectAll('rect.highlight')
        .data(list)
        .enter()
      .append('rect')
        .attr('class', 'highlight')
        .attr('width', dayWidth - 7)
        .attr('height', hourHeight + 2)
        .attr('x', function (d) { return (dayWidth + dayMargin.right) * d[1]; })
        .attr('y', function (d) { return (hourHeight + dayMargin.bottom) * d[0]; });
    allStationHeatmap.selectAll('.num2').selectAll('line.highlight')
        .data(list)
        .enter()
      .append('line')
        .attr('class', 'highlight')
        .attr('x1', function (d) { return (dayWidth + dayMargin.right) * d[1]; })
        .attr('x2', function (d) { return (dayWidth + dayMargin.right) * d[1]; })
        .attr('y1', function (d) { return (hourHeight + dayMargin.bottom) * d[0]; })
        .attr('y2', function (d) { return (hourHeight + dayMargin.bottom) * d[0] + 5 * (dayMargin.bottom + hourHeight); });
  })
  .on('mouseout', function () {
    allStationHeatmap.selectAll('.highlight').remove();
  });

  // Setup linked text to dim parts of graph in the all-station turnstile section
  // <a href="#" class="dim" data-dim="class of dom elements to dim">
  d3.selectAll('.section-people .dim').on('click', function () {
    d3.event.preventDefault();
  })
  .on('mouseover', function () {
    var dim = d3.select(this).attr('data-dim');
    allStationHeatmap.selectAll('.' + dim).style('opacity', 0.1);
  })
  .on('mouseout', function () {
    var dim = d3.select(this).attr('data-dim');
    allStationHeatmap.selectAll('.' + dim).style('opacity', 1);
  });

  // Setup linked text to highlight parts of graph
  // <a href="#" class="highlight" data-highlight="class of dom elements to highlight">
  d3.selectAll('.section-people .highlight')
    .on('click', function () {
      d3.event.preventDefault();
    })
    .on('mouseover', function () {
      var highlight = d3.select(this).attr('data-highlight');
      var container = d3.select('.section-people .turnstile-table');
      container.selectAll('.highlight-dimmable').classed({
        dim: function () { return !d3.select(this).classed(highlight); },
        active: function () { return d3.select(this).classed(highlight); }
      });
    })
    .on('mouseout', function () {
      var container = d3.select('.section-people .turnstile-table');
      container.selectAll('.dim').classed({
        dim: false,
        active: false
      });
    });

  // Setup linked text to highlight particular stops
  // <a href="#" class="highlight-stops" data-stops="comma separated list of stop names to show">
  d3.selectAll('.section-people .highlight-stops')
    .on('click', function () {
      d3.event.preventDefault();
      var stops = d3.select(this).attr('data-stops').split(",");
      showStopsOrToggle(stops);
    })
    .on('mouseover', function () {
      var stops = d3.select(this).attr('data-stops')
        .split(",")
        .map(function (d) { return '.' + turnstileToGtfs[d]; })
        .join(", ");
      var container = d3.select('.section-people .turnstile-viz').selectAll('.glyph, .turnstile-table');
      container.classed('highlighting', true);
      container.selectAll(stops).classed('active', true);
    })
    .on('mouseout', unHighlightStation);





  /* 6. Draw color keys
   *************************************************************/
  drawColorKey(
    '.turnstile.key',
    'turnstileGradient',
    [0, turnstile.all.max * 0.9, turnstile.all.max],
    [0, 200, 400, 600, d3.round(turnstile.all.max / 60, 0)]
  );

  drawColorKey(
    '.turnstile-all-key.key',
    'turnstileAllGradient',
    [0, turnstile.mean, turnstile.max],
    [0, 20, 40, 60, d3.round(turnstile.max / 60, 0)]
  );

  function drawColorKey(parentSelector, gradientId, domain, tickValues) {
    var bandWidth = 150;
    var outerWidth = heatmapWidth;
    var margins = (outerWidth - 500) / 2;
    var outerHeight = 70;
    var margin = {top: 25, right: margins, bottom: 0, left: heatMapMargin.left};
    var colorScale = d3.scale.linear()
      .domain(domain)
      .range(['white', 'black', 'red']);

    var keyContainer = d3.selectAll(parentSelector);
    var svg = keyContainer.append('svg')
        .attr('width', outerWidth)
        .attr('height', outerHeight)
      .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    svg.append('text')
        .attr('y', 10)
        .text('Color shows average entrances/exits');
    var textWidth = 220;

    var xScale = d3.scale.linear()
        .domain(d3.extent(colorScale.domain()).map(function (d) { return d / 60; }))
        .range([0, bandWidth]);

    // encode the color key as a gradient that stretches across the wide rectangle
    VIZ.createColorScaleGradient(colorScale, gradientId);
    var coloredPart = svg.append('g')
      .attr('transform', 'translate(' + textWidth + ',' + 1 + ')');
    coloredPart.append('rect')
      .attr('width', bandWidth)
      .attr('height', hourHeight)
      .attr('fill', 'url(#' + gradientId + ')');

    // also label specific points on the color scale
    var colorScaleAxis = d3.svg.axis()
      .scale(xScale)
      .orient('bottom')
      .tickValues(tickValues)
      .tickFormat(d3.format('.0f'))
      .tickSize(4);
    coloredPart
      .append('g')
        .attr('class', 'x axis')
        .attr('transform', function() {return 'translate(' + 0 +',' + hourHeight + ')'; })
        .call(colorScaleAxis)
      .append('text')
        .attr('text-anchor', 'start')
        .attr('x', bandWidth + 14)
        .attr('dy', 14)
        .text('people per minute');
  }


  // bootstrap the stations that are expanded
  updateShownStations();

  

  /* Formatting utilities
   *************************************************************/

  function hour(d) {
    return d.hour;
  }

  // zero based day of the week
  function day(d) {
    return d.day;
  }

  // zero based week index for february
  function week(d) {
    return d.week - 1;
  }

  function isHoliday(week, day) {
    return week === 2 && day === 1;
  }

  function isWeekend(week, day) {
    return day === 0 || day === 6;
  }

  function classify(d) {
    var theWeek = week(d);
    var theDay = day(d);
    if (isHoliday(theWeek, theDay) || isWeekend(theWeek, theDay)) {
      return 'offpeak';
    } else {
      return 'weekday';
    }
  }

  function getTextForRollover(d, dataType) {
    return [
      [
        moment(d.time).zone(5).format('ddd MMM D [from] ha'),
        'to',
        moment(d.time).zone(5).add(1, 'hour').format('ha')
      ].join(' '),
      [
        d3.format(',.0f')(d[dataType] / 60),
        dataType,
        'per minute'
      ].join(' ')
    ].join('<br>');
  }
});