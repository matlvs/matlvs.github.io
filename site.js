/* Living network background + scroll reveal.
   Any <canvas class="net"> on a page gets an animated flow network. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Scroll reveal ---------------- */
  var targets = document.querySelectorAll(
    'main h2, .card, .topic, .pubs li, .cv-entry, .news li, .subhead'
  );
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });

    targets.forEach(function (el) {
      // Only animate what starts below the fold: no flash for visible content.
      if (el.getBoundingClientRect().top > window.innerHeight) {
        el.classList.add('reveal');
        io.observe(el);
      }
    });
  }

  /* ---------------- Network ---------------- */
  function rand(a, b) { return a + Math.random() * (b - a); }

  function accentRGB() {
    var probe = document.createElement('span');
    probe.style.color = 'var(--accent)';
    document.body.appendChild(probe);
    var c = getComputedStyle(probe).color;
    probe.remove();
    var m = c.match(/\d+(\.\d+)?/g) || [31, 111, 120];
    return m.slice(0, 3).map(Number);
  }

  function Network(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mouse = { x: -1e4, y: -1e4 };
    this.visible = true;
    this.t0 = performance.now();
    this.build();

    var self = this;
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { self.build(); }, 200);
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      self.rgb = accentRGB();
      if (reduceMotion) self.draw(1e6);
    });
    var host = canvas.parentElement;
    host.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      self.mouse.x = e.clientX - r.left;
      self.mouse.y = e.clientY - r.top;
    });
    host.addEventListener('pointerleave', function () {
      self.mouse.x = self.mouse.y = -1e4;
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        self.visible = en[0].isIntersecting;
      }).observe(canvas);
    }
  }

  Network.prototype.build = function () {
    var c = this.canvas;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
    this.rgb = accentRGB();

    // Jittered grid of nodes, denser on the right where there is less text.
    var step = Math.max(46, Math.min(70, w / 18));
    var nodes = [];
    for (var y = -step / 2; y < h + step; y += step * 0.86) {
      for (var x = -step / 2; x < w + step; x += step) {
        var bias = x / w; // 0 at left, 1 at right
        if (Math.random() > 0.25 + 0.75 * bias) continue;
        nodes.push({ x: x + rand(-0.4, 0.4) * step, y: y + rand(-0.4, 0.4) * step });
      }
    }

    // Connect each node to its 2-3 nearest neighbours.
    var edges = [], seen = {};
    nodes.forEach(function (a, i) {
      var d = nodes.map(function (b, j) {
        return { j: j, d: (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) };
      }).sort(function (p, q) { return p.d - q.d; });
      var k = Math.random() < 0.5 ? 2 : 3;
      for (var n = 1; n <= k && n < d.length; n++) {
        var j = d[n].j, key = i < j ? i + '-' + j : j + '-' + i;
        if (seen[key]) continue;
        seen[key] = true;
        edges.push({ a: i, b: j });
      }
    });

    // Growth order: breadth-first from a seed on the right edge.
    var adj = nodes.map(function () { return []; });
    edges.forEach(function (e, k) { adj[e.a].push(k); adj[e.b].push(k); });
    var seed = 0;
    nodes.forEach(function (n, i) {
      if (Math.abs(n.y - h / 2) + (w - n.x) < Math.abs(nodes[seed].y - h / 2) + (w - nodes[seed].x)) seed = i;
    });
    var depth = nodes.map(function () { return -1; });
    depth[seed] = 0;
    var queue = [seed], maxDepth = 1;
    while (queue.length) {
      var u = queue.shift();
      adj[u].forEach(function (k) {
        var e = edges[k], v = e.a === u ? e.b : e.a;
        if (depth[v] < 0) { depth[v] = depth[u] + 1; maxDepth = Math.max(maxDepth, depth[v]); queue.push(v); }
      });
    }

    edges.forEach(function (e) {
      var A = nodes[e.a], B = nodes[e.b];
      e.len = Math.hypot(B.x - A.x, B.y - A.y);
      e.base = Math.random() < 0.18 ? rand(2.2, 3.4) : rand(0.6, 1.5); // a few thick veins
      e.start = Math.max(0, Math.min(depth[e.a], depth[e.b])) / maxDepth; // growth delay 0..1
      e.dir = Math.random() < 0.5 ? 1 : -1;
      e.phase = Math.random();
      // slight curvature, like real tubes
      var nx = -(B.y - A.y) / (e.len || 1), ny = (B.x - A.x) / (e.len || 1), bend = rand(-0.18, 0.18) * e.len;
      e.cx = (A.x + B.x) / 2 + nx * bend;
      e.cy = (A.y + B.y) / 2 + ny * bend;
    });

    this.nodes = nodes;
    this.edges = edges;
    this.t0 = performance.now();
    if (reduceMotion) this.draw(1e6);
  };

  Network.prototype.draw = function (now) {
    var ctx = this.ctx, w = this.w, h = this.h, rgb = this.rgb, nodes = this.nodes, m = this.mouse;
    var t = Math.max(0, (now - this.t0) / 1000);
    var grow = reduceMotion ? 1 : Math.min(1, t / 2.6); // growth phase lasts ~2.6 s
    ctx.clearRect(0, 0, w, h);

    var col = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',';

    this.edges.forEach(function (e) {
      var local = (grow - e.start * 0.85) / 0.15; // how far this edge has grown
      if (local <= 0) return;
      local = Math.min(1, local);
      var A = nodes[e.a], B = nodes[e.b];

      // Peristaltic wave travelling across the network (as in Physarum).
      var mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      var wave = reduceMotion ? 0 : Math.sin(mx * 0.012 + my * 0.006 - t * 1.4);
      var dm = Math.hypot(mx - m.x, my - m.y);
      var near = Math.max(0, 1 - dm / 160);

      var width = e.base * (1 + 0.28 * wave) * (1 + 0.6 * near);
      var alpha = (0.16 + 0.06 * wave + 0.35 * near) * (e.base > 2 ? 1.25 : 1);

      ctx.strokeStyle = col + alpha.toFixed(3) + ')';
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (local >= 1) {
        ctx.moveTo(A.x, A.y);
        ctx.quadraticCurveTo(e.cx, e.cy, B.x, B.y);
      } else {
        // partially grown edge: draw along the curve up to `local`
        ctx.moveTo(A.x, A.y);
        for (var s = 1; s <= 10; s++) {
          var u = (s / 10) * local, iu = 1 - u;
          ctx.lineTo(iu * iu * A.x + 2 * iu * u * e.cx + u * u * B.x,
                     iu * iu * A.y + 2 * iu * u * e.cy + u * u * B.y);
        }
      }
      ctx.stroke();

      // Small particle carried by the flow along thick veins.
      if (!reduceMotion && local >= 1 && e.base > 1.2) {
        var p = (e.phase + e.dir * t * 60 / e.len) % 1;
        if (p < 0) p += 1;
        var ip = 1 - p;
        var px = ip * ip * A.x + 2 * ip * p * e.cx + p * p * B.x;
        var py = ip * ip * A.y + 2 * ip * p * e.cy + p * p * B.y;
        ctx.fillStyle = col + (0.35 + 0.4 * near).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(px, py, 1.4 + 0.4 * e.base, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Junctions
    nodes.forEach(function (n) {
      var d = Math.hypot(n.x - m.x, n.y - m.y);
      var near = Math.max(0, 1 - d / 160);
      ctx.fillStyle = col + (0.22 + 0.5 * near).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(n.x, n.y, (1.6 + 1.6 * near) * grow, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  /* ---------------- Theme toggle ---------------- */
  var root = document.documentElement;
  var sysDark = window.matchMedia('(prefers-color-scheme: dark)');
  function isDark() {
    var t = root.getAttribute('data-theme');
    return t ? t === 'dark' : sysDark.matches;
  }
  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      nets.forEach(function (n) { n.rgb = accentRGB(); if (reduceMotion) n.draw(1e6); });
    });
  });

  var nets = [];
  document.querySelectorAll('canvas.net').forEach(function (c) { nets.push(new Network(c)); });

  if (!reduceMotion && nets.length) {
    (function loop(now) {
      if (!document.hidden) nets.forEach(function (n) { if (n.visible) n.draw(now); });
      requestAnimationFrame(loop);
    })(performance.now());
  }
})();
