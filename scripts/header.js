/**
 * header.js
 *
 * Copyright 2014 Michael Barry & Brian Card.  MIT open-source lincense.
 *
 * Render the header for the visualization
 */

(function () {
  "use strict";
  var svg = d3.select('.header .graphic').append("svg").attr('width', 283).attr('height', 283);

  // Render the station map first, then load the train data and start animating trains
  VIZ.requiresData([
    // nodes and links that comprise the subway system network
    'json!data/station-network.json',
    // hard-coded positions for each station on the map glyph
    'json!data/spider.json',
  ], true).done(function (network, spider) {
    // pre-process the data
    var idToNode = {}, idToLine = {}, trips;
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
      idToLine[link.source.id + '|' + link.target.id] = link.line;
      idToLine[link.target.id + '|' + link.source.id] = link.line;
    });

    // watch height to adjust visualization after loading data
    VIZ.watchSize(function () {
      drawMap(svg, $('.container').width() / 4, $('.container').width() / 4);
    });


    // return the center location for a train given the two stations it is between and
    // how far along that segment it is
    function placeWithOffset(from, to, ratio) {
      var fromPos = idToNode[from.stop].pos;
      var toPos = idToNode[to.stop].pos;
      var midpoint = d3.interpolate(fromPos, toPos)(ratio);
      var angle = Math.atan2(toPos[1] - fromPos[1], toPos[0] - fromPos[0]) + Math.PI / 2;
      return [midpoint[0] + Math.cos(angle) * radius, midpoint[1] + Math.sin(angle) * radius];
    }

    var radius = 2;
    var minUnixSeconds = moment('2014/02/03 07:00 -0500', 'YYYY/MM/DD HH:m ZZ').valueOf() / 1000;
    var maxUnixSeconds = moment('2014/02/04 02:00 -0500', 'YYYY/MM/DD HH:m ZZ').valueOf() / 1000;

    // number of times per second to recalculate trajectories of trains
    var PER_SECOND = 10;

    // Now load the marey data and start the animation
    VIZ.requiresData([
      'json!data/marey-trips.json'
    ]).done(function (data) {
      trips = data;
      // and start rendering it - 1 minute = 1 second
      renderTrainsAtTime(lastTime, true);
      (function animate() {
        renderTrainsAtTime(lastTime > maxUnixSeconds ? minUnixSeconds : (lastTime + 60 / PER_SECOND));
        setTimeout(animate, 1000 / PER_SECOND);
      }());
    });

    // Render the dots for each train at a particular point in time
    var lastTime = minUnixSeconds;
    function renderTrainsAtTime(unixSeconds, now) {
      var duration = now ? 0 : (1000 / PER_SECOND);
      if (!unixSeconds) { unixSeconds = lastTime; }
      lastTime = unixSeconds;
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
        var from = d.stops[i];
        var to = d.stops[i + 1];
        var ratio = (unixSeconds - from.time) / (to.time - from.time);
        return {trip: d.trip, pos: placeWithOffset(from, to, ratio), line: d.line};
      });

      var trains = svg.select('.map-container').selectAll('.train').data(positions, function (d) { return d.trip; });
      if (now) {
        trains.transition().duration(0)
            .attr('cx', function (d) { return d.pos[0]; })
            .attr('cy', function (d) { return d.pos[1]; });
      } else {
        trains.transition().duration(duration).ease('linear')
            .attr('cx', function (d) { return d.pos[0]; })
            .attr('cy', function (d) { return d.pos[1]; });
      }
      trains.enter().append('circle')
          .attr('class', function (d) { return 'train ' + d.line; })
          .attr('r', radius)
          .attr('cx', function (d) { return d.pos[0]; })
          .attr('cy', function (d) { return d.pos[1]; });
      trains.exit().remove();
      if (unixSeconds) { svg.select('.time-display').text(function () {
        var t = moment(unixSeconds * 1000).zone(5);
        return t.format('dddd M/D h:mm a');
      }); }
    }

    // render the map given a particular width and height that it needs to fit into
    function drawMap(svgContainer, outerWidth, outerHeight) {
      var margin = {top: 20, right: 30, bottom: 10, left: 10};
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

      var svg = svgContainer
          .attr('width', Math.max(250, scale * (xRange[1] - xRange[0]) + margin.left + margin.right))
          .attr('height', scale * (yRange[1] - yRange[0]) + margin.top + margin.bottom)
        .appendOnce('g', 'map-container')
          .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      svg.appendOnce('text', 'time-display')
        .attr('x', svgContainer.attr('width') * 0.55 - 10)
        .attr('y', svgContainer.attr('height') * 0.55);

      var tip = d3.tip()
          .attr('class', 'd3-tip')
          .offset([-10, 0])
          .html(function(d) { return d.name; });
      svg.call(tip);

      var stations = svg.selectAll('.station')
          .data(network.nodes, function (d) { return d.name; });

      var connections = svg.selectAll('.connect')
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
          })
          .on('mouseout', tip.hide);

      stations.attr('cx', function (d) { return d.pos[0]; })
          .attr('cy', function (d) { return d.pos[1]; })
          .attr('r', 2);

      // line color circles at the end of each line
      function dot(id, clazz) {
        svg.selectAll('circle.' + id)
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
      if (trips) {
        renderTrainsAtTime(lastTime, true);
      }
    }
  });
}());

